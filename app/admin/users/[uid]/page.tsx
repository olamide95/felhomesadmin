"use client";

import { useState, useEffect } from "react";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { ArrowLeft, Loader2, Wallet, ShieldOff, ShieldCheck, MinusCircle, PlusCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { Paths, formatNaira } from "@/lib/constants";
import { formatDateTime } from "@/lib/firestore-helpers";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function UserDetailsPage({ params }: { params: { uid: string } }) {
  const { uid } = params;
  const [user, setUser] = useState<any | null>(null);
  const [wallet, setWallet] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustOpen, setAdjustOpen] = useState<"credit" | "debit" | null>(null);

  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      onSnapshot(doc(db, Paths.users, uid), (snap) => {
        setUser(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      })
    );
    unsubs.push(
      onSnapshot(doc(db, Paths.wallets, uid), (snap) => {
        setWallet(snap.exists() ? snap.data() : null);
      })
    );
    unsubs.push(
      onSnapshot(
        query(
          collection(db, Paths.transactions),
          where("uid", "==", uid),
          orderBy("createdAt", "desc"),
          limit(50)
        ),
        (snap) => setTransactions(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  async function toggleSuspend() {
    if (!user) return;
    const next = !user.suspended;
    if (!confirm(next ? "Suspend this user?" : "Reactivate this user?")) return;
    try {
      await updateDoc(doc(db, Paths.users, uid), { suspended: next });
      toast.success(next ? "User suspended" : "User reactivated");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to users
        </Link>
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            User not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      <PageHeader
        title={user.fullName ?? "User"}
        description={user.email}
        action={
          <Button variant={user.suspended ? "default" : "destructive"} onClick={toggleSuspend}>
            {user.suspended ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
            {user.suspended ? "Reactivate" : "Suspend"}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="UID" value={<span className="font-mono text-xs">{user.id}</span>} />
            <Row label="Full name" value={user.fullName ?? "—"} />
            <Row label="Email" value={user.email ?? "—"} />
            <Row label="Phone" value={user.phone ?? "—"} />
            <Row label="Referral code" value={<span className="font-mono">{user.referralCode ?? "—"}</span>} />
            <Row label="Sponsor code" value={<span className="font-mono">{user.sponsorCode ?? "—"}</span>} />
            <Row
              label="KYC"
              value={user.kycCompleted ? <Badge variant="success">Verified</Badge> : <Badge variant="warning">Pending</Badge>}
            />
            <Row
              label="Registration fee"
              value={user.registrationFeePaid ? <Badge variant="success">Paid</Badge> : <Badge variant="destructive">Not paid</Badge>}
            />
            <Row label="Suspended" value={user.suspended ? <Badge variant="destructive">Yes</Badge> : "No"} />
            <Row label="Joined" value={formatDateTime(user.createdAt)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <CardTitle>Wallet</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="rounded-md bg-muted p-3">
              <div className="text-xs uppercase text-muted-foreground">Balance</div>
              <div className="text-2xl font-bold">{formatNaira(wallet?.balance)}</div>
            </div>
            <Row label="Total earnings" value={formatNaira(wallet?.totalEarnings)} />
            <Row label="Referral earnings" value={formatNaira(wallet?.referralEarnings)} />
            <Row label="Sponsor earnings" value={formatNaira(wallet?.sponsorEarnings)} />
            <Row label="Investment returns" value={formatNaira(wallet?.investmentReturns)} />
            <Row label="Sales earnings" value={formatNaira(wallet?.salesEarnings)} />
            <Row label="Pending withdrawals" value={formatNaira(wallet?.pendingWithdrawals)} />
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setAdjustOpen("credit")}>
                <PlusCircle className="h-3.5 w-3.5" /> Credit
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setAdjustOpen("debit")}>
                <MinusCircle className="h-3.5 w-3.5" /> Debit
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No transactions yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Kind</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{formatDateTime(t.createdAt)}</TableCell>
                    <TableCell className="capitalize">{t.kind ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{t.description ?? t.title ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={t.direction === "credit" ? "success" : "secondary"}>
                        {t.direction ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatNaira(t.amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <WalletAdjustDialog
        mode={adjustOpen}
        uid={uid}
        currentBalance={wallet?.balance ?? 0}
        onClose={() => setAdjustOpen(null)}
      />
    </div>
  );
}

function WalletAdjustDialog({
  mode,
  uid,
  currentBalance,
  onClose,
}: {
  mode: "credit" | "debit" | null;
  uid: string;
  currentBalance: number;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);

  async function submit() {
    if (!mode) return;
    const value = parseFloat(amount.replace(/,/g, ""));
    if (isNaN(value) || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (mode === "debit" && value > currentBalance) {
      toast.error(`Cannot debit more than current balance (${formatNaira(currentBalance)})`);
      return;
    }
    if (note.trim().length < 5) {
      toast.error("Provide a note of at least 5 characters (this is an audit trail)");
      return;
    }
    setWorking(true);
    try {
      await runTransaction(db, async (txn) => {
        const walletRef = doc(db, Paths.wallets, uid);
        const walletSnap = await txn.get(walletRef);
        const prev = ((walletSnap.data()?.balance as number) ?? 0);
        const next = mode === "credit" ? prev + value : prev - value;
        if (walletSnap.exists()) {
          txn.update(walletRef, { balance: next, updatedAt: serverTimestamp() });
        } else {
          txn.set(walletRef, {
            balance: next,
            totalEarnings: 0,
            referralEarnings: 0,
            sponsorEarnings: 0,
            investmentReturns: 0,
            salesEarnings: 0,
            pendingWithdrawals: 0,
            updatedAt: serverTimestamp(),
          });
        }
        const txRef = doc(collection(db, Paths.transactions));
        txn.set(txRef, {
          uid,
          kind: "adminAdjustment",
          direction: mode === "credit" ? "credit" : "debit",
          status: "completed",
          amount: value,
          title: `Admin ${mode}`,
          description: note.trim(),
          createdAt: serverTimestamp(),
        });
      });
      toast.success(`Wallet ${mode === "credit" ? "credited" : "debited"}`);
      setAmount("");
      setNote("");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={!!mode} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "credit" ? "Credit wallet" : "Debit wallet"}</DialogTitle>
          <DialogDescription>
            Current balance: <strong>{formatNaira(currentBalance)}</strong>. This will be logged
            as an admin adjustment in the user&apos;s transaction history.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="amount">Amount (₦)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="note">Reason / audit note</Label>
            <Textarea
              id="note"
              placeholder="Why is this adjustment being made?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={working}>
            {working && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "credit" ? "Credit" : "Debit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-right">{value}</div>
    </div>
  );
}
