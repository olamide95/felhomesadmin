'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection, onSnapshot, orderBy, query,
  doc, updateDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { Store, Search, Loader2, Plus, CheckCircle2, XCircle, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { Paths, formatDate } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth';

interface Vendor {
  id: string;
  storeName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  description?: string;
  category?: string;
  status?: string;
  productCount?: number;
  createdAt?: { seconds: number };
}

export default function VendorsPage() {
  const { permissions } = useAuth();
  const [items, setItems] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ storeName: '', ownerName: '', email: '', phone: '', category: '', description: '' });
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, Paths.vendors), orderBy('createdAt', 'desc')),
      snap => { setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Vendor))); setLoading(false); },
      err => { toast.error(err.message); setLoading(false); }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(v =>
      [v.storeName, v.ownerName, v.email, v.category].filter(Boolean).some(s => String(s).toLowerCase().includes(q))
    );
  }, [items, search]);

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value }));
  }

  async function saveVendor() {
    if (!form.storeName.trim()) { toast.error('Store name required'); return; }
    setWorking(true);
    try {
      if (editTarget) {
        await updateDoc(doc(db, Paths.vendors, editTarget.id), { ...form, updatedAt: serverTimestamp() });
        toast.success('Vendor updated');
        setEditTarget(null);
      } else {
        await addDoc(collection(db, Paths.vendors), { ...form, status: 'active', productCount: 0, createdAt: serverTimestamp() });
        toast.success('Vendor added');
        setAddOpen(false);
      }
      setForm({ storeName: '', ownerName: '', email: '', phone: '', category: '', description: '' });
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally {
      setWorking(false);
    }
  }

  async function toggleStatus(vendor: Vendor) {
    const newStatus = vendor.status === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, Paths.vendors, vendor.id), { status: newStatus, updatedAt: serverTimestamp() });
      toast.success(`Vendor ${newStatus}`);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    }
  }

  const VendorForm = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1"><Label className="text-xs">Store name *</Label><Input value={form.storeName} onChange={field('storeName')} /></div>
        <div className="space-y-1"><Label className="text-xs">Owner name</Label><Input value={form.ownerName} onChange={field('ownerName')} /></div>
        <div className="space-y-1"><Label className="text-xs">Email</Label><Input type="email" value={form.email} onChange={field('email')} /></div>
        <div className="space-y-1"><Label className="text-xs">Phone</Label><Input value={form.phone} onChange={field('phone')} /></div>
        <div className="space-y-1"><Label className="text-xs">Category</Label><Input value={form.category} onChange={field('category')} placeholder="e.g. Building materials" /></div>
      </div>
      <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={field('description')} rows={2} /></div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendors"
        description={`${items.length} vendor${items.length !== 1 ? 's' : ''} on the marketplace`}
        action={
          permissions?.canManageVendors ? (
            <Button onClick={() => { setForm({ storeName: '', ownerName: '', email: '', phone: '', category: '', description: '' }); setAddOpen(true); }}
              className="bg-[#C89B3C] hover:bg-[#b08832] text-white">
              <Plus className="mr-2 h-4 w-4" />Add vendor
            </Button>
          ) : undefined
        }
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input placeholder="Search vendors…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8"><EmptyState icon={Store} title="No vendors yet" message="Add your first vendor above." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead>Status</TableHead>
                  {permissions?.canManageVendors && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(v => (
                  <TableRow key={v.id} className="hover:bg-muted/40">
                    <TableCell>
                      <p className="text-sm font-semibold text-slate-800">{v.storeName}</p>
                      <p className="text-xs text-slate-400">{v.email}</p>
                    </TableCell>
                    <TableCell className="text-sm">{v.ownerName ?? '—'}</TableCell>
                    <TableCell className="text-xs capitalize">{v.category ?? '—'}</TableCell>
                    <TableCell className="text-sm">{v.productCount ?? 0}</TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(v.createdAt)}</TableCell>
                    <TableCell><StatusBadge status={v.status} /></TableCell>
                    {permissions?.canManageVendors && (
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700"
                            onClick={() => { setForm({ storeName: v.storeName ?? '', ownerName: v.ownerName ?? '', email: v.email ?? '', phone: v.phone ?? '', category: v.category ?? '', description: v.description ?? '' }); setEditTarget(v); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost"
                            className={v.status === 'active' ? 'text-red-500 hover:bg-red-50 h-7 px-2 text-xs' : 'text-green-600 hover:bg-green-50 h-7 px-2 text-xs'}
                            onClick={() => toggleStatus(v)}>
                            {v.status === 'active' ? <><XCircle className="h-3.5 w-3.5 mr-1" />Suspend</> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Activate</>}
                          </Button>
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

      {/* Add/Edit dialog */}
      <Dialog open={addOpen || !!editTarget} onOpenChange={o => { if (!o) { setAddOpen(false); setEditTarget(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editTarget ? 'Edit vendor' : 'Add vendor'}</DialogTitle>
          </DialogHeader>
          <VendorForm />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddOpen(false); setEditTarget(null); }}>Cancel</Button>
            <Button onClick={saveVendor} disabled={working} className="bg-[#C89B3C] hover:bg-[#b08832] text-white">
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : editTarget ? 'Save changes' : 'Add vendor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
