'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, onSnapshot, orderBy, query, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Users, Search, Loader2, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { Paths, formatDate, formatCompactNaira } from '@/lib/constants';
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

interface AppUser {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  registrationFeePaid?: boolean;
  accountActive?: boolean;
  suspended?: boolean;
  sponsorUid?: string;
  sponsorCode?: string;
  createdAt?: { seconds: number };
}

export default function UsersPage() {
  const { permissions } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [suspendTarget, setSuspendTarget] = useState<AppUser | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, Paths.users), orderBy('createdAt', 'desc')),
      snap => {
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
        setLoading(false);
      },
      err => { toast.error(err.message); setLoading(false); }
    );
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    let list = users;
    if (filter === 'paid') list = list.filter(u => u.registrationFeePaid);
    if (filter === 'unpaid') list = list.filter(u => !u.registrationFeePaid);
    if (filter === 'suspended') list = list.filter(u => u.suspended);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        [u.fullName, u.email, u.phone, u.id]
          .filter(Boolean).some(v => String(v).toLowerCase().includes(q))
      );
    }
    return list;
  }, [users, search, filter]);

  async function toggleSuspend() {
    if (!suspendTarget) return;
    setWorking(true);
    try {
      const nowSuspended = !suspendTarget.suspended;
      await updateDoc(doc(db, Paths.users, suspendTarget.id), {
        suspended: nowSuspended,
        accountActive: !nowSuspended,
        updatedAt: serverTimestamp(),
      });
      toast.success(nowSuspended ? 'User suspended' : 'User reinstated');
      setSuspendTarget(null);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`${users.length.toLocaleString()} registered account${users.length !== 1 ? 's' : ''}`}
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by name, email or phone…" value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All users</SelectItem>
            <SelectItem value="paid">Reg fee paid</SelectItem>
            <SelectItem value="unpaid">Fee pending</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-8"><EmptyState icon={Users} title="No users found" message="Try adjusting your search or filter." /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Reg fee</TableHead>
                  <TableHead>Status</TableHead>
                  {permissions?.canSuspendUsers && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(u => (
                  <TableRow key={u.id} className="hover:bg-muted/40">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-[#C89B3C]/10 flex items-center justify-center text-xs font-bold text-[#C89B3C] shrink-0">
                          {(u.fullName ?? u.email ?? 'U').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{u.fullName ?? '—'}</p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">{u.phone ?? '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500">{formatDate(u.createdAt)}</TableCell>
                    <TableCell>
                      <StatusBadge status={u.registrationFeePaid ? 'paid' : 'pending'} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={u.suspended ? 'suspended' : 'active'} />
                    </TableCell>
                    {permissions?.canSuspendUsers && (
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm"
                          className={u.suspended ? 'text-green-600 hover:text-green-700' : 'text-red-500 hover:text-red-700'}
                          onClick={() => setSuspendTarget(u)}>
                          <ShieldOff className="h-3.5 w-3.5 mr-1" />
                          {u.suspended ? 'Reinstate' : 'Suspend'}
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

      <ValidationWarningDialog
        open={!!suspendTarget}
        onOpenChange={o => { if (!o) setSuspendTarget(null); }}
        title={suspendTarget?.suspended ? 'Reinstate user?' : 'Suspend user?'}
        description={suspendTarget?.suspended
          ? `${suspendTarget?.fullName ?? suspendTarget?.email} will regain access to the app.`
          : `${suspendTarget?.fullName ?? suspendTarget?.email} will lose all access. They cannot log in or transact.`}
        confirmLabel={suspendTarget?.suspended ? 'Yes, reinstate' : 'Yes, suspend'}
        confirmVariant={suspendTarget?.suspended ? 'default' : 'destructive'}
        onConfirm={toggleSuspend}
        loading={working}
      />
    </div>
  );
}
