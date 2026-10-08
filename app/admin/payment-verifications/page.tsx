'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection, onSnapshot, orderBy, query, where,
  doc, runTransaction, serverTimestamp, FieldValue,
} from 'firebase/firestore';
import { CreditCard, Search, Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { Paths, formatNaira, formatDateTime } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { ValidationWarningDialog } from '@/components/shared/validation-warning-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth';

interface Verification {
  id: string;
  uid?: string;
  userFullName?: string;
  userEmail?: string;
  kind?: string;
  kindLabel?: string;
  amount?: number;
  bankName?: string;
  senderAccountName?: string;
  senderAccountNumber?: string;
  transferDate?: string;
  notes?: string;
  receiptUrl?: string;
  status?: string;
  rejectionReason?: string;
  approvalNote?: string;
  createdAt?: { seconds: number };
}

export default function PaymentVerificationsPage() {
  const { permissions } = useAuth();
  const [items, setItems] = useState<Verification[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [approveTarget, setApproveTarget] = useState<Verification | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Verification | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setLoading(true);
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (statusFilter !== 'all') constraints.unshift(where('status', '==', statusFilter));
    const unsub = onSnapshot(
      query(collection(db, Paths.paymentVerifications), ...constraints),
      snap => { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Verification))); setLoading(false); },
      err => { toast.error(err.message); setLoading(false); }
    );
    return () => unsub();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(v =>
      [v.userFullName, v.userEmail, v.senderAccountName, v.bankName]
        .filter(Boolean).some(s => String(s).toLowerCase().includes(q))
    );
  }, [items, search]);

  async function approve() {
    if (!approveTarget) return;
    setWorking(true);
    try {
      await runTransaction(db, async txn => {
        const verRef = doc(db, Paths.paymentVerifications, approveTarget.id);
        const verSnap = await txn.get(verRef);
        if (!verSnap.exists()) throw new Error('Verification not found');
        const data = verSnap.data();
        if (data.status !== 'pending') throw new Error('Already processed');

        const uid = data.uid as string;
        const amount = (data.amount as number) ?? 0;
        const kind = (data.kind as string) ?? 'walletFunding';

        if (kind === 'registrationFee') {
          const userRef = doc(db, Paths.users, uid);
          txn.update(userRef, { registrationFeePaid: true, updatedAt: serverTimestamp() });
        } else {
          const walletRef = doc(db, Paths.wallets, uid);
          const walletSnap = await txn.get(walletRef);
          const prev = (walletSnap.data()?.balance ?? 0) as number;
          if (walletSnap.exists()) {
            txn.update(walletRef, { balance: prev + amount, updatedAt: serverTimestamp() });
          } else {
            txn.set(walletRef, {
              balance: amount, totalEarnings: 0, referralEarnings: 0,
              sponsorEarnings: 0, investmentReturns: 0, salesEarnings: 0,
              pendingWithdrawals: 0, updatedAt: serverTimestamp(),
            });
          }
          // Log deposit transaction (triggers Drop 2 push)
          const txRef = doc(db, Paths.transactions, `verif_${approveTarget.id}`);
          txn.set(txRef, {
            uid, kind: 'deposit', direction: 'credit', status: 'completed',
            amount, title: 'Wallet Funded', description: `Bank transfer — ${data.kindLabel ?? kind}`,
            metadata: { verificationId: approveTarget.id },
            createdAt: serverTimestamp(),
          });
        }

        txn.update(verRef, {
          status: 'approved',
          approvalNote: approvalNote.trim() || null,
          reviewedAt: serverTimestamp(),
        });
      });
      toast.success('Payment approved — wallet credited');
      setApproveTarget(null);
      setApprovalNote('');
    } catch (e: any) {
      toast.error(e.message ?? 'Approval failed');
    } finally {
      setWorking(false);
    }
  }

  async function reject() {
    if (!rejectTarget || rejectReason.trim().length < 3) {
      toast.error('Rejection reason required'); return;
    }
    setWorking(true);
    try {
      await runTransaction(db, async txn => {
        const verRef = doc(db, Paths.paymentVerifications, rejectTarget.id);
        const snap = await txn.get(verRef);
        if (!snap.exists()) throw new Error('Not found');
        if (snap.data().status !== 'pending') throw new Error('Already processed');
        txn.update(verRef, {
          status: 'rejected',
          rejectionReason: rejectReason.trim(),
          reviewedAt: serverTimestamp(),
        });
      });
      toast.success('Receipt rejected');
      setRejectTarget(null);
      setRejectReason('');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Verifications"
        description="Bank transfer receipts submitted by users"
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by name, bank…" value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8"><EmptyState icon={CreditCard} title="No verifications found" message="Try a different filter." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sender details</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  {permissions?.canApprovePayments && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(v => (
                  <TableRow key={v.id} className="hover:bg-muted/40">
                    <TableCell>
                      <p className="text-sm font-semibold text-slate-800">{v.userFullName ?? '—'}</p>
                      <p className="text-xs text-slate-400">{v.userEmail}</p>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{v.kindLabel ?? v.kind ?? '—'}</TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{v.senderAccountName ?? '—'}</p>
                      <p className="text-xs text-slate-400">{v.bankName} · {v.senderAccountNumber}</p>
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm">{formatNaira(v.amount)}</TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDateTime(v.createdAt)}</TableCell>
                    <TableCell>
                      <StatusBadge status={v.status} />
                      {v.rejectionReason && (
                        <p className="text-[10px] text-red-500 mt-0.5">{v.rejectionReason}</p>
                      )}
                    </TableCell>
                    {permissions?.canApprovePayments && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {v.receiptUrl && (
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-slate-400"
                              onClick={() => window.open(v.receiptUrl, '_blank')}>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {v.status === 'pending' && (
                            <>
                              <Button size="sm" variant="ghost"
                                className="text-green-600 hover:bg-green-50 h-7 px-2 text-xs"
                                onClick={() => { setApproveTarget(v); setApprovalNote(''); }}>
                                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                              </Button>
                              <Button size="sm" variant="ghost"
                                className="text-red-500 hover:bg-red-50 h-7 px-2 text-xs"
                                onClick={() => { setRejectTarget(v); setRejectReason(''); }}>
                                <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Approve dialog */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Approve & Credit?</h3>
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 mb-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">User</span>
                <span className="font-medium">{approveTarget.userFullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount</span>
                <span className="font-bold text-green-700">{formatNaira(approveTarget.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Type</span>
                <span className="capitalize">{approveTarget.kindLabel ?? approveTarget.kind}</span>
              </div>
            </div>
            {approveTarget.receiptUrl && (
              <Button variant="outline" className="w-full mb-4 text-xs"
                onClick={() => window.open(approveTarget.receiptUrl, '_blank')}>
                <ExternalLink className="mr-2 h-3.5 w-3.5" />View receipt image
              </Button>
            )}
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              Confirm this matches your bank statement before approving.
            </p>
            <div className="mb-4 space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Approval note (optional)</label>
              <Input value={approvalNote} onChange={e => setApprovalNote(e.target.value)} placeholder="Internal note…" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setApproveTarget(null)}>Cancel</Button>
              <Button onClick={approve} disabled={working} className="bg-green-600 hover:bg-green-700 text-white">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve & Credit'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Reject receipt?</h3>
            <p className="text-sm text-slate-500 mb-4">This reason will be shown to the user.</p>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Amount on receipt does not match. Please resubmit the correct receipt."
              rows={3} className="mb-4" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
              <Button onClick={reject} disabled={working || rejectReason.trim().length < 3}
                className="bg-red-600 hover:bg-red-700 text-white">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
