'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection, onSnapshot, orderBy, query, where,
  doc, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { Wallet, Search, Loader2, CheckCircle2, XCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { Paths, formatNaira, formatCompactNaira, formatDateTime } from '@/lib/constants';
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
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';

interface Withdrawal {
  id: string;
  uid?: string;
  amount?: number;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  status?: string;
  rejectionReason?: string;
  paymentReference?: string;
  createdAt?: { seconds: number };
  paidAt?: { seconds: number };
}

export default function WithdrawalsPage() {
  const { permissions } = useAuth();
  const [items, setItems] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [payTarget, setPayTarget] = useState<Withdrawal | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Withdrawal | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [payRef, setPayRef] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setLoading(true);
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (statusFilter !== 'all') constraints.unshift(where('status', '==', statusFilter));
    const unsub = onSnapshot(
      query(collection(db, Paths.withdrawals), ...constraints),
      snap => { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Withdrawal))); setLoading(false); },
      err => { toast.error(err.message); setLoading(false); }
    );
    return () => unsub();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(w =>
      [w.accountName, w.bankName, w.accountNumber, w.uid]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    );
  }, [items, search]);

  const pendingTotal = items
    .filter(w => w.status === 'pending')
    .reduce((s, w) => s + (w.amount ?? 0), 0);

  async function markPaid() {
    if (!payTarget) return;
    setWorking(true);
    try {
      await runTransaction(db, async txn => {
        const ref = doc(db, Paths.withdrawals, payTarget.id);
        const snap = await txn.get(ref);
        if (!snap.exists()) throw new Error('Withdrawal not found');
        if (snap.data().status !== 'pending') throw new Error('Already processed');
        txn.update(ref, {
          status: 'paid',
          paymentReference: payRef.trim() || null,
          paidAt: serverTimestamp(),
        });
      });
      toast.success('Withdrawal marked as paid');
      setPayTarget(null);
      setPayRef('');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
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
        const appRef = doc(db, Paths.withdrawals, rejectTarget.id);
        const appSnap = await txn.get(appRef);
        if (!appSnap.exists()) throw new Error('Not found');
        const data = appSnap.data();
        if (data.status !== 'pending') throw new Error('Already processed');
        // Refund to wallet
        const walletRef = doc(db, Paths.wallets, data.uid);
        const walletSnap = await txn.get(walletRef);
        const prev = (walletSnap.data()?.balance ?? 0) as number;
        txn.update(walletRef, { balance: prev + (data.amount ?? 0), updatedAt: serverTimestamp() });
        txn.update(appRef, { status: 'rejected', rejectionReason: rejectReason.trim(), rejectedAt: serverTimestamp() });
      });
      toast.success('Withdrawal rejected — amount refunded to wallet');
      setRejectTarget(null);
      setRejectReason('');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally {
      setWorking(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Withdrawals"
        description={statusFilter === 'pending' && pendingTotal > 0
          ? `${items.filter(w => w.status === 'pending').length} pending · ${formatCompactNaira(pendingTotal)} total`
          : `${items.length} records`}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by name, bank, account…" value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={Wallet} title="No withdrawals found" message="Try a different filter." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Bank details</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Status</TableHead>
                  {permissions?.canApproveWithdrawals && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(w => (
                  <TableRow key={w.id} className="hover:bg-muted/40">
                    <TableCell>
                      <p className="text-xs font-mono text-slate-500">{w.uid?.slice(0, 12)}…</p>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{w.accountName ?? '—'}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <p className="text-xs text-slate-400">{w.bankName} · {w.accountNumber}</p>
                          {w.accountNumber && (
                            <button onClick={() => copy(w.accountNumber!)}
                              className="text-slate-300 hover:text-slate-600">
                              <Copy className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="text-sm font-bold text-slate-900">{formatNaira(w.amount)}</p>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDateTime(w.createdAt)}</TableCell>
                    <TableCell>
                      <StatusBadge status={w.status} />
                      {w.paymentReference && (
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{w.paymentReference}</p>
                      )}
                      {w.rejectionReason && (
                        <p className="text-[10px] text-red-500 mt-0.5">{w.rejectionReason}</p>
                      )}
                    </TableCell>
                    {permissions?.canApproveWithdrawals && (
                      <TableCell className="text-right">
                        {w.status === 'pending' && (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost"
                              className="text-green-600 hover:bg-green-50 h-7 px-2 text-xs"
                              onClick={() => { setPayTarget(w); setPayRef(''); }}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Paid
                            </Button>
                            <Button size="sm" variant="ghost"
                              className="text-red-500 hover:bg-red-50 h-7 px-2 text-xs"
                              onClick={() => { setRejectTarget(w); setRejectReason(''); }}>
                              <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mark as paid dialog */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Mark as paid?</h3>
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-3 mb-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Amount</span>
                <span className="font-bold text-slate-900">{formatNaira(payTarget.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bank</span>
                <span className="font-medium">{payTarget.bankName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Account</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-medium">{payTarget.accountNumber}</span>
                  <button onClick={() => copy(payTarget.accountNumber!)} className="text-slate-400 hover:text-slate-700">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Account name</span>
                <span className="font-medium">{payTarget.accountName}</span>
              </div>
            </div>
            <div className="mb-4 space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Payment reference (optional)</label>
              <Input value={payRef} onChange={e => setPayRef(e.target.value)}
                placeholder="e.g. FLW-xxx or bank transfer ID" />
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
              Ensure the transfer is complete in your banking app before clicking confirm.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPayTarget(null)}>Cancel</Button>
              <Button onClick={markPaid} disabled={working}
                className="bg-green-600 hover:bg-green-700 text-white">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm — mark paid'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reject dialog */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Reject withdrawal?</h3>
            <p className="text-sm text-slate-500 mb-4">
              {formatNaira(rejectTarget.amount)} will be refunded to the user's wallet.
            </p>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (visible to user)…" rows={3} className="mb-4" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejectTarget(null)}>Cancel</Button>
              <Button onClick={reject} disabled={working || rejectReason.trim().length < 3}
                className="bg-red-600 hover:bg-red-700 text-white">
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject & refund'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
