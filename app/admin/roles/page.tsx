'use client';

import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, orderBy, query,
  doc, setDoc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import {
  ShieldCheck, Plus, Trash2, Loader2, UserCog, AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ValidationWarningDialog } from '@/components/shared/validation-warning-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth, type AdminRole } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/constants';

const ROLE_OPTIONS: { value: AdminRole; label: string; desc: string }[] = [
  { value: 'super_admin', label: 'Super Admin', desc: 'Full access including roles and settings' },
  { value: 'admin',       label: 'Admin',       desc: 'All operations except roles and settings' },
  { value: 'moderator',   label: 'Moderator',   desc: 'Approve/reject content; no user management' },
  { value: 'viewer',      label: 'Viewer',       desc: 'Read-only access' },
];

const ROLE_STYLES: Record<AdminRole, string> = {
  super_admin: 'bg-purple-100 text-purple-800 border-purple-200',
  admin:       'bg-amber-100 text-amber-800 border-amber-200',
  moderator:   'bg-blue-100 text-blue-800 border-blue-200',
  viewer:      'bg-slate-100 text-slate-700 border-slate-200',
};

interface AdminDoc {
  id: string;
  email?: string;
  displayName?: string;
  role: AdminRole;
  createdAt?: { seconds: number };
  addedBy?: string;
}

export default function RolesPage() {
  const { adminUser, role: myRole } = useAuth();
  const [admins, setAdmins] = useState<AdminDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminDoc | null>(null);
  const [editTarget, setEditTarget] = useState<AdminDoc | null>(null);
  const [working, setWorking] = useState(false);

  // Add form state
  const [newUid, setNewUid] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('moderator');

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'admins'), orderBy('createdAt', 'desc')),
      (snap) => {
        setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminDoc)));
        setLoading(false);
      },
      (err) => { toast.error(err.message); setLoading(false); }
    );
    return () => unsub();
  }, []);

  const isSuperAdmin = myRole === 'super_admin';

  async function handleAdd() {
    if (!newUid.trim()) { toast.error('UID is required'); return; }
    if (!newEmail.trim()) { toast.error('Email is required'); return; }
    setWorking(true);
    try {
      await setDoc(doc(db, 'admins', newUid.trim()), {
        email: newEmail.trim(),
        displayName: newName.trim() || newEmail.trim().split('@')[0],
        role: newRole,
        createdAt: serverTimestamp(),
        addedBy: adminUser?.uid,
      });
      toast.success('Admin added successfully');
      setAddOpen(false);
      setNewUid(''); setNewEmail(''); setNewName(''); setNewRole('moderator');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to add admin');
    } finally {
      setWorking(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.id === adminUser?.uid) { toast.error("You can't remove yourself"); return; }
    setWorking(true);
    try {
      await deleteDoc(doc(db, 'admins', deleteTarget.id));
      toast.success('Admin removed');
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally {
      setWorking(false);
    }
  }

  async function handleRoleChange(adminId: string, newRole: AdminRole) {
    if (adminId === adminUser?.uid && newRole !== 'super_admin') {
      toast.error("You can't demote yourself");
      return;
    }
    try {
      await updateDoc(doc(db, 'admins', adminId), { role: newRole });
      toast.success('Role updated');
      setEditTarget(null);
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    }
  }

  if (!isSuperAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Roles & Admins" description="Manage staff access levels" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="rounded-full bg-red-100 p-3">
              <AlertTriangle className="h-6 w-6 text-red-500" />
            </div>
            <p className="font-semibold text-slate-700">Access restricted</p>
            <p className="text-sm text-slate-400">Only Super Admins can manage roles and staff accounts.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Admins"
        description={`${admins.length} staff account${admins.length !== 1 ? 's' : ''}`}
        action={
          <Button onClick={() => setAddOpen(true)} className="bg-[#C89B3C] hover:bg-[#b08832] text-white">
            <Plus className="mr-2 h-4 w-4" />
            Add admin
          </Button>
        }
      />

      {/* Role reference card */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROLE_OPTIONS.map(r => (
          <Card key={r.value} className="border-slate-100">
            <CardContent className="p-4">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold mb-2', ROLE_STYLES[r.value])}>
                <ShieldCheck className="h-3 w-3" />
                {r.label}
              </span>
              <p className="text-xs text-slate-500">{r.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">All staff accounts</CardTitle>
          <CardDescription>Click a role badge to change it</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : admins.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={UserCog} title="No admins yet" message="Add your first staff member above." />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {admins.map(a => (
                <div key={a.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#C89B3C]/10 text-[#C89B3C] text-sm font-bold">
                      {(a.displayName ?? a.email ?? 'A').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">{a.displayName ?? '—'}</p>
                        {a.id === adminUser?.uid && (
                          <Badge className="text-[9px] bg-slate-100 text-slate-500 border-slate-200">You</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{a.email} · {formatDateTime(a.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <Select value={a.role} onValueChange={(v) => handleRoleChange(a.id, v as AdminRole)}>
                      <SelectTrigger className={cn('h-7 text-[11px] font-semibold border rounded-full px-2.5 w-auto', ROLE_STYLES[a.role])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map(r => (
                          <SelectItem key={r.value} value={r.value} className="text-xs">{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {a.id !== adminUser?.uid && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-red-600"
                        onClick={() => setDeleteTarget(a)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add admin dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add staff member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              The user must already have a Firebase Auth account with this UID. Contact the tech team to get the UID.
            </div>
            <div className="space-y-1.5">
              <Label>Firebase UID <span className="text-red-500">*</span></Label>
              <Input value={newUid} onChange={e => setNewUid(e.target.value)} placeholder="xxxxxxxxxxxxxxxxxxxxxxxx" className="font-mono text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="staff@felhomes.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Amaka Okonkwo" />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={v => setNewRole(v as AdminRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <div className="font-medium">{r.label}</div>
                        <div className="text-xs text-slate-400">{r.desc}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={working} className="bg-[#C89B3C] hover:bg-[#b08832] text-white">
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ValidationWarningDialog
        open={!!deleteTarget}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
        title="Remove admin access?"
        description={`${deleteTarget?.displayName ?? deleteTarget?.email} will no longer be able to access the dashboard. This takes effect on their next login.`}
        confirmLabel="Yes, remove"
        confirmVariant="destructive"
        onConfirm={handleDelete}
        loading={working}
      />
    </div>
  );
}
