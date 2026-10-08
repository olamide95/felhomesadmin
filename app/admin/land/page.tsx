'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Map, Search, Loader2, CheckCircle2, XCircle } from 'lucide-react';
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

interface LandPlot {
  id: string;
  title?: string;
  location?: string;
  sizeSquareMeters?: number;
  price?: number;
  ownerUid?: string;
  status?: string;
  imageUrls?: string[];
  createdAt?: { seconds: number };
}

export default function LandPage() {
  const { permissions } = useAuth();
  const [items, setItems] = useState<LandPlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [approveTarget, setApproveTarget] = useState<LandPlot | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setLoading(true);
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (statusFilter !== 'all') constraints.unshift(where('status', '==', statusFilter));
    const unsub = onSnapshot(
      query(collection(db, Paths.lands), ...constraints),
      snap => { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as LandPlot))); setLoading(false); },
      err => { toast.error(err.message); setLoading(false); }
    );
    return () => unsub();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i => [i.title, i.location].filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
  }, [items, search]);

  async function approve() {
    if (!approveTarget) return;
    setWorking(true);
    try {
      await updateDoc(doc(db, Paths.lands, approveTarget.id), {
        status: 'approved', approvedAt: serverTimestamp(),
      });
      toast.success('Land plot approved');
      setApproveTarget(null);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Land Plots" description={`${items.length} listings`} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by title or location…" value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { if (v !== null) setStatusFilter(v) }}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8"><EmptyState icon={Map} title="No land plots found" message="Listings will appear here." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plot</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Listed</TableHead>
                  <TableHead>Status</TableHead>
                  {permissions?.canApproveProperties && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(item => (
                  <TableRow key={item.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {item.imageUrls?.[0] ? (
                          <img src={item.imageUrls[0]} alt="" className="h-9 w-13 rounded-md object-cover shrink-0" />
                        ) : (
                          <div className="h-9 w-13 rounded-md bg-slate-100 shrink-0 flex items-center justify-center">
                            <Map className="h-4 w-4 text-slate-300" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{item.title ?? '—'}</p>
                          <p className="text-xs text-slate-400">{item.location}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{item.sizeSquareMeters ? `${item.sizeSquareMeters} sqm` : '—'}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{formatCompactNaira(item.price)}</TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(item.createdAt)}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    {permissions?.canApproveProperties && (
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
        open={!!approveTarget} onOpenChange={o => { if (!o) setApproveTarget(null); }}
        title="Approve land plot?" description={`"${approveTarget?.title}" will go live on the app.`}
        confirmLabel="Yes, approve" onConfirm={approve} loading={working}
      />
    </div>
  );
}
