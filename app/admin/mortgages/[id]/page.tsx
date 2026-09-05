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
import { StatusBadge } from '@/components/status-badge';
import { ValidationWarningDialog } from '@/components/validation-warning-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Loader2,
  User as UserIcon,
  Home,
  Phone,
  Mail,
  Landmark,
  Clock,
  ArrowRight,
} from 'lucide-react';

interface TimelineEvent {
  stage: string;
  at: { seconds: number };
  note?: string;
  actorUid?: string;
  userReason?: string;
}

interface MortgageApp {
  id: string;
  uid: string;
  userFullName: string;
  userEmail: string;
  userPhone: string;
  propertyId: string;
  propertyTitle: string;
  propertyPrice: number;
  lenderName: string;
  lenderContactPerson?: string;
  lenderContactPhone?: string;
  downPaymentAvailable: number;
  desiredTenureYears: number;
  processingFeePaid: number;
  currentStage: string;
  timeline: TimelineEvent[];
  createdAt: { seconds: number } | null;
  updatedAt: { seconds: number } | null;
  feeRefundTransactionId?: string;
}

const STAGE_LABELS: Record<string, string> = {
  submitted: 'Application submitted',
  documentsReceived: 'Documents received',
  reviewing: 'Under review',
  bankContacted: 'Lender has been contacted',
  awaitingBankResponse: 'Awaiting lender response',
  bankApproved: 'Approved by lender',
  bankDeclined: 'Declined by lender',
  disbursed: 'Funds disbursed',
  cancelled: 'Cancelled',
};

const TERMINAL_STAGES = ['disbursed', 'bankDeclined', 'cancelled'];

// The order stages usually move through. Admin CAN pick any non-terminal
// stage, but this is the recommended forward path.
const NEXT_STAGE_OPTIONS: Record<string, string[]> = {
  submitted: ['documentsReceived', 'reviewing', 'bankDeclined', 'cancelled'],
  documentsReceived: ['reviewing', 'bankContacted', 'bankDeclined', 'cancelled'],
  reviewing: ['bankContacted', 'bankDeclined', 'cancelled'],
  bankContacted: ['awaitingBankResponse', 'bankApproved', 'bankDeclined'],
  awaitingBankResponse: ['bankApproved', 'bankDeclined'],
  bankApproved: ['disbursed'],
};

function formatNaira(n: number | undefined): string {
  const v = typeof n === 'number' ? n : 0;
  return `₦${v.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function formatDateTime(ts: { seconds: number } | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function stageColor(s: string): string {
  if (s === 'disbursed' || s === 'bankApproved')
    return 'bg-green-100 text-green-800 border-green-200';
  if (s === 'bankDeclined' || s === 'cancelled')
    return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-amber-100 text-amber-800 border-amber-200';
}

const PROCESSING_FEE = 500000;

export default function MortgageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [app, setApp] = useState<MortgageApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNextStage, setSelectedNextStage] = useState<string>('');
  const [note, setNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, 'mortgage_applications', id),
      (snap) => {
        if (!snap.exists()) {
          setApp(null);
        } else {
          setApp({ id: snap.id, ...(snap.data() as Omit<MortgageApp, 'id'>) });
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

  async function advanceStage() {
    if (!app || !selectedNextStage) return;
    const admin = auth.currentUser;
    if (!admin) {
      toast.error('You must be signed in.');
      return;
    }

    setProcessing(true);
    try {
      await runTransaction(db, async (txn) => {
        const appRef = doc(db, 'mortgage_applications', app.id);
        const appSnap = await txn.get(appRef);
        if (!appSnap.exists()) throw new Error('Application not found.');
        const cur = appSnap.data();

        if (TERMINAL_STAGES.includes(cur.currentStage)) {
          throw new Error('Application is already in a final state.');
        }
        if (cur.currentStage === selectedNextStage) {
          throw new Error(`Already at ${STAGE_LABELS[selectedNextStage]}.`);
        }

        const now = new Date();
        const timeline = Array.isArray(cur.timeline) ? [...cur.timeline] : [];
        timeline.push({
          stage: selectedNextStage,
          at: { seconds: Math.floor(now.getTime() / 1000), nanoseconds: 0 },
          ...(note.trim() ? { note: note.trim() } : {}),
          actorUid: admin.uid,
        });

        // Refund if declined
        if (selectedNextStage === 'bankDeclined') {
          const fee = (cur.processingFeePaid as number) ?? PROCESSING_FEE;
          const walletRef = doc(db, 'wallets', app.uid);
          const walletSnap = await txn.get(walletRef);
          const prevBalance = (walletSnap.data()?.balance as number) ?? 0;

          if (walletSnap.exists()) {
            txn.update(walletRef, {
              balance: prevBalance + fee,
              updatedAt: serverTimestamp(),
            });
          } else {
            txn.set(walletRef, {
              balance: fee,
              totalEarnings: 0,
              referralEarnings: 0,
              sponsorEarnings: 0,
              investmentReturns: 0,
              salesEarnings: 0,
              pendingWithdrawals: 0,
              updatedAt: serverTimestamp(),
            });
          }

          const refundRef = doc(
            db,
            'transactions',
            `mortgage_refund_${app.id}`
          );
          txn.set(refundRef, {
            uid: app.uid,
            kind: 'refund',
            direction: 'credit',
            status: 'completed',
            amount: fee,
            title: 'Mortgage Fee Refund',
            description: 'Refund — lender declined application',
            metadata: { applicationId: app.id },
            createdAt: serverTimestamp(),
          });

          txn.update(appRef, {
            currentStage: selectedNextStage,
            timeline,
            updatedAt: serverTimestamp(),
            feeRefundTransactionId: refundRef.id,
          });
        } else {
          txn.update(appRef, {
            currentStage: selectedNextStage,
            timeline,
            updatedAt: serverTimestamp(),
          });
        }
      });

      toast.success(`Advanced to ${STAGE_LABELS[selectedNextStage]}.`);
      setShowConfirm(false);
      setSelectedNextStage('');
      setNote('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to advance.');
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
        <Link
          href="/admin/mortgages"
          className="text-sm text-muted-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <p className="text-muted-foreground">Application not found.</p>
      </div>
    );
  }

  const isTerminal = TERMINAL_STAGES.includes(app.currentStage);
  const nextOptions = NEXT_STAGE_OPTIONS[app.currentStage] ?? [];
  const willRefund = selectedNextStage === 'bankDeclined';

  return (
    <div className="space-y-6">
      <Link
        href="/admin/mortgages"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" />
        All mortgages
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {app.propertyTitle}
            <Badge className={stageColor(app.currentStage)}>
              {STAGE_LABELS[app.currentStage]}
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {formatNaira(app.propertyPrice)} · via {app.lenderName} · Submitted{' '}
            {formatDateTime(app.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                Applicant
              </h2>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <UserIcon className="h-5 w-5 text-amber-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{app.userFullName}</div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {app.userEmail}
                  </div>
                  {app.userPhone && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {app.userPhone}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1 font-mono">
                    uid: {app.uid}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                Lender & finances
              </h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Landmark className="h-3 w-3" />
                    Lender
                  </div>
                  <div className="font-medium">{app.lenderName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Property price
                  </div>
                  <div className="font-medium">
                    {formatNaira(app.propertyPrice)}
                  </div>
                </div>
                {app.lenderContactPerson && (
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Contact at lender
                    </div>
                    <div className="font-medium">
                      {app.lenderContactPerson}
                    </div>
                  </div>
                )}
                {app.lenderContactPhone && (
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Lender phone
                    </div>
                    <div className="font-medium">
                      {app.lenderContactPhone}
                    </div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground">
                    Down payment available
                  </div>
                  <div className="font-medium">
                    {formatNaira(app.downPaymentAvailable)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Desired tenure
                  </div>
                  <div className="font-medium">
                    {app.desiredTenureYears} years
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">
                    Processing fee paid
                  </div>
                  <div className="font-medium text-amber-700">
                    {formatNaira(app.processingFeePaid)}
                  </div>
                </div>
                {app.feeRefundTransactionId && (
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Fee refunded
                    </div>
                    <div className="font-mono text-xs">
                      {app.feeRefundTransactionId}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-4">
                Timeline
              </h2>
              <div className="space-y-1">
                {[...(app.timeline ?? [])].reverse().map((event, i, arr) => {
                  const isCurrent = i === 0;
                  const isLast = i === arr.length - 1;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div
                          className={`h-3 w-3 rounded-full border-2 ${
                            isCurrent
                              ? stageColor(event.stage).split(' ')[0].replace('bg-', 'bg-').replace('-100', '-500')
                              : 'bg-muted border-muted-foreground/30'
                          }`}
                          style={
                            isCurrent
                              ? { backgroundColor: 'currentColor' }
                              : undefined
                          }
                        />
                        {!isLast && (
                          <div className="w-px flex-1 bg-border my-1" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-semibold ${
                              isCurrent ? 'text-foreground' : 'text-muted-foreground'
                            }`}
                          >
                            {STAGE_LABELS[event.stage] || event.stage}
                          </span>
                          {isCurrent && (
                            <Badge variant="outline" className="text-[10px]">
                              current
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {formatDateTime(event.at)}
                        </div>
                        {event.note && (
                          <p className="text-sm mt-1">{event.note}</p>
                        )}
                        {event.userReason && (
                          <p className="text-xs italic text-muted-foreground mt-1">
                            User reason: {event.userReason}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column — action panel */}
        <div className="space-y-4">
          {isTerminal ? (
            <Card>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">
                  Application is in a final state ({STAGE_LABELS[app.currentStage]}).
                  No further action available.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 space-y-4">
                <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                  Advance stage
                </h2>
                <p className="text-xs text-muted-foreground">
                  Currently at: <strong>{STAGE_LABELS[app.currentStage]}</strong>
                </p>

                <div>
                  <label className="text-xs uppercase font-semibold text-muted-foreground">
                    Move to
                  </label>
                  <Select
                    value={selectedNextStage}
                    onValueChange={setSelectedNextStage}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Choose next stage..." />
                    </SelectTrigger>
                    <SelectContent>
                      {nextOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STAGE_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs uppercase font-semibold text-muted-foreground">
                    Note (optional, visible to user)
                  </label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Called Mr. Adegbite at 3pm, he will update us Friday"
                    rows={2}
                    className="mt-1"
                  />
                </div>

                {willRefund && (
                  <div className="rounded-md bg-red-50 border border-red-200 p-3 text-xs text-red-900">
                    Marking as declined will automatically refund{' '}
                    {formatNaira(app.processingFeePaid)} to the user's wallet.
                  </div>
                )}

                <Button
                  className="w-full bg-amber-600 hover:bg-amber-700"
                  onClick={() => setShowConfirm(true)}
                  disabled={processing || !selectedNextStage}
                >
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Advance
                </Button>
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
                View applicant profile
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      <ValidationWarningDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title={`Move to ${STAGE_LABELS[selectedNextStage] || 'this stage'}?`}
        description={
          willRefund
            ? `This will mark the application as declined AND refund ${formatNaira(app.processingFeePaid)} to the user's wallet. Cannot be undone.`
            : `This will move the application to "${STAGE_LABELS[selectedNextStage] || selectedNextStage}" and add a timeline entry visible to the user.`
        }
        confirmLabel="Yes, advance"
        confirmVariant={willRefund ? 'destructive' : 'default'}
        onConfirm={advanceStage}
        loading={processing}
      />
    </div>
  );
}
