'use client';

import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, query, orderBy, where,
} from 'firebase/firestore';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts';
import { BarChart3, Download, TrendingUp, Users, Wallet, Home } from 'lucide-react';
import { db } from '@/lib/firebase';
import { Paths, formatCompactNaira, formatNaira } from '@/lib/constants';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';

const GOLD = '#C89B3C';
const NAVY = '#1e3a5f';
const COLORS = [GOLD, NAVY, '#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fb923c'];

function exportCSV(data: any[], filename: string) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const csv = [keys.join(','), ...data.map(row => keys.map(k => `"${row[k] ?? ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const { permissions } = useAuth();
  const [userGrowth, setUserGrowth] = useState<any[]>([]);
  const [txVolume, setTxVolume] = useState<any[]>([]);
  const [propStats, setPropStats] = useState<any[]>([]);
  const [rtoStats, setRtoStats] = useState<any[]>([]);
  const [revenueBreakdown, setRevenueBreakdown] = useState<any[]>([]);
  const [totals, setTotals] = useState({ users: 0, properties: 0, deposits: 0, withdrawals: 0, commissions: 0 });

  useEffect(() => {
    const subs: Array<() => void> = [];

    // Users by month
    subs.push(onSnapshot(query(collection(db, Paths.users), orderBy('createdAt', 'desc')), snap => {
      const byMonth: Record<string, number> = {};
      snap.docs.forEach(d => {
        const ts = d.data().createdAt as { seconds: number } | undefined;
        if (!ts) return;
        const date = new Date(ts.seconds * 1000);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        byMonth[key] = (byMonth[key] ?? 0) + 1;
      });
      const sorted = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
      // Cumulative
      let cumulative = 0;
      setUserGrowth(sorted.map(([month, count]) => {
        cumulative += count;
        return {
          month: new Date(month + '-01').toLocaleDateString('en-NG', { month: 'short', year: '2-digit' }),
          new: count,
          total: cumulative,
        };
      }));
      setTotals(t => ({ ...t, users: snap.size }));
    }));

    // Transactions by month + kind
    subs.push(onSnapshot(query(collection(db, Paths.transactions), orderBy('createdAt', 'desc')), snap => {
      const byMonth: Record<string, { credits: number; debits: number; count: number }> = {};
      const byKind: Record<string, number> = {};
      let totalDeposits = 0, totalWithdrawals = 0, totalCommissions = 0;
      snap.docs.forEach(d => {
        const data = d.data();
        const ts = data.createdAt as { seconds: number } | undefined;
        if (ts) {
          const date = new Date(ts.seconds * 1000);
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (!byMonth[key]) byMonth[key] = { credits: 0, debits: 0, count: 0 };
          byMonth[key].count++;
          const amount = data.amount ?? 0;
          if (data.direction === 'credit') byMonth[key].credits += amount;
          else byMonth[key].debits += amount;
        }
        const kind = data.kind ?? 'other';
        byKind[kind] = (byKind[kind] ?? 0) + (data.amount ?? 0);
        if (kind === 'deposit') totalDeposits += data.amount ?? 0;
        if (kind === 'withdrawal') totalWithdrawals += data.amount ?? 0;
        if (kind?.includes('Commission') || kind?.includes('commission')) totalCommissions += data.amount ?? 0;
      });
      const sorted = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
      setTxVolume(sorted.map(([month, vals]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-NG', { month: 'short', year: '2-digit' }),
        credits: vals.credits,
        debits: vals.debits,
        count: vals.count,
      })));
      setRevenueBreakdown(
        Object.entries(byKind)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 7)
          .map(([name, value]) => ({ name, value }))
      );
      setTotals(t => ({ ...t, deposits: totalDeposits, withdrawals: totalWithdrawals, commissions: totalCommissions }));
    }));

    // Properties by status over time
    subs.push(onSnapshot(collection(db, Paths.properties), snap => {
      const byStatus: Record<string, number> = {};
      snap.docs.forEach(d => {
        const s = d.data().status ?? 'unknown';
        byStatus[s] = (byStatus[s] ?? 0) + 1;
      });
      setPropStats(Object.entries(byStatus).map(([status, count]) => ({ status, count })));
      setTotals(t => ({ ...t, properties: snap.size }));
    }));

    // RTO pipeline
    subs.push(onSnapshot(collection(db, Paths.rentToOwnApplications), snap => {
      const byStatus: Record<string, number> = {};
      snap.docs.forEach(d => {
        const s = d.data().status ?? 'unknown';
        byStatus[s] = (byStatus[s] ?? 0) + 1;
      });
      setRtoStats(Object.entries(byStatus).map(([status, count]) => ({ status, count })));
    }));

    return () => subs.forEach(u => u());
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports & Analytics"
        description="Platform performance overview"
        action={
          permissions?.canExportReports ? (
            <Button variant="outline" onClick={() => exportCSV(txVolume, 'felhomes-tx-volume.csv')}>
              <Download className="mr-2 h-4 w-4" />
              Export transactions
            </Button>
          ) : undefined
        }
      />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Users', value: totals.users.toLocaleString(), icon: Users, color: 'text-[#C89B3C]', bg: 'bg-[#C89B3C]/10' },
          { label: 'Properties', value: totals.properties.toLocaleString(), icon: Home, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Total Deposits', value: formatCompactNaira(totals.deposits), icon: Wallet, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Withdrawals', value: formatCompactNaira(totals.withdrawals), icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50' },
        ].map(item => (
          <Card key={item.label}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`rounded-xl p-2.5 ${item.bg}`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">{item.label}</p>
                <p className="text-2xl font-bold text-slate-900">{item.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* User growth */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">User Growth</CardTitle>
          <CardDescription>New registrations per month + cumulative total</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={userGrowth} margin={{ top: 4, right: 8, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={NAVY} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={NAVY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="new" name="New users" stroke={GOLD} strokeWidth={2} dot={{ fill: GOLD, r: 3 }} />
              <Line type="monotone" dataKey="total" name="Cumulative" stroke={NAVY} strokeWidth={2} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Transaction volume */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Transaction Volume</CardTitle>
            <CardDescription>Monthly credits vs debits</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={txVolume} margin={{ top: 4, right: 4, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={v => formatCompactNaira(v)} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                  formatter={(v: any, name: string) => [formatCompactNaira(v), name === 'credits' ? 'Credits' : 'Debits']} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="credits" name="Credits" fill={GOLD} radius={[4, 4, 0, 0]} />
                <Bar dataKey="debits" name="Debits" fill={NAVY} radius={[4, 4, 0, 0]} opacity={0.75} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue breakdown by kind */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Revenue by Transaction Type</CardTitle>
            <CardDescription>Top 7 transaction kinds by volume</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={revenueBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                    {revenueBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11 }}
                    formatter={(v: any, _: any, p: any) => [formatCompactNaira(v), p.payload.name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 shrink-0 text-xs">
                {revenueBreakdown.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-slate-500 capitalize truncate max-w-[100px]">{item.name}</span>
                    <span className="font-semibold text-slate-800 ml-auto">{formatCompactNaira(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Property status breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Property Pipeline</CardTitle>
            <CardDescription>All listings by moderation status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 mt-1">
              {propStats.map((item, i) => (
                <div key={item.status}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-600 capitalize">{item.status}</span>
                    <span className="font-semibold text-slate-900">{item.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${Math.max((item.count / (totals.properties || 1)) * 100, item.count > 0 ? 4 : 0)}%`,
                      background: COLORS[i % COLORS.length],
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* RTO pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Rent-to-Own Pipeline</CardTitle>
            <CardDescription>Applications by status</CardDescription>
          </CardHeader>
          <CardContent>
            {rtoStats.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No RTO applications yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={rtoStats} layout="vertical" margin={{ top: 4, right: 20, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="status" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={55} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Bar dataKey="count" name="Applications" fill={GOLD} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
