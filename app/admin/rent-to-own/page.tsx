'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Handshake } from 'lucide-react';

interface RtoApplication {
  id: string;
  uid: string;
  userFullName: string;
  userEmail: string;
  propertyId: string;
  propertyTitle: string;
  propertyPrice: number;
  tenureYears: number;
  deposit: number;
  annualInstalment: number;
  totalPaid: number;
  status: string;
  createdAt: { seconds: number } | null;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending review' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
];

function formatNaira(n: number | undefined): string {
  const v = typeof n === 'number' ? n : 0;
  return `₦${v.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function RentToOwnPage() {
  const [items, setItems] = useState<RtoApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    const constraints: any[] = [orderBy('createdAt', 'desc')];
    if (statusFilter !== 'all') {
      constraints.unshift(where('status', '==', statusFilter));
    }
    const q = query(collection(db, 'rent_to_own_applications'), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<RtoApplication, 'id'>),
          }))
        );
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase().trim();
    return items.filter((i) =>
      [i.userFullName, i.userEmail, i.propertyTitle, i.uid]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [items, search]);

  const pendingCount = items.filter((i) => i.status === 'pending').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rent-to-Own Applications"
        description="Review, approve, or reject rent-to-own applications"
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            placeholder="Search by user, email, or property..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
                {o.value === 'pending' && pendingCount > 0 && (
                  <span className="ml-2 text-amber-600 font-semibold">
                    ({pendingCount})
                  </span>
                )}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
            </div>
          ) : error ? (
            <div className="p-8 text-center text-sm text-red-600">
              Error: {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={Handshake}
                title="No applications found"
                message={
                  statusFilter === 'pending'
                    ? 'No applications waiting for review.'
                    : 'No records match your filters.'
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-right">Deposit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((app) => (
                  <TableRow key={app.id} className="hover:bg-muted/40">
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDate(app.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{app.userFullName || '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {app.userEmail}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{app.propertyTitle}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatNaira(app.propertyPrice)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {app.tenureYears} yrs
                      <div className="text-xs text-muted-foreground">
                        {formatNaira(app.annualInstalment)}/yr
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatNaira(app.deposit)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={app.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/rent-to-own/${app.id}`}
                        className="text-sm font-semibold text-amber-700 hover:text-amber-900"
                      >
                        Review →
                      </Link>
                    </TableCell>
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
