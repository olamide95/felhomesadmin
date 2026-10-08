'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Handshake, Search, Loader2, CheckCircle2 } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/lib/auth';

interface JvProject {
  id: string;
  title?: string;
  uid?: string;
  userFullName?: string;
  userEmail?: string;
  proposedContribution?: number;
  expectedReturn?: number;
  location?: string;
  description?: string;
  status?: string;
  createdAt?: { seconds: number };
}

export default function JvPage() {
  const { permissions } = useAuth();
  const [items, setItems] = useState<JvProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [approveTarget, setApproveTarget] = useState<JvProject | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setLoading(true);
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (statusFilter !== 'all') constraints.unshift(where('status', '==', statusFilter));
    const unsub = onSnapshot(
      query(collection(db, Paths.jvProjects), ...constraints),
      snap => { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as JvProject))); setLoading(false); },
      err => { toast.error(err.message); setLoading(false); }
    );
    return () => unsub();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i =>
      [i.title, i.userFullName, i.location].filter(Boolean).some(v => String(v).toLowerCase().includes(q))
    );
  }, [items, search]);

  async function approve() {
    if (!approveTarget) return;
    setWorking(true);
    try {
      await updateDoc(doc(db, Paths.jvProjects, approveTarget.id), {
        status: 'approved', approvedAt: serverTimestamp(),
      });
      toast.success('Joint venture approved');
      setApproveTarget(null);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Joint Ventures"
        description={`${items.filter(i => i.status === 'pending').length} pending review`}
      />

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
        Joint venture approvals should be escalated to the Felhomes director before confirming. These are high-value partnership commitments.
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { if (v !== null) setStatusFilter(v) }}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8">
              <EmptyState icon={Handshake} title="No joint ventures" message="Proposals will appear here." />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proposal</TableHead>
                  <TableHead>Proposer</TableHead>
                  <TableHead className="text-right">Contribution</TableHead>
                  <TableHead className="text-right">Expected return</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  {permissions?.canManageInvestments && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => (
                  <TableRow key={item.id} className="hover:bg-muted/40">
                    <TableCell>
                      <p className="text-sm font-semibold text-slate-800">{item.title ?? '—'}</p>
                      <p className="text-xs text-slate-400">{item.location}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm">{item.userFullName ?? '—'}</p>
                      <p className="text-xs text-slate-400">{item.userEmail}</p>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">{formatCompactNaira(item.proposedContribution)}</TableCell>
                    <TableCell className="text-right text-sm text-green-700">{item.expectedReturn ? `${item.expectedReturn}%` : '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(item.createdAt)}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    {permissions?.canManageInvestments && (
                      <TableCell className="text-right">
                        {item.status === 'pending' && (
                          <Button size="sm" variant="ghost"
                            className="text-green-600 hover:bg-green-50 h-7 px-2 text-xs"
                            onClick={() => setApproveTarget(item)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                          </Button>
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
        open={!!approveTarget}
        onOpenChange={o => { if (!o) setApproveTarget(null); }}
        title="Approve joint venture?"
        description={`"${approveTarget?.title}" will be marked active. Confirm you have director approval before proceeding.`}
        confirmLabel="Yes, approve"
        onConfirm={approve}
        loading={working}
      />
    </div>
  );
}
