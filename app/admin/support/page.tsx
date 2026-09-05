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
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, MessageCircle, User as UserIcon } from 'lucide-react';

interface SupportThread {
  id: string;
  uid: string;
  userFullName: string;
  userEmail: string;
  lastMessageBody?: string;
  lastMessageAt: { seconds: number } | null;
  lastMessageSender?: 'user' | 'admin';
  status: 'open' | 'closed';
  adminUnreadCount: number;
  userUnreadCount: number;
}

function formatRelativeTime(ts: { seconds: number } | null | undefined): string {
  if (!ts) return '—';
  const diffMs = Date.now() - ts.seconds * 1000;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts.seconds * 1000).toLocaleDateString('en-NG');
}

export default function SupportThreadsPage() {
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'open' | 'closed' | 'all' | 'unread'>('open');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    const constraints: any[] = [orderBy('lastMessageAt', 'desc')];
    if (statusFilter === 'open' || statusFilter === 'closed') {
      constraints.unshift(where('status', '==', statusFilter));
    } else if (statusFilter === 'unread') {
      constraints.unshift(where('adminUnreadCount', '>', 0));
      // Firestore requires ordering by the range-filtered field first.
      constraints.length = 0;
      constraints.push(where('adminUnreadCount', '>', 0));
      constraints.push(orderBy('adminUnreadCount', 'desc'));
      constraints.push(orderBy('lastMessageAt', 'desc'));
    }

    const q = query(collection(db, 'support_threads'), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setThreads(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<SupportThread, 'id'>),
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
    if (!searchQuery.trim()) return threads;
    const q = searchQuery.toLowerCase().trim();
    return threads.filter((t) =>
      [t.userFullName, t.userEmail, t.uid, t.lastMessageBody]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [threads, searchQuery]);

  const unreadCount = threads.filter((t) => t.adminUnreadCount > 0).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support Threads"
        description="Reply to user messages and manage support conversations"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search by name, email, uid, or message text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unread">
              Needs reply
              {unreadCount > 0 && (
                <span className="ml-2 text-amber-600 font-semibold">
                  ({unreadCount})
                </span>
              )}
            </SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="all">All</SelectItem>
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
                icon={MessageCircle}
                title="No conversations found"
                message={
                  statusFilter === 'unread'
                    ? 'All caught up — no messages waiting for a reply.'
                    : 'No support threads match your filters.'
                }
              />
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/support/${t.id}`}
                  className="block hover:bg-muted/40 transition-colors"
                >
                  <div className="p-4 flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <UserIcon className="h-5 w-5 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="font-semibold truncate">
                          {t.userFullName || 'Unnamed user'}
                          {t.adminUnreadCount > 0 && (
                            <Badge
                              variant="default"
                              className="ml-2 bg-amber-600 hover:bg-amber-700"
                            >
                              {t.adminUnreadCount}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground shrink-0">
                          {formatRelativeTime(t.lastMessageAt)}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {t.userEmail}
                      </div>
                      {t.lastMessageBody && (
                        <div className="text-sm mt-1 line-clamp-2 text-muted-foreground">
                          {t.lastMessageSender === 'admin' && (
                            <span className="text-amber-700 font-medium">
                              You:{' '}
                            </span>
                          )}
                          {t.lastMessageBody}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
