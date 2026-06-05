"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { orderBy } from "firebase/firestore";
import { Users, Search, ExternalLink, Loader2 } from "lucide-react";
import { Paths } from "@/lib/constants";
import { formatDate } from "@/lib/firestore-helpers";
import { useFirestoreQuery } from "@/hooks/use-firestore-query";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type UserDoc = {
  id: string;
  fullName?: string;
  email?: string;
  phone?: string;
  referralCode?: string;
  sponsorCode?: string;
  kycCompleted?: boolean;
  registrationFeePaid?: boolean;
  suspended?: boolean;
  createdAt?: any;
};

export default function UsersPage() {
  const [q, setQ] = useState("");
  const { docs, loading } = useFirestoreQuery<UserDoc>(
    Paths.users,
    [orderBy("createdAt", "desc")]
  );

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return docs;
    return docs.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.phone?.toLowerCase().includes(term) ||
        u.referralCode?.toLowerCase().includes(term) ||
        u.id.toLowerCase().includes(term)
    );
  }, [docs, q]);

  return (
    <div>
      <PageHeader
        title="Users"
        description={`${docs.length} registered`}
      />

      <Card>
        <CardContent className="p-0">
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, referral code, or UID…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="No users"
                message={q ? "Try a different search term." : "No users have registered yet."}
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Referral code</TableHead>
                  <TableHead>KYC</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Open</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium">{u.fullName ?? "—"}</div>
                      {u.suspended && <Badge variant="destructive" className="mt-1">Suspended</Badge>}
                    </TableCell>
                    <TableCell>{u.email ?? "—"}</TableCell>
                    <TableCell>{u.phone ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{u.referralCode ?? "—"}</TableCell>
                    <TableCell>
                      {u.kycCompleted ? (
                        <Badge variant="success">Verified</Badge>
                      ) : (
                        <Badge variant="warning">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(u.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        View <ExternalLink className="h-3 w-3" />
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
