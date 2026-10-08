'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Package, Search, Loader2, CheckCircle2, XCircle } from 'lucide-react';
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
import { useAuth } from '@/lib/auth';

interface Product {
  id: string;
  name?: string;
  vendorId?: string;
  vendorName?: string;
  category?: string;
  price?: number;
  stock?: number;
  status?: string;
  imageUrls?: string[];
  createdAt?: { seconds: number };
}

export default function ProductsPage() {
  const { permissions } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (statusFilter !== 'all') constraints.unshift(where('status', '==', statusFilter));
    const unsub = onSnapshot(
      query(collection(db, Paths.products), ...constraints),
      snap => { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product))); setLoading(false); },
      err => { toast.error(err.message); setLoading(false); }
    );
    return () => unsub();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(p => [p.name, p.vendorName, p.category].filter(Boolean).some(v => String(v).toLowerCase().includes(q)));
  }, [items, search]);

  async function toggleStatus(product: Product) {
    const newStatus = product.status === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, Paths.products, product.id), { status: newStatus, updatedAt: serverTimestamp() });
      toast.success(`Product ${newStatus}`);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Products" description={`${items.length} product${items.length !== 1 ? 's' : ''}`} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by name, vendor, category…" value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8"><EmptyState icon={Package} title="No products found" message="Products listed by vendors appear here." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Status</TableHead>
                  {permissions?.canManageVendors && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(p => (
                  <TableRow key={p.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {p.imageUrls?.[0] ? (
                          <img src={p.imageUrls[0]} alt="" className="h-9 w-9 rounded-md object-cover shrink-0" />
                        ) : (
                          <div className="h-9 w-9 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-slate-300" />
                          </div>
                        )}
                        <p className="text-sm font-semibold text-slate-800">{p.name ?? '—'}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{p.vendorName ?? '—'}</TableCell>
                    <TableCell className="text-xs capitalize">{p.category ?? '—'}</TableCell>
                    <TableCell className="text-right font-semibold text-sm">{formatCompactNaira(p.price)}</TableCell>
                    <TableCell className="text-right text-sm">{p.stock ?? '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(p.createdAt)}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    {permissions?.canManageVendors && (
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost"
                          className={p.status === 'active' ? 'text-red-500 hover:bg-red-50 h-7 px-2 text-xs' : 'text-green-600 hover:bg-green-50 h-7 px-2 text-xs'}
                          onClick={() => toggleStatus(p)}>
                          {p.status === 'active' ? <><XCircle className="h-3.5 w-3.5 mr-1" />Remove</> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Restore</>}
                        </Button>
                      </TableCell>
                    )}
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
