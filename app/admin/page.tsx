"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  limit,
  orderBy,
} from "firebase/firestore";
import {
  Users,
  Home,
  Wallet,
  FileText,
  Clock,
  TrendingUp,
  HardHat,
  ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { Paths, formatCompactNaira } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type CountState = {
  totalUsers: number;
  totalProperties: number;
  pendingProperties: number;
  pendingWithdrawals: number;
  pendingIou: number;
  activeInvestments: number;
  pendingBuildProjects: number;
  platformBalance: number;
};

export default function DashboardPage() {
  const [counts, setCounts] = useState<CountState>({
    totalUsers: 0,
    totalProperties: 0,
    pendingProperties: 0,
    pendingWithdrawals: 0,
    pendingIou: 0,
    activeInvestments: 0,
    pendingBuildProjects: 0,
    platformBalance: 0,
  });
  const [recentTxns, setRecentTxns] = useState<any[]>([]);

  useEffect(() => {
    const subs: Array<() => void> = [];

    // Counts via snapshots (small collections are fine; larger orgs should
    // migrate to aggregation counters maintained by Cloud Functions).
    subs.push(
      onSnapshot(collection(db, Paths.users), (snap) => {
        setCounts((c) => ({ ...c, totalUsers: snap.size }));
      })
    );
    subs.push(
      onSnapshot(collection(db, Paths.properties), (snap) => {
        const total = snap.size;
        const pending = snap.docs.filter((d) => d.data().status === "pending").length;
        setCounts((c) => ({ ...c, totalProperties: total, pendingProperties: pending }));
      })
    );
    subs.push(
      onSnapshot(
        query(collection(db, Paths.withdrawals), where("status", "==", "pending")),
        (snap) => setCounts((c) => ({ ...c, pendingWithdrawals: snap.size }))
      )
    );
    subs.push(
      onSnapshot(
        query(collection(db, Paths.iouApplications), where("status", "==", "pending")),
        (snap) => setCounts((c) => ({ ...c, pendingIou: snap.size }))
      )
    );
    subs.push(
      onSnapshot(
        query(collection(db, Paths.investments), where("status", "==", "active")),
        (snap) => setCounts((c) => ({ ...c, activeInvestments: snap.size }))
      )
    );
    subs.push(
      onSnapshot(
        query(collection(db, Paths.buildProjects), where("status", "==", "pending")),
        (snap) => setCounts((c) => ({ ...c, pendingBuildProjects: snap.size }))
      )
    );
    subs.push(
      onSnapshot(
        query(collection(db, Paths.transactions), orderBy("createdAt", "desc"), limit(8)),
        (snap) =>
          setRecentTxns(
            snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          )
      )
    );

    return () => subs.forEach((u) => u());
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of activity across the Felhomes platform
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total users"
          value={counts.totalUsers.toLocaleString()}
          icon={Users}
          href="/admin/users"
        />
        <MetricCard
          label="Properties listed"
          value={counts.totalProperties.toLocaleString()}
          icon={Home}
          href="/admin/properties"
          accent={counts.pendingProperties > 0 ? `${counts.pendingProperties} pending` : undefined}
        />
        <MetricCard
          label="Pending withdrawals"
          value={counts.pendingWithdrawals.toLocaleString()}
          icon={Wallet}
          href="/admin/withdrawals"
          urgent={counts.pendingWithdrawals > 0}
        />
        <MetricCard
          label="IOU applications"
          value={counts.pendingIou.toLocaleString()}
          icon={FileText}
          href="/admin/iou"
          urgent={counts.pendingIou > 0}
        />
        <MetricCard
          label="Active investments"
          value={counts.activeInvestments.toLocaleString()}
          icon={TrendingUp}
          href="/admin/investments"
        />
        <MetricCard
          label="Pending build projects"
          value={counts.pendingBuildProjects.toLocaleString()}
          icon={HardHat}
          href="/admin/build"
          urgent={counts.pendingBuildProjects > 0}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent transactions</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          {recentTxns.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTxns.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs">
                      {t.uid?.slice(0, 8) ?? "—"}
                    </TableCell>
                    <TableCell>{t.kind ?? t.title ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={t.direction === "credit" ? "success" : "secondary"}>
                        {t.direction ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCompactNaira(t.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          t.status === "completed"
                            ? "success"
                            : t.status === "pending"
                              ? "warning"
                              : t.status === "failed"
                                ? "destructive"
                                : "secondary"
                        }
                      >
                        {t.status ?? "—"}
                      </Badge>
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

function MetricCard({
  label,
  value,
  icon: Icon,
  href,
  accent,
  urgent,
}: {
  label: string;
  value: string;
  icon: any;
  href: string;
  accent?: string;
  urgent?: boolean;
}) {
  return (
    <Link href={href} className="group">
      <Card className="transition-colors hover:bg-accent/50">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
              {accent && (
                <p className="mt-1 text-xs text-amber-700">{accent}</p>
              )}
              {urgent && (
                <p className="mt-1 text-xs text-destructive">Action required</p>
              )}
            </div>
            <div
              className={
                "rounded-md p-2 " +
                (urgent ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")
              }
            >
              <Icon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground">
            View <ArrowUpRight className="h-3 w-3" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
