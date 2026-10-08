'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection, onSnapshot, orderBy, query, where,
  doc, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { FileText, Search, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { Paths, formatNaira, formatCompactNaira, formatDateTime, formatDate } from '@/lib/constants';
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

interface IouApplication {
  id: string;
  uid?: string;
  userFullName?: string;
  userEmail?: string;
  amountRequested?: number;
  amountApproved?: number;
  monthlyRepayment?: number;
  totalRepayable?: number;
  repaymentMonths?: number;
  purpose?: string;
  status?: string;
  rejectionReason?: string;
  createdAt?: { seconds: number };
  approvedAt?: { seconds: number };
}

export default function IouPage() {
  const { permissions } = useAuth();
  const [items, setItems] = useState<IouApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [approveTarget, setApproveTarget] = useState<IouApplication | null>(null);
  const [rejectTarget, setRejectTarget] = useState<IouApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setLoading(true);
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (statusFilter !== 'all') constraints.unshift(where('status', '==', statusFilter));
    const unsub = onSnapshot(
      query(collection(db, Paths.iouApplications), ...constraints),
      snap => { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as IouApplication))); setLoading(false); },
      err => { toast.error(err.message); setLoading(false); }
    );
    return () => unsub();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i =>
      [i.userFullName, i.userEmail, i.uid]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    );
  }, [items, search]);

  async function approve() {
    if (!approveTarget) return;
    setWorking(true);
    try {
      await runTransaction(db, async txn => {
        const appRef = doc(db, Paths.iouApplications, approveTarget.id);
        const appSnap = await txn.get(appRef);
        if (!appSnap.exists()) throw new Error('Application not found');
        const data = appSnap.data();
        if (data.status !== 'pending') throw new Error('Already processed');

        const uid = data.uid as string;
        const amount = (data.amountRequested as number) ?? 0;

        // Credit wallet
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

        // Log disbursement
        const txRef = doc(db, Paths.transactions, `iou_disburse_${approveTarget.id}`);
        txn.set(txRef, {
          uid, kind: 'iouDisbursement', direction: 'credit', status: 'completed',
          amount, title: 'IOU Disbursement',
          description: `IOU approved — ${data.repaymentMonths ?? 12} months repayment`,
          metadata: { iouId: approveTarget.id },
          createdAt: serverTimestamp(),
        });

        txn.update(appRef, { status: 'approved', approvedAt: serverTimestamp(), amountApproved: amount });
      });
      toast.success('IOU approved — wallet credited');
      setApproveTarget(null);
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
        const ref = doc(db, Paths.iouApplications, rejectTarget.id);
        const snap = await txn.get(ref);
        if (!snap.exists()) throw new Error('Not found');
        if (snap.data().status !== 'pending') throw new Error('Already processed');
        txn.update(ref, { status: 'rejected', rejectionReason: rejectReason.trim(), rejectedAt: serverTimestamp() });
      });
      toast.success('IOU application rejected');
      setRejectTarget(null); setRejectReason('');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="IOU Applications"
        description={`${items.filter(i => i.status === 'pending').length} pending review`}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by name or email…" value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8"><EmptyState icon={FileText} title="No IOU applications" message="Try a different filter." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead className="text-right">Requested</TableHead>
                  <TableHead>Repayment</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Applied</TableHead>
                  <TableHead>Status</TableHead>
                  {permissions?.canApproveIou && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => (
                  <TableRow key={item.id} className="hover:bg-muted/40">
                    <TableCell>
                      <p className="text-sm font-semibold text-slate-800">{item.userFullName ?? '—'}</p>
                      <p className="text-xs text-slate-400">{item.userEmail}</p>
                    </TableCell>
                    <TableCell className="text-right font-bold text-sm">{formatCompactNaira(item.amountRequested)}</TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {item.repaymentMonths ?? '—'} months
                      {item.monthlyRepayment && (
                        <div className="text-slate-400">{formatCompactNaira(item.monthlyRepayment)}/mo</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm max-w-[160px] truncate">{item.purpose ?? '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(item.createdAt)}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    {permissions?.canApproveIou && (
                      <TableCell className="text-right">
                        {item.status === 'pending' && (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost"
                              className="text-green-600 hover:bg-green-50 h-7 px-2 text-xs"
                              onClick={() => setApproveTarget(item)}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="ghost"
                              className="text-red-500 hover:bg-red-50 h-7 px-2 text-xs"
                              onClick={() => { setRejectTarget(item); setRejectReason(''); }}>
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

      <ValidationWarningDialog
        open={!!approveTarget} onOpenChange={o => { if (!o) setApproveTarget(null); }}
        title="Approve IOU application?"
        description={`${formatCompactNaira(approveTarget?.amountRequested)} will be disbursed to ${approveTarget?.userFullName}'s wallet immediately.`}
        confirmLabel="Yes, approve & disburse" onConfirm={approve} loading={working}
      />

      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Reject IOU application?</h3>
            <p className="text-sm text-slate-500 mb-4">This reason will be shown to the user.</p>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Insufficient wallet activity to support this loan amount."
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
