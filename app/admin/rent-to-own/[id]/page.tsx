'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  doc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { ValidationWarningDialog } from '@/components/shared/validation-warning-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  User as UserIcon,
  Home,
  AlertTriangle,
} from 'lucide-react';

interface RtoApp {
  id: string;
  uid: string;
  userFullName: string;
  userEmail: string;
  propertyId: string;
  propertyTitle: string;
  propertyPrice: number;
  tenureYears: number;
  interestPercent: number;
  deposit: number;
  balance: number;
  annualBase: number;
  annualInterest: number;
  annualInstalment: number;
  totalPaid: number;
  totalInterest: number;
  schedule: Array<{
    yearNumber: number;
    amountDue: number;
    dueDate: { seconds: number };
    status: string;
    paidAt?: { seconds: number };
    amountPaid?: number;
  }>;
  status: string;
  createdAt: { seconds: number } | null;
  approvedAt: { seconds: number } | null;
  cancelledAt: { seconds: number } | null;
  cancellationReason?: string;
  adminNote?: string;
  sponsorUid?: string;
}

function formatNaira(n: number | undefined): string {
  const v = typeof n === 'number' ? n : 0;
  return `₦${v.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const PLATFORM_UID = '_platform';
const REFERRER_SHARE = 0.05;

export default function RtoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<RtoApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [adminNote, setAdminNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [forfeitReason, setForfeitReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'rent_to_own_applications', id),
      (snap) => {
        if (!snap.exists()) {
          setApp(null);
        } else {
          setApp({ id: snap.id, ...(snap.data() as Omit<RtoApp, 'id'>) });
        }
        setLoading(false);
      },
      (err) => {
        toast.error(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [id]);

  async function handleApprove() {
    if (!app) return;
    const admin = auth.currentUser;
    if (!admin) {
      toast.error('You must be signed in.');
      return;
    }

    setProcessing(true);
    try {
      await runTransaction(db, async (txn) => {
        const appRef = doc(db, 'rent_to_own_applications', app.id);
        const appSnap = await txn.get(appRef);
        if (!appSnap.exists()) throw new Error('Application not found.');
        const cur = appSnap.data();
        if (cur.status !== 'pending') {
          throw new Error(`Already ${cur.status}.`);
        }

        // Read property
        const propRef = doc(db, 'properties', app.propertyId);
        const propSnap = await txn.get(propRef);
        if (!propSnap.exists()) throw new Error('Property missing.');

        // Read sponsor + wallet if applicable
        const sponsorUid = app.sponsorUid;
        const payReferral =
          sponsorUid &&
          sponsorUid.length > 0 &&
          sponsorUid !== PLATFORM_UID &&
          sponsorUid !== app.uid;

        let sponsorWalletRef: any = null;
        let sponsorWalletSnap: any = null;
        let sponsorUserSnap: any = null;
        if (payReferral) {
          sponsorWalletRef = doc(db, 'wallets', sponsorUid!);
          sponsorWalletSnap = await txn.get(sponsorWalletRef);
          sponsorUserSnap = await txn.get(doc(db, 'users', sponsorUid!));
        }

        // Update app
        txn.update(appRef, {
          status: 'active',
          approvedAt: serverTimestamp(),
          adminNote: adminNote.trim() || null,
        });

        // Update property
        txn.update(propRef, {
          availability: 'sold_rto',
          soldToUid: app.uid,
          soldAt: serverTimestamp(),
        });

        // Pay referrer if eligible
        if (payReferral && sponsorWalletSnap) {
          const refActive =
            (sponsorUserSnap?.data()?.accountActive as boolean) ?? true;
          const refSuspended =
            (sponsorUserSnap?.data()?.suspended as boolean) ?? false;

          if (refActive && !refSuspended) {
            const commission = app.deposit * REFERRER_SHARE;
            const prevBalance =
              (sponsorWalletSnap.data()?.balance as number) ?? 0;
            const prevReferral =
              (sponsorWalletSnap.data()?.referralEarnings as number) ?? 0;
            const prevTotal =
              (sponsorWalletSnap.data()?.totalEarnings as number) ?? 0;

            if (sponsorWalletSnap.exists()) {
              txn.update(sponsorWalletRef, {
                balance: prevBalance + commission,
                referralEarnings: prevReferral + commission,
                totalEarnings: prevTotal + commission,
                updatedAt: serverTimestamp(),
              });
            } else {
              txn.set(sponsorWalletRef, {
                balance: commission,
                referralEarnings: commission,
                sponsorEarnings: 0,
                investmentReturns: 0,
                salesEarnings: 0,
                totalEarnings: commission,
                pendingWithdrawals: 0,
                updatedAt: serverTimestamp(),
              });
            }

            const txRef = doc(db, 'transactions', `rto_referral_${app.id}`);
            txn.set(txRef, {
              uid: sponsorUid,
              kind: 'referralCommission',
              direction: 'credit',
              status: 'completed',
              amount: commission,
              title: 'Rent-to-Own Referral Commission',
              description: `New RTO buyer on ${app.propertyTitle}`,
              metadata: {
                applicationId: app.id,
                buyerUid: app.uid,
                propertyId: app.propertyId,
              },
              createdAt: serverTimestamp(),
            });
          }
        }
      });

      toast.success('Application approved and property marked sold.');
      setShowApproveConfirm(false);
      setAdminNote('');
    } catch (e: any) {
      toast.error(e.message || 'Approval failed.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleReject() {
    if (!app) return;
    if (rejectionReason.trim().length < 3) {
      toast.error('Rejection reason required.');
      return;
    }

    setProcessing(true);
    try {
      await runTransaction(db, async (txn) => {
        const appRef = doc(db, 'rent_to_own_applications', app.id);
        const appSnap = await txn.get(appRef);
        if (!appSnap.exists()) throw new Error('Application not found.');
        if (appSnap.data().status !== 'pending') {
          throw new Error(`Already ${appSnap.data().status}.`);
        }

        // Refund deposit
        const walletRef = doc(db, 'wallets', app.uid);
        const walletSnap = await txn.get(walletRef);
        const prev = (walletSnap.data()?.balance as number) ?? 0;

        // Release property
        const propRef = doc(db, 'properties', app.propertyId);

        txn.update(appRef, {
          status: 'rejected',
          cancelledAt: serverTimestamp(),
          cancellationReason: rejectionReason.trim(),
        });

        if (walletSnap.exists()) {
          txn.update(walletRef, {
            balance: prev + app.deposit,
            updatedAt: serverTimestamp(),
          });
        } else {
          txn.set(walletRef, {
            balance: app.deposit,
            totalEarnings: 0,
            referralEarnings: 0,
            sponsorEarnings: 0,
            investmentReturns: 0,
            salesEarnings: 0,
            pendingWithdrawals: 0,
            updatedAt: serverTimestamp(),
          });
        }

        txn.update(propRef, {
          availability: 'available',
          updatedAt: serverTimestamp(),
        });

        const refundRef = doc(db, 'transactions', `rto_refund_${app.id}`);
        txn.set(refundRef, {
          uid: app.uid,
          kind: 'refund',
          direction: 'credit',
          status: 'completed',
          amount: app.deposit,
          title: 'RTO Deposit Refund',
          description: `Application rejected: ${rejectionReason.trim()}`,
          metadata: { applicationId: app.id },
          createdAt: serverTimestamp(),
        });
      });

      toast.success('Application rejected and deposit refunded.');
      setShowRejectConfirm(false);
      setRejectionReason('');
    } catch (e: any) {
      toast.error(e.message || 'Rejection failed.');
    } finally {
      setProcessing(false);
    }
  }

  async function handleForfeit() {
    if (!app) return;
    if (forfeitReason.trim().length < 3) {
      toast.error('Forfeit reason required.');
      return;
    }

    setProcessing(true);
    try {
      await runTransaction(db, async (txn) => {
        const appRef = doc(db, 'rent_to_own_applications', app.id);
        const appSnap = await txn.get(appRef);
        if (!appSnap.exists()) throw new Error('Application not found.');
        if (appSnap.data().status !== 'active') {
          throw new Error('Only active applications can be forfeited.');
        }

        const propRef = doc(db, 'properties', app.propertyId);

        txn.update(appRef, {
          status: 'cancelled',
          cancelledAt: serverTimestamp(),
          cancellationReason: forfeitReason.trim(),
        });

        txn.update(propRef, {
          availability: 'available',
          soldToUid: null,
          soldAt: null,
          updatedAt: serverTimestamp(),
        });
      });

      toast.success('Application cancelled. Payments made are forfeited.');
      setShowForfeitConfirm(false);
      setForfeitReason('');
    } catch (e: any) {
      toast.error(e.message || 'Cancellation failed.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="space-y-6">
        <PageHeader title="Application not found" description="" />
        <Link href="/admin/rent-to-own">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>
    );
  }

  const paidCount = app.schedule.filter((p) => p.status === 'paid').length;
  const totalReceived =
    app.deposit +
    app.schedule
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amountPaid ?? p.amountDue), 0);

  return (
    <div className="space-y-6">
      <Link
        href="/admin/rent-to-own"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" />
        All applications
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {app.propertyTitle}
            <StatusBadge status={app.status} />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatNaira(app.propertyPrice)} · {app.tenureYears}-year plan ·
            Submitted {formatDate(app.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                Buyer
              </h2>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                  <UserIcon className="h-5 w-5 text-amber-700" />
                </div>
                <div>
                  <div className="font-semibold">{app.userFullName}</div>
                  <div className="text-sm text-muted-foreground">
                    {app.userEmail}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 font-mono">
                    uid: {app.uid}
                  </div>
                  {app.sponsorUid && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Sponsor: {app.sponsorUid.slice(0, 12)}… (5% of deposit on approval)
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                Payment breakdown
              </h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Property</div>
                  <div className="font-semibold">
                    {formatNaira(app.propertyPrice)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Interest</div>
                  <div className="font-semibold">
                    {(app.interestPercent * 100).toFixed(0)}%/yr
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Deposit</div>
                  <div className="font-semibold text-amber-700">
                    {formatNaira(app.deposit)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Balance</div>
                  <div className="font-semibold">
                    {formatNaira(app.balance)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Annual base
                  </div>
                  <div className="font-semibold">
                    {formatNaira(app.annualBase)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Annual interest
                  </div>
                  <div className="font-semibold">
                    {formatNaira(app.annualInterest)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Annual instalment
                  </div>
                  <div className="font-semibold text-amber-700">
                    {formatNaira(app.annualInstalment)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Total buyer pays
                  </div>
                  <div className="font-semibold text-green-700">
                    {formatNaira(app.totalPaid)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                  Payment schedule
                </h2>
                {app.status === 'active' && (
                  <div className="text-xs text-muted-foreground">
                    {paidCount}/{app.tenureYears} paid ·{' '}
                    {formatNaira(totalReceived)} received
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {app.schedule.map((p) => (
                  <div
                    key={p.yearNumber}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div className="text-sm">
                      Year {p.yearNumber} · Due{' '}
                      {formatDate(p.dueDate)}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium">
                        {formatNaira(p.amountDue)}
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column — actions */}
        <div className="space-y-4">
          {app.status === 'pending' ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                  Review
                </h2>
                <p className="text-xs text-muted-foreground">
                  Approving marks the property sold_rto and pays the buyer's
                  sponsor 5% of the deposit ({formatNaira(app.deposit * 0.05)}).
                </p>

                <Textarea
                  placeholder="Approval note (optional)"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  rows={2}
                />
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={() => setShowApproveConfirm(true)}
                  disabled={processing}
                >
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Approve
                </Button>

                <div className="border-t pt-4 space-y-2">
                  <Textarea
                    placeholder="Rejection reason (required)"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={2}
                  />
                  <Button
                    variant="outline"
                    className="w-full border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => setShowRejectConfirm(true)}
                    disabled={
                      processing || rejectionReason.trim().length < 3
                    }
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject (refund deposit)
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : app.status === 'active' ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase text-muted-foreground text-red-700">
                  Danger zone
                </h2>
                <div className="rounded-md bg-red-50 p-3 text-xs text-red-900">
                  <div className="font-semibold mb-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Cancel with forfeit
                  </div>
                  <p>
                    Use only after documented default. Buyer forfeits their
                    deposit and all payments made ({formatNaira(totalReceived)}).
                    Property returns to inventory as available.
                  </p>
                </div>
                <Textarea
                  placeholder="Reason for cancellation (required, will be visible to user)"
                  value={forfeitReason}
                  onChange={(e) => setForfeitReason(e.target.value)}
                  rows={2}
                />
                <Button
                  variant="outline"
                  className="w-full border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => setShowForfeitConfirm(true)}
                  disabled={processing || forfeitReason.trim().length < 3}
                >
                  Cancel with forfeit
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Application is {app.status}. No further action available.
                </p>
                {app.cancellationReason && (
                  <div className="mt-3 text-sm">
                    <div className="text-xs uppercase text-muted-foreground">
                      Reason
                    </div>
                    <p>{app.cancellationReason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <Link
                href={`/admin/properties/${app.propertyId}`}
                className="flex items-center gap-2 text-sm hover:text-amber-700"
              >
                <Home className="h-4 w-4" />
                View property record
              </Link>
              <Link
                href={`/admin/users/${app.uid}`}
                className="flex items-center gap-2 text-sm hover:text-amber-700 mt-2"
              >
                <UserIcon className="h-4 w-4" />
                View buyer profile
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <ValidationWarningDialog
        open={showApproveConfirm}
        onOpenChange={setShowApproveConfirm}
        title="Approve application?"
        description={`This will mark the property as sold_rto and pay the buyer's sponsor ${formatNaira(app.deposit * 0.05)}. This action cannot be undone.`}
        confirmLabel="Yes, approve"
        confirmVariant="default"
        onConfirm={handleApprove}
        loading={processing}
      />

      <ValidationWarningDialog
        open={showRejectConfirm}
        onOpenChange={setShowRejectConfirm}
        title="Reject application?"
        description={`Deposit of ${formatNaira(app.deposit)} will be refunded to the buyer's wallet. Property returns to inventory.`}
        confirmLabel="Yes, reject"
        confirmVariant="destructive"
        onConfirm={handleReject}
        loading={processing}
      />

      <ValidationWarningDialog
        open={showForfeitConfirm}
        onOpenChange={setShowForfeitConfirm}
        title="Forfeit and cancel?"
        description={`Buyer forfeits ${formatNaira(totalReceived)} paid to date. Property becomes available again. This action cannot be undone.`}
        confirmLabel="Yes, forfeit"
        confirmVariant="destructive"
        onConfirm={handleForfeit}
        loading={processing}
      />
    </div>
  );
}
