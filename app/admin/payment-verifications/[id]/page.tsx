'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/shared/status-badge';
import { PageHeader } from '@/components/shared/page-header';
import { ValidationWarningDialog } from '@/components/shared/validation-warning-dialog';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Download,
  Loader2,
  User as UserIcon,
  Building2,
  Calendar,
  FileText,
} from 'lucide-react';

interface PaymentVerification {
  id: string;
  uid: string;
  userFullName: string;
  userEmail: string;
  kind: string;
  kindLabel: string;
  amount: number;
  bankName: string;
  senderAccountName: string;
  senderAccountNumber: string;
  transferDate: { seconds: number } | null;
  notes?: string;
  entityId?: string;
  receiptUrl: string;
  receiptStoragePath: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: { seconds: number } | null;
  reviewedAt: { seconds: number } | null;
  reviewerUid?: string;
  rejectionReason?: string;
  approvalNote?: string;
}

const PLATFORM_UID = '_platform';

function formatNaira(n: number | undefined): string {
  const val = typeof n === 'number' ? n : 0;
  return `₦${val.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PaymentVerificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [record, setRecord] = useState<PaymentVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'payment_verifications', id),
      (snap) => {
        if (!snap.exists()) {
          setRecord(null);
        } else {
          setRecord({
            id: snap.id,
            ...(snap.data() as Omit<PaymentVerification, 'id'>),
          });
        }
        setLoading(false);
      },
      (err) => {
        toast.error(`Failed to load: ${err.message}`);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id]);

  async function handleApprove() {
    if (!record || record.status !== 'pending') return;
    const reviewerUid = auth.currentUser?.uid;
    if (!reviewerUid) {
      toast.error('You must be signed in.');
      return;
    }

    setApproving(true);
    try {
      await runTransaction(db, async (txn) => {
        const verifRef = doc(db, 'payment_verifications', record.id);
        const verifSnap = await txn.get(verifRef);
        if (!verifSnap.exists()) throw new Error('Record not found');
        const current = verifSnap.data();
        if (current.status !== 'pending') {
          throw new Error(`Already ${current.status}`);
        }

        // Registration fee approvals do NOT credit a wallet — they flip
        // users/{uid}.registrationFeePaid=true. The two-tier commission
        // split ran atomically during the register() call, so nothing else
        // needs to happen here.
        if (record.kind === 'registrationFee') {
          const userRef = doc(db, 'users', record.uid);
          const userSnap = await txn.get(userRef);
          if (!userSnap.exists()) throw new Error('User not found');

          txn.update(userRef, {
            registrationFeePaid: true,
            registrationFeePaymentMethod: 'bank_transfer',
            registrationFeeVerificationId: record.id,
            updatedAt: serverTimestamp(),
          });
        } else {
          // Everything else credits the user's wallet.
          const walletRef = doc(db, 'wallets', record.uid);
          const walletSnap = await txn.get(walletRef);

          const prevBalance = Number(walletSnap.data()?.balance ?? 0);
          if (walletSnap.exists()) {
            txn.update(walletRef, {
              balance: prevBalance + record.amount,
              updatedAt: serverTimestamp(),
            });
          } else {
            txn.set(walletRef, {
              balance: record.amount,
              totalEarnings: 0,
              referralEarnings: 0,
              sponsorEarnings: 0,
              investmentReturns: 0,
              salesEarnings: 0,
              pendingWithdrawals: 0,
              updatedAt: serverTimestamp(),
            });
          }

          // Log a deposit transaction — this ALSO triggers the
          // walletMovement push notification via the onDepositCompleted
          // Cloud Function from Drop 2.
          const txRef = doc(
            db,
            'transactions',
            `verif_${record.id}` // deterministic ID = idempotent
          );
          txn.set(txRef, {
            uid: record.uid,
            kind: 'deposit',
            direction: 'credit',
            status: 'completed',
            amount: record.amount,
            title: `Bank transfer (${record.kindLabel})`,
            description: `Manual verification #${record.id.slice(0, 8)}`,
            reference: `bank_${record.id}`,
            metadata: {
              paymentVerificationId: record.id,
              paymentMethod: 'bank_transfer',
              kind: record.kind,
              entityId: record.entityId ?? null,
            },
            createdAt: serverTimestamp(),
          });
        }

        // Flip the verification doc.
        txn.update(verifRef, {
          status: 'approved',
          reviewedAt: serverTimestamp(),
          reviewerUid,
          approvalNote: approvalNote.trim() || null,
        });
      });

      toast.success('Payment approved and credited.');
      setShowApproveConfirm(false);
    } catch (e: any) {
      toast.error(e.message || 'Approval failed. Please try again.');
    } finally {
      setApproving(false);
    }
  }

  async function handleReject() {
    if (!record || record.status !== 'pending') return;
    if (rejectionReason.trim().length < 3) {
      toast.error('Please provide a rejection reason.');
      return;
    }
    const reviewerUid = auth.currentUser?.uid;
    if (!reviewerUid) return;

    setRejecting(true);
    try {
      await runTransaction(db, async (txn) => {
        const ref = doc(db, 'payment_verifications', record.id);
        const snap = await txn.get(ref);
        if (!snap.exists()) throw new Error('Record not found');
        if (snap.data().status !== 'pending') {
          throw new Error(`Already ${snap.data().status}`);
        }
        txn.update(ref, {
          status: 'rejected',
          reviewedAt: serverTimestamp(),
          reviewerUid,
          rejectionReason: rejectionReason.trim(),
        });
      });

      toast.success('Rejection recorded.');
      setShowRejectConfirm(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed to reject.');
    } finally {
      setRejecting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Verification not found"
          description="This record may have been deleted."
        />
        <Link href="/admin/payment-verifications">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to list
          </Button>
        </Link>
      </div>
    );
  }

  const isPending = record.status === 'pending';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/payment-verifications"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            All verifications
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {record.kindLabel} · {formatNaira(record.amount)}
            <StatusBadge status={record.status} />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Submitted {formatDate(record.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — user + transfer details */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                User
              </h2>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{record.userFullName}</div>
                  <div className="text-sm text-muted-foreground">
                    {record.userEmail}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">
                    uid: {record.uid}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                Transfer details
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Amount</div>
                  <div className="font-semibold text-lg">
                    {formatNaira(record.amount)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Payment kind
                  </div>
                  <div className="font-medium">{record.kindLabel}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Sender bank
                  </div>
                  <div className="font-medium">{record.bankName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Sender account
                  </div>
                  <div className="font-medium">
                    {record.senderAccountName}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    {record.senderAccountNumber}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Transfer date
                  </div>
                  <div className="font-medium">
                    {formatDate(record.transferDate)}
                  </div>
                </div>
                {record.entityId && (
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Linked entity
                    </div>
                    <div className="font-mono text-xs">{record.entityId}</div>
                  </div>
                )}
              </div>
              {record.notes && (
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    User notes
                  </div>
                  <p className="text-sm mt-1">{record.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                  Receipt
                </h2>
                <a
                  href={record.receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900"
                >
                  <Download className="h-4 w-4" />
                  Open in new tab
                </a>
              </div>
              <div className="rounded-lg overflow-hidden border bg-muted/20">
                {record.receiptUrl.toLowerCase().includes('.pdf') ? (
                  <iframe
                    src={record.receiptUrl}
                    className="w-full h-[600px]"
                    title="Receipt"
                  />
                ) : (
                  <img
                    src={record.receiptUrl}
                    alt="Receipt"
                    className="w-full max-h-[600px] object-contain"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {record.status === 'rejected' && record.rejectionReason && (
            <Card className="border-red-200">
              <CardContent className="p-4">
                <div className="text-xs uppercase text-red-700 font-semibold">
                  Rejection reason
                </div>
                <p className="text-sm mt-1">{record.rejectionReason}</p>
                <div className="text-xs text-muted-foreground mt-2">
                  {formatDate(record.reviewedAt)} · by {record.reviewerUid?.slice(0, 8)}
                </div>
              </CardContent>
            </Card>
          )}

          {record.status === 'approved' && (
            <Card className="border-green-200">
              <CardContent className="p-4">
                <div className="text-xs uppercase text-green-700 font-semibold">
                  Approved
                </div>
                {record.approvalNote && (
                  <p className="text-sm mt-1">{record.approvalNote}</p>
                )}
                <div className="text-xs text-muted-foreground mt-2">
                  {formatDate(record.reviewedAt)} · by {record.reviewerUid?.slice(0, 8)}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — actions */}
        <div className="space-y-4">
          {isPending ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                  Action
                </h2>
                <p className="text-sm text-muted-foreground">
                  {record.kind === 'registrationFee'
                    ? 'Approving activates the user\'s account. No wallet credit needed.'
                    : `Approving credits ${formatNaira(record.amount)} to the user\'s wallet and sends them a push notification.`}
                </p>

                <div>
                  <label className="text-xs uppercase text-muted-foreground font-semibold">
                    Approval note (optional)
                  </label>
                  <Textarea
                    value={approvalNote}
                    onChange={(e) => setApprovalNote(e.target.value)}
                    placeholder="Anything to note about this approval..."
                    rows={2}
                    className="mt-1"
                  />
                </div>

                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => setShowApproveConfirm(true)}
                  disabled={approving || rejecting}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  {approving ? 'Approving...' : 'Approve & Credit'}
                </Button>

                <div className="border-t pt-4 space-y-3">
                  <label className="text-xs uppercase text-muted-foreground font-semibold">
                    Rejection reason
                  </label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Amount doesn't match the receipt..."
                    rows={3}
                  />
                  <Button
                    variant="outline"
                    className="w-full border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => setShowRejectConfirm(true)}
                    disabled={approving || rejecting || rejectionReason.trim().length < 3}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    {rejecting ? 'Rejecting...' : 'Reject'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  This verification has been {record.status}. No further action
                  is possible.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <ValidationWarningDialog
        open={showApproveConfirm}
        onOpenChange={setShowApproveConfirm}
        title="Approve payment?"
        description={
          record.kind === 'registrationFee'
            ? `This will activate ${record.userFullName}'s account. This action can't be undone from this screen.`
            : `This will credit ${formatNaira(record.amount)} to ${record.userFullName}'s wallet. This action can't be undone from this screen.`
        }
        confirmLabel="Yes, approve"
        confirmVariant="default"
        onConfirm={handleApprove}
        loading={approving}
      />

      <ValidationWarningDialog
        open={showRejectConfirm}
        onOpenChange={setShowRejectConfirm}
        title="Reject payment?"
        description={`The user will be notified with your reason: "${rejectionReason.trim()}"`}
        confirmLabel="Yes, reject"
        confirmVariant="destructive"
        onConfirm={handleReject}
        loading={rejecting}
      />
    </div>
  );
}
