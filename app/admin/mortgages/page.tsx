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
import { Badge } from '@/components/ui/badge';
import { Loader2, Landmark } from 'lucide-react';

interface MortgageApp {
  id: string;
  uid: string;
  userFullName: string;
  userEmail: string;
  userPhone: string;
  propertyId: string;
  propertyTitle: string;
  propertyPrice: number;
  lenderName: string;
  downPaymentAvailable: number;
  desiredTenureYears: number;
  processingFeePaid: number;
  currentStage: string;
  createdAt: { seconds: number } | null;
  updatedAt: { seconds: number } | null;
}

const STAGE_OPTIONS = [
  { value: 'active', label: 'In progress' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'documentsReceived', label: 'Documents received' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'bankContacted', label: 'Bank contacted' },
  { value: 'awaitingBankResponse', label: 'Awaiting bank' },
  { value: 'bankApproved', label: 'Bank approved' },
  { value: 'bankDeclined', label: 'Bank declined' },
  { value: 'disbursed', label: 'Disbursed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All' },
];

const ACTIVE_STAGES = [
  'submitted',
  'documentsReceived',
  'reviewing',
  'bankContacted',
  'awaitingBankResponse',
  'bankApproved',
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

function stageLabel(s: string): string {
  const opt = STAGE_OPTIONS.find((o) => o.value === s);
  return opt?.label ?? s;
}

function stageColor(s: string): string {
  if (s === 'disbursed' || s === 'bankApproved') return 'bg-green-100 text-green-800';
  if (s === 'bankDeclined' || s === 'cancelled') return 'bg-red-100 text-red-800';
  return 'bg-amber-100 text-amber-800';
}

export default function MortgagesPage() {
  const [items, setItems] = useState<MortgageApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState('active');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);

    let q;
    if (stageFilter === 'active') {
      q = query(
        collection(db, 'mortgage_applications'),
        where('currentStage', 'in', ACTIVE_STAGES),
        orderBy('updatedAt', 'desc')
      );
    } else if (stageFilter === 'all') {
      q = query(
        collection(db, 'mortgage_applications'),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'mortgage_applications'),
        where('currentStage', '==', stageFilter),
        orderBy('updatedAt', 'desc')
      );
    }

    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<MortgageApp, 'id'>),
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
  }, [stageFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase().trim();
    return items.filter((i) =>
      [i.userFullName, i.userEmail, i.propertyTitle, i.lenderName, i.uid]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [items, search]);

  const activeCount = items.filter((i) =>
    ACTIVE_STAGES.includes(i.currentStage)
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mortgage Applications"
        description="Process user mortgage applications through the timeline"
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Input
            placeholder="Search by user, property, or lender..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
                {o.value === 'active' && activeCount > 0 && (
                  <span className="ml-2 text-amber-600 font-semibold">
                    ({activeCount})
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
                icon={Landmark}
                title="No applications found"
                message="No mortgage applications match your filters."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Submitted</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Lender</TableHead>
                  <TableHead className="text-right">Down payment</TableHead>
                  <TableHead>Stage</TableHead>
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
                      <div className="font-medium">{app.userFullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {app.userEmail}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {app.userPhone}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{app.propertyTitle}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatNaira(app.propertyPrice)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{app.lenderName}</TableCell>
                    <TableCell className="text-right text-sm">
                      {formatNaira(app.downPaymentAvailable)}
                      <div className="text-xs text-muted-foreground">
                        {app.desiredTenureYears} yrs
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={stageColor(app.currentStage)}>
                        {stageLabel(app.currentStage)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/mortgages/${app.id}`}
                        className="text-sm font-semibold text-amber-700 hover:text-amber-900"
                      >
                        Manage →
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
