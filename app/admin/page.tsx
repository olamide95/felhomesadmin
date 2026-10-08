'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  collection, onSnapshot, query, where, orderBy, limit, getDoc, doc,
} from 'firebase/firestore';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Users, Home, Wallet, FileText, TrendingUp, HardHat,
  ArrowUpRight, Key, Landmark, CreditCard, MessageSquare,
  CheckCircle2, Clock, AlertTriangle, Activity, DollarSign,
  ArrowDownRight, Handshake,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { Paths, formatCompactNaira, formatNaira, formatDateTime } from '@/lib/constants';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/shared/status-badge';
import { cn } from '@/lib/utils';

const GOLD = '#C89B3C';
const GOLD_LIGHT = '#E8C56A';
const NAVY = '#1e3a5f';
const SUCCESS = '#16a34a';
const DANGER = '#dc2626';

// ── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label, value, icon: Icon, href, sub, urgent, trend,
}: {
  label: string; value: string | number; icon: any;
  href?: string; sub?: string; urgent?: boolean; trend?: 'up' | 'down' | 'neutral';
}) {
  const inner = (
    <Card className={cn('transition-all hover:shadow-md group', urgent && 'border-red-200 bg-red-50/50')}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 truncate">{label}</p>
            <p className={cn('text-2xl font-bold tracking-tight', urgent ? 'text-red-700' : 'text-slate-900')}>
              {value}
            </p>
            {sub && (
              <p className={cn('text-xs font-medium', urgent ? 'text-red-600' : 'text-slate-400')}>
                {urgent && <AlertTriangle className="inline h-3 w-3 mr-1" />}
                {sub}
              </p>
            )}
          </div>
          <div className={cn(
            'rounded-xl p-2.5 shrink-0',
            urgent ? 'bg-red-100 text-red-600' : 'bg-[#C89B3C]/10 text-[#C89B3C]'
          )}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        {href && (
          <div className="mt-3 flex items-center gap-1 text-xs text-slate-400 group-hover:text-[#C89B3C] transition-colors">
            View all <ArrowUpRight className="h-3 w-3" />
          </div>
        )}
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { adminUser, role } = useAuth();

  const [counts, setCounts] = useState({
    totalUsers: 0,
    totalProperties: 0, pendingProperties: 0,
    pendingWithdrawals: 0, totalWithdrawalsAmount: 0,
    pendingIou: 0,
    activeInvestments: 0,
    pendingBuildProjects: 0,
    pendingRto: 0, activeRto: 0,
    activeMortgages: 0,
    pendingReceipts: 0,
    openSupportThreads: 0,
    platformBalance: 0,
    totalTransactionVolume: 0,
  });
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [recentProperties, setRecentProperties] = useState<any[]>([]);
  const [userGrowthData, setUserGrowthData] = useState<any[]>([]);
  const [txVolumeData, setTxVolumeData] = useState<any[]>([]);
  const [propertyBreakdown, setPropertyBreakdown] = useState<any[]>([]);
  const [pendingWithdrawals, setPendingWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    const subs: Array<() => void> = [];

    subs.push(onSnapshot(collection(db, Paths.users), (snap) => {
      setCounts(c => ({ ...c, totalUsers: snap.size }));
      // Build monthly user growth from createdAt
      const byMonth: Record<string, number> = {};
      snap.docs.forEach(d => {
        const ts = d.data().createdAt as { seconds: number } | undefined;
        if (!ts) return;
        const date = new Date(ts.seconds * 1000);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        byMonth[key] = (byMonth[key] ?? 0) + 1;
      });
      const sorted = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-7);
      setUserGrowthData(sorted.map(([month, count]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-NG', { month: 'short', year: '2-digit' }),
        users: count,
      })));
    }));

    subs.push(onSnapshot(collection(db, Paths.properties), (snap) => {
      const total = snap.size;
      const pending = snap.docs.filter(d => d.data().status === 'pending').length;
      const cats: Record<string, number> = {};
      snap.docs.forEach(d => {
        const cat = d.data().category ?? 'other';
        cats[cat] = (cats[cat] ?? 0) + 1;
      });
      setCounts(c => ({ ...c, totalProperties: total, pendingProperties: pending }));
      setPropertyBreakdown(Object.entries(cats).map(([name, value]) => ({ name, value })));
    }));

    subs.push(onSnapshot(
      query(collection(db, Paths.withdrawals), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(5)),
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCounts(c => ({ ...c, pendingWithdrawals: snap.size }));
        setPendingWithdrawals(docs);
      }
    ));

    subs.push(onSnapshot(
      query(collection(db, Paths.iouApplications), where('status', '==', 'pending')),
      (snap) => setCounts(c => ({ ...c, pendingIou: snap.size }))
    ));

    subs.push(onSnapshot(
      query(collection(db, Paths.investments), where('status', '==', 'active')),
      (snap) => setCounts(c => ({ ...c, activeInvestments: snap.size }))
    ));

    subs.push(onSnapshot(
      query(collection(db, Paths.buildProjects), where('status', '==', 'pending')),
      (snap) => setCounts(c => ({ ...c, pendingBuildProjects: snap.size }))
    ));

    subs.push(onSnapshot(
      query(collection(db, Paths.rentToOwnApplications), where('status', '==', 'pending')),
      (snap) => setCounts(c => ({ ...c, pendingRto: snap.size }))
    ));

    subs.push(onSnapshot(
      query(collection(db, Paths.rentToOwnApplications), where('status', '==', 'active')),
      (snap) => setCounts(c => ({ ...c, activeRto: snap.size }))
    ));

    const ACTIVE_MORTGAGE_STAGES = ['submitted', 'documentsReceived', 'reviewing', 'bankContacted', 'awaitingBankResponse', 'bankApproved'];
    subs.push(onSnapshot(
      query(collection(db, Paths.mortgageApplications), where('currentStage', 'in', ACTIVE_MORTGAGE_STAGES)),
      (snap) => setCounts(c => ({ ...c, activeMortgages: snap.size }))
    ));

    subs.push(onSnapshot(
      query(collection(db, Paths.paymentVerifications), where('status', '==', 'pending')),
      (snap) => setCounts(c => ({ ...c, pendingReceipts: snap.size }))
    ));

    subs.push(onSnapshot(collection(db, Paths.supportThreads), (snap) => {
      const open = snap.docs.filter(d => d.data().status !== 'closed').length;
      setCounts(c => ({ ...c, openSupportThreads: open }));
    }));

    // Platform wallet
    getDoc(doc(db, Paths.wallets, '_platform')).then(snap => {
      if (snap.exists()) setCounts(c => ({ ...c, platformBalance: snap.data().balance ?? 0 }));
    });

    // Recent transactions + volume chart
    subs.push(onSnapshot(
      query(collection(db, Paths.transactions), orderBy('createdAt', 'desc'), limit(8)),
      (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setRecentTxns(docs);
        // Build volume by month
        const volByMonth: Record<string, { credits: number; debits: number }> = {};
        docs.forEach((t: any) => {
          if (!t.createdAt) return;
          const date = new Date(t.createdAt.seconds * 1000);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (!volByMonth[key]) volByMonth[key] = { credits: 0, debits: 0 };
          const amount = t.amount ?? 0;
          if (t.direction === 'credit') volByMonth[key].credits += amount;
          else volByMonth[key].debits += amount;
        });
        const sorted = Object.entries(volByMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-6);
        setTxVolumeData(sorted.map(([month, vals]) => ({
          month: new Date(month + '-01').toLocaleDateString('en-NG', { month: 'short' }),
          credits: vals.credits,
          debits: vals.debits,
        })));
      }
    ));

    // Recent properties
    subs.push(onSnapshot(
      query(collection(db, Paths.properties), orderBy('createdAt', 'desc'), limit(5)),
      (snap) => setRecentProperties(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ));

    return () => subs.forEach(u => u());
  }, []);

  const PIE_COLORS = [GOLD, NAVY, '#60a5fa', '#34d399', '#f472b6', '#a78bfa'];

  const timeOfDay = new Date().getHours();
  const greeting = timeOfDay < 12 ? 'Good morning' : timeOfDay < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = (adminUser?.displayName ?? adminUser?.email ?? 'Admin').split(' ')[0];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-sm text-slate-500">
          Here's what's happening on Felhomes today.
        </p>
      </div>

      {/* Urgent actions banner */}
      {(counts.pendingWithdrawals > 0 || counts.pendingReceipts > 0 || counts.pendingProperties > 0) && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" />
            Action required:
          </span>
          {counts.pendingWithdrawals > 0 && (
            <Link href="/admin/withdrawals">
              <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-200 cursor-pointer">
                {counts.pendingWithdrawals} withdrawal{counts.pendingWithdrawals !== 1 ? 's' : ''} pending
              </Badge>
            </Link>
          )}
          {counts.pendingReceipts > 0 && (
            <Link href="/admin/payment-verifications">
              <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 cursor-pointer">
                {counts.pendingReceipts} receipt{counts.pendingReceipts !== 1 ? 's' : ''} to verify
              </Badge>
            </Link>
          )}
          {counts.pendingProperties > 0 && (
            <Link href="/admin/properties">
              <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-200 cursor-pointer">
                {counts.pendingProperties} propert{counts.pendingProperties !== 1 ? 'ies' : 'y'} pending review
              </Badge>
            </Link>
          )}
        </div>
      )}

      {/* Platform balance highlight */}
      <Card className="border-[#C89B3C]/20 bg-gradient-to-br from-[#1e3a5f] to-[#0f2040] text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#C89B3C]/10 blur-3xl" />
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Platform Wallet Balance</p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-white">
                {formatCompactNaira(counts.platformBalance)}
              </p>
              <p className="mt-1 text-sm text-slate-400">Felhomes treasury</p>
            </div>
            <div className="rounded-2xl bg-[#C89B3C]/20 p-3">
              <DollarSign className="h-7 w-7 text-[#C89B3C]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stat grid — row 1 */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Platform Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Users" value={counts.totalUsers.toLocaleString()} icon={Users} href="/admin/users" sub="Registered accounts" />
          <StatCard label="Properties" value={counts.totalProperties.toLocaleString()} icon={Home} href="/admin/properties"
            sub={counts.pendingProperties > 0 ? `${counts.pendingProperties} awaiting review` : 'All reviewed'}
            urgent={counts.pendingProperties > 0} />
          <StatCard label="Active Investments" value={counts.activeInvestments.toLocaleString()} icon={TrendingUp} href="/admin/investments" sub="Currently active" />
          <StatCard label="Active RTO Plans" value={counts.activeRto.toLocaleString()} icon={Key} href="/admin/rent-to-own" sub={`${counts.pendingRto} pending review`} urgent={counts.pendingRto > 0} />
        </div>
      </div>

      {/* Stat grid — row 2 (actions needed) */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Pending Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Pending Withdrawals" value={counts.pendingWithdrawals} icon={Wallet} href="/admin/withdrawals"
            sub="Users waiting for payment" urgent={counts.pendingWithdrawals > 0} />
          <StatCard label="Payment Receipts" value={counts.pendingReceipts} icon={CreditCard} href="/admin/payment-verifications"
            sub="Bank transfers to verify" urgent={counts.pendingReceipts > 0} />
          <StatCard label="IOU Applications" value={counts.pendingIou} icon={FileText} href="/admin/iou"
            sub="Awaiting approval" urgent={counts.pendingIou > 0} />
          <StatCard label="Mortgages In Progress" value={counts.activeMortgages} icon={Landmark} href="/admin/mortgages"
            sub="Across all active stages" />
        </div>
      </div>

      {/* Stat grid — row 3 */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Build Projects" value={counts.pendingBuildProjects} icon={HardHat} href="/admin/build"
          sub="Pending review" urgent={counts.pendingBuildProjects > 0} />
        <StatCard label="RTO Pending Review" value={counts.pendingRto} icon={Key} href="/admin/rent-to-own"
          sub="Applications to approve" urgent={counts.pendingRto > 0} />
        <StatCard label="Support Threads" value={counts.openSupportThreads} icon={MessageSquare} href="/admin/support"
          sub="Open conversations" urgent={counts.openSupportThreads > 0} />
        <StatCard label="Joint Ventures" value="—" icon={Handshake} href="/admin/jv" sub="Active JV projects" />
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* User growth chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">User Growth</CardTitle>
            <CardDescription>Monthly new registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={userGrowthData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(v: any) => [v.toLocaleString(), 'New users']}
                />
                <Area type="monotone" dataKey="users" stroke={GOLD} strokeWidth={2} fill="url(#userGrad)" dot={{ fill: GOLD, strokeWidth: 0, r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Transaction volume chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Transaction Volume</CardTitle>
            <CardDescription>Credits vs debits (recent activity)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={txVolumeData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => formatCompactNaira(v)} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(v: any, name: string) => [formatCompactNaira(v), name === 'credits' ? 'Credits' : 'Debits']}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="credits" fill={GOLD} radius={[4, 4, 0, 0]} />
                <Bar dataKey="debits" fill={NAVY} radius={[4, 4, 0, 0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Property category breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Property Categories</CardTitle>
            <CardDescription>All listings by type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={propertyBreakdown} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    paddingAngle={3} dataKey="value">
                    {propertyBreakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    formatter={(v: any, _: any, p: any) => [v, p.payload.name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 shrink-0">
                {propertyBreakdown.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-slate-600 capitalize">{item.name}</span>
                    <span className="font-semibold text-slate-900 ml-1">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* RTO + Mortgage pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Finance Pipeline</CardTitle>
            <CardDescription>RTO and mortgage activity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: 'RTO — Pending review', value: counts.pendingRto, color: 'bg-amber-500', href: '/admin/rent-to-own' },
                { label: 'RTO — Active plans', value: counts.activeRto, color: 'bg-green-500', href: '/admin/rent-to-own' },
                { label: 'Mortgages in progress', value: counts.activeMortgages, color: 'bg-blue-500', href: '/admin/mortgages' },
                { label: 'IOU pending', value: counts.pendingIou, color: 'bg-purple-500', href: '/admin/iou' },
              ].map(item => {
                const max = Math.max(counts.pendingRto, counts.activeRto, counts.activeMortgages, counts.pendingIou, 1);
                return (
                  <Link key={item.label} href={item.href} className="block group">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-600 group-hover:text-slate-900">{item.label}</span>
                      <span className="font-semibold text-slate-900">{item.value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', item.color)}
                        style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 8 : 0)}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom tables row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pending withdrawals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Pending Withdrawals</CardTitle>
              <CardDescription>Needs processing today</CardDescription>
            </div>
            <Link href="/admin/withdrawals" className="text-xs text-[#C89B3C] hover:underline font-medium">
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            {pendingWithdrawals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-400 mb-2" />
                <p className="text-sm font-medium text-slate-600">All clear!</p>
                <p className="text-xs text-slate-400">No pending withdrawals</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingWithdrawals.map((w: any) => (
                  <Link key={w.id} href={`/admin/withdrawals`}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 hover:bg-slate-100 transition-colors">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{w.accountName ?? w.uid?.slice(0, 10)}</p>
                      <p className="text-[10px] text-slate-400">{w.bankName ?? '—'} · {formatDateTime(w.createdAt)}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-bold text-red-600">{formatCompactNaira(w.amount)}</p>
                      <StatusBadge status={w.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle>
              <CardDescription>Last 8 platform transactions</CardDescription>
            </div>
            <Activity className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            {recentTxns.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No transactions yet</p>
            ) : (
              <div className="space-y-2">
                {recentTxns.map((t: any) => (
                  <div key={t.id} className="flex items-center justify-between rounded-lg px-1 py-1.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                        t.direction === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      )}>
                        {t.direction === 'credit'
                          ? <ArrowDownRight className="h-3.5 w-3.5" />
                          : <ArrowUpRight className="h-3.5 w-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{t.title ?? t.kind ?? '—'}</p>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{t.uid?.slice(0, 8)}…</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={cn('text-sm font-bold', t.direction === 'credit' ? 'text-green-700' : 'text-red-600')}>
                        {t.direction === 'credit' ? '+' : '-'}{formatCompactNaira(t.amount)}
                      </p>
                      <p className="text-[10px] text-slate-400">{formatDateTime(t.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent property submissions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold">Recent Property Submissions</CardTitle>
              <CardDescription>Latest listings submitted to the platform</CardDescription>
            </div>
            <Link href="/admin/properties" className="text-xs text-[#C89B3C] hover:underline font-medium">
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            {recentProperties.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No properties yet</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentProperties.map((p: any) => (
                  <Link key={p.id} href={`/admin/properties`}
                    className="flex items-center justify-between py-3 hover:bg-slate-50 rounded-lg px-2 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      {p.imageUrls?.[0] ? (
                        <img src={p.imageUrls[0]} alt="" className="h-10 w-14 rounded-lg object-cover shrink-0 bg-slate-100" />
                      ) : (
                        <div className="h-10 w-14 rounded-lg bg-slate-100 shrink-0 flex items-center justify-center">
                          <Home className="h-4 w-4 text-slate-300" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{p.title}</p>
                        <p className="text-xs text-slate-400 truncate">{p.location}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-slate-900">{formatCompactNaira(p.price)}</p>
                        <p className="text-xs text-slate-400 capitalize">{p.category}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
