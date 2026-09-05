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
import { Loader2, ReceiptText } from 'lucide-react';

interface PaymentVerification {
  id: string;
  uid: string;
  userFullName: string;
  userEmail: string;
  kind: string;
  kindLabel: string;
  amount: number;
  bankName: string;
  senderAccountName: string;
  senderAccountNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  receiptUrl: string;
  createdAt: { seconds: number } | null;
  reviewedAt: { seconds: number } | null;
  reviewerUid?: string;
  rejectionReason?: string;
}

const KIND_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'registrationFee', label: 'Registration fee' },
  { value: 'walletFunding', label: 'Wallet top-up' },
  { value: 'propertyPurchase', label: 'Property purchase' },
  { value: 'investment', label: 'Investment' },
  { value: 'landAcquisition', label: 'Land acquisition' },
  { value: 'buildProject', label: 'Build project' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All statuses' },
];

function formatNaira(n: number | undefined): string {
  const val = typeof n === 'number' ? n : 0;
  return `₦${val.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

function formatDate(ts: { seconds: number } | null | undefined): string {
  if (!ts) return '—';
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PaymentVerificationsPage() {
  const [items, setItems] = useState<PaymentVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [kindFilter, setKindFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);

    const constraints = [orderBy('createdAt', 'desc')];
    if (statusFilter !== 'all') {
      constraints.unshift(where('status', '==', statusFilter) as any);
    }
    if (kindFilter !== 'all') {
      constraints.unshift(where('kind', '==', kindFilter) as any);
    }

    const q = query(collection(db, 'payment_verifications'), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PaymentVerification, 'id'>),
        }));
        setItems(list);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [statusFilter, kindFilter]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter((i) =>
      [
        i.userFullName,
        i.userEmail,
        i.senderAccountName,
        i.senderAccountNumber,
        i.bankName,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  const pendingCount = items.filter((i) => i.status === 'pending').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Verifications"
        description="Review and approve bank transfer receipts submitted by users"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search by user name, email, or account number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
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
        <Select value={kindFilter} onValueChange={setKindFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
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
              Error loading verifications: {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={ReceiptText}
                title="No verifications found"
                message={
                  statusFilter === 'pending'
                    ? 'All caught up — no receipts waiting for review.'
                    : 'No records match your filters.'
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>For</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Sender</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((v) => (
                  <TableRow key={v.id} className="hover:bg-muted/40">
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDate(v.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{v.userFullName || '—'}</div>
                      <div className="text-xs text-muted-foreground">
                        {v.userEmail}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{v.kindLabel}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatNaira(v.amount)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{v.senderAccountName}</div>
                      <div className="text-xs text-muted-foreground">
                        {v.bankName} · {v.senderAccountNumber}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={v.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/payment-verifications/${v.id}`}
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
