'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { TrendingUp, Search, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { Paths, formatCompactNaira, formatDate } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Investment {
  id: string;
  title?: string;
  description?: string;
  targetAmount?: number;
  raisedAmount?: number;
  returnRate?: number;
  durationMonths?: number;
  status?: string;
  participantCount?: number;
  createdAt?: { seconds: number };
  closingDate?: { seconds: number };
}

export default function InvestmentsPage() {
  const [items, setItems] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (statusFilter !== 'all') constraints.unshift(where('status', '==', statusFilter));
    const unsub = onSnapshot(
      query(collection(db, Paths.investments), ...constraints),
      snap => { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Investment))); setLoading(false); },
      err => { toast.error(err.message); setLoading(false); }
    );
    return () => unsub();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i => (i.title ?? '').toLowerCase().includes(q));
  }, [items, search]);

  function progressPct(item: Investment) {
    if (!item.targetAmount || !item.raisedAmount) return 0;
    return Math.min(Math.round((item.raisedAmount / item.targetAmount) * 100), 100);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Investments" description={`${items.length} investment plan${items.length !== 1 ? 's' : ''}`} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by title…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { if (v !== null) setStatusFilter(v) }}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="fundraising">Fundraising</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8"><EmptyState icon={TrendingUp} title="No investments found" message="Create your first investment plan." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Raised</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Return</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Closes</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => (
                  <TableRow key={item.id} className="hover:bg-muted/40">
                    <TableCell>
                      <p className="text-sm font-semibold text-slate-800">{item.title ?? '—'}</p>
                      <p className="text-xs text-slate-400">{item.durationMonths ?? '—'} months</p>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold">{formatCompactNaira(item.targetAmount)}</TableCell>
                    <TableCell className="text-right text-sm">{formatCompactNaira(item.raisedAmount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-[#C89B3C]" style={{ width: `${progressPct(item)}%` }} />
                        </div>
                        <span className="text-xs text-slate-500">{progressPct(item)}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-green-700 font-semibold">{item.returnRate ?? '—'}%</TableCell>
                    <TableCell className="text-sm">{item.participantCount ?? 0}</TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(item.closingDate)}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
