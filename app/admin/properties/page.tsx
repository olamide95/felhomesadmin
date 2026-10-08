'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection, onSnapshot, orderBy, query, where,
  doc, runTransaction, serverTimestamp,
} from 'firebase/firestore';
import { Home, Search, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { Paths, formatCompactNaira, formatDate } from '@/lib/constants';
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

interface Property {
  id: string;
  title?: string;
  location?: string;
  price?: number;
  category?: string;
  status?: string;
  ownerUid?: string;
  imageUrls?: string[];
  createdAt?: { seconds: number };
  rejectionReason?: string;
}

export default function PropertiesPage() {
  const { permissions } = useAuth();
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [approveTarget, setApproveTarget] = useState<Property | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Property | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setLoading(true);
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (statusFilter !== 'all') constraints.unshift(where('status', '==', statusFilter));
    const unsub = onSnapshot(
      query(collection(db, Paths.properties), ...constraints),
      snap => { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Property))); setLoading(false); },
      err => { toast.error(err.message); setLoading(false); }
    );
    return () => unsub();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(p =>
      [p.title, p.location, p.ownerUid, p.category]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    );
  }, [items, search]);

  async function approve() {
    if (!approveTarget) return;
    setWorking(true);
    try {
      await runTransaction(db, async txn => {
        const ref = doc(db, Paths.properties, approveTarget.id);
        const snap = await txn.get(ref);
        if (!snap.exists()) throw new Error('Property not found');
        txn.update(ref, { status: 'approved', approvedAt: serverTimestamp() });
      });
      toast.success('Property approved and now live');
      setApproveTarget(null);
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
        const ref = doc(db, Paths.properties, rejectTarget.id);
        txn.update(ref, { status: 'rejected', rejectionReason: rejectReason.trim(), rejectedAt: serverTimestamp() });
      });
      toast.success('Property rejected');
      setRejectTarget(null);
      setRejectReason('');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally {
      setWorking(false);
    }
  }

  const pendingCount = items.filter(p => p.status === 'pending').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Properties"
        description={`${items.length} listing${items.length !== 1 ? 's' : ''}${statusFilter === 'pending' && pendingCount > 0 ? ` · ${pendingCount} need review` : ''}`}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by title, location…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { if (v !== null) setStatusFilter(v) }}>
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
            <div className="p-8"><EmptyState icon={Home} title="No properties found" message="Try a different filter." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  {permissions?.canApproveProperties && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {p.imageUrls?.[0] ? (
                          <img src={p.imageUrls[0]} alt="" className="h-9 w-13 rounded-md object-cover shrink-0" />
                        ) : (
                          <div className="h-9 w-13 rounded-md bg-slate-100 shrink-0 flex items-center justify-center">
                            <Home className="h-4 w-4 text-slate-300" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-slate-800 max-w-[200px] truncate">{p.title ?? '—'}</p>
                          <p className="text-xs text-slate-400 truncate">{p.location}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm capitalize">{p.category}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{formatCompactNaira(p.price)}</TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(p.createdAt)}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    {permissions?.canApproveProperties && (
                      <TableCell className="text-right">
                        {p.status === 'pending' && (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" className="text-green-600 hover:bg-green-50 h-7 px-2"
                              onClick={() => setApproveTarget(p)}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50 h-7 px-2"
                              onClick={() => { setRejectTarget(p); setRejectReason(''); }}>
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
        title="Approve this property?"
        description={`"${approveTarget?.title}" will go live on the app and be visible to all users.`}
        confirmLabel="Yes, approve" onConfirm={approve} loading={working}
      />

      {/* Reject dialog */}
      {rejectTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Reject property?</h3>
            <p className="text-sm text-slate-500 mb-4">"{rejectTarget.title}" — this reason will be shown to the user.</p>
            <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Photos are unclear. Please retake in good lighting and resubmit."
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
