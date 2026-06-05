"use client";

import { useState } from "react";
import {
  orderBy,
  where,
  doc,
  runTransaction,
  serverTimestamp,
  collection,
} from "firebase/firestore";
import { Wallet, Check, X, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { Paths, formatNaira, formatCompactNaira } from "@/lib/constants";
import { formatDateTime } from "@/lib/firestore-helpers";
import { useFirestoreQuery } from "@/hooks/use-firestore-query";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

type WithdrawalDoc = {
  id: string;
  uid?: string;
  amount?: number;
  bankAccountId?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  status?: string;
  createdAt?: unknown;
  processedAt?: unknown;
  payoutReference?: string;
  rejectionReason?: string;
};

const STATUS_TABS = ["pending", "processing", "paid", "rejected"] as const;

export default function WithdrawalsPage() {
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("pending");
  const [selected, setSelected] = useState<WithdrawalDoc | null>(null);

  const { docs, loading } = useFirestoreQuery<WithdrawalDoc>(
    Paths.withdrawals,
    [where("status", "==", tab), orderBy("createdAt", "desc")],
    [tab]
  );

  return (
    <div>
      <PageHeader
        title="Withdrawals"
        description="Process user withdrawal requests"
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          {STATUS_TABS.map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize">
              {s}
            </TabsTrigger>
          ))}
        </TabsList>
        {STATUS_TABS.map((s) => (
          <TabsContent key={s} value={s}>
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex justify-center p-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : docs.length === 0 ? (
                  <div className="p-6">
                    <EmptyState
                      icon={Wallet}
                      title={`No ${s} withdrawals`}
                      message="When users request withdrawals, they'll appear here."
                    />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Bank</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {docs.map((w) => (
                        <TableRow key={w.id}>
                          <TableCell className="font-mono text-xs">
                            {w.uid?.slice(0, 8) ?? "—"}
                          </TableCell>
                          <TableCell>{w.bankName ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {w.accountNumber ?? "—"}
                            <div className="font-sans text-xs text-muted-foreground">
                              {w.accountName ?? ""}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatNaira(w.amount)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatDateTime(w.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelected(w)}
                            >
                              <Eye className="h-4 w-4" />
                              Review
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
      <WithdrawalDialog
        withdrawal={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function WithdrawalDialog({
  withdrawal,
  onClose,
}: {
  withdrawal: WithdrawalDoc | null;
  onClose: () => void;
}) {
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);
  const [mode, setMode] = useState<"none" | "approve" | "reject">("none");

  if (!withdrawal) return null;

  /**
   * Approve: deduct from pendingWithdrawals, mark paid, log transaction.
   * The amount was already moved from balance → pendingWithdrawals when the
   * user submitted the request (in the mobile app).
   */
  async function approve() {
    if (!withdrawal || !withdrawal.uid) return;
    if (!reference.trim()) {
      toast.error("Enter the bank transfer reference.");
      return;
    }
    setWorking(true);
    try {
      await runTransaction(db, async (txn) => {
        const wRef = doc(db, Paths.withdrawals, withdrawal.id);
        const wSnap = await txn.get(wRef);
        if (!wSnap.exists()) throw new Error("Withdrawal not found");
        if (wSnap.data().status !== "pending" && wSnap.data().status !== "processing") {
          throw new Error("Withdrawal already processed");
        }
        const amount = (withdrawal.amount as number) ?? 0;

        const walletRef = doc(db, Paths.wallets, withdrawal.uid!);
        const walletSnap = await txn.get(walletRef);
        const prevPending = ((walletSnap.data()?.pendingWithdrawals as number) ?? 0);

        txn.update(walletRef, {
          pendingWithdrawals: Math.max(0, prevPending - amount),
          updatedAt: serverTimestamp(),
        });

        txn.update(wRef, {
          status: "paid",
          payoutReference: reference.trim(),
          processedAt: serverTimestamp(),
        });

        // Log the audit transaction
        const txRef = doc(collection(db, Paths.transactions));
        txn.set(txRef, {
          uid: withdrawal.uid,
          kind: "withdrawal",
          direction: "debit",
          status: "completed",
          amount,
          title: "Withdrawal Paid",
          description: `Paid to ${withdrawal.bankName} ${withdrawal.accountNumber}`,
          reference: reference.trim(),
          createdAt: serverTimestamp(),
        });
      });
      toast.success("Withdrawal marked paid");
      onClose();
      setReference("");
      setMode("none");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to approve");
    } finally {
      setWorking(false);
    }
  }

  /**
   * Reject: return the amount from pendingWithdrawals back to balance.
   */
  async function reject() {
    if (!withdrawal || !withdrawal.uid) return;
    if (reason.trim().length < 5) {
      toast.error("Provide a reason of at least 5 characters.");
      return;
    }
    setWorking(true);
    try {
      await runTransaction(db, async (txn) => {
        const wRef = doc(db, Paths.withdrawals, withdrawal.id);
        const wSnap = await txn.get(wRef);
        if (!wSnap.exists()) throw new Error("Withdrawal not found");
        if (wSnap.data().status !== "pending" && wSnap.data().status !== "processing") {
          throw new Error("Withdrawal already processed");
        }
        const amount = (withdrawal.amount as number) ?? 0;

        const walletRef = doc(db, Paths.wallets, withdrawal.uid!);
        const walletSnap = await txn.get(walletRef);
        const prevBalance = ((walletSnap.data()?.balance as number) ?? 0);
        const prevPending = ((walletSnap.data()?.pendingWithdrawals as number) ?? 0);

        txn.update(walletRef, {
          balance: prevBalance + amount,
          pendingWithdrawals: Math.max(0, prevPending - amount),
          updatedAt: serverTimestamp(),
        });

        txn.update(wRef, {
          status: "rejected",
          rejectionReason: reason.trim(),
          processedAt: serverTimestamp(),
        });

        const txRef = doc(collection(db, Paths.transactions));
        txn.set(txRef, {
          uid: withdrawal.uid,
          kind: "withdrawalReversal",
          direction: "credit",
          status: "completed",
          amount,
          title: "Withdrawal Refunded",
          description: `Refunded to balance: ${reason.trim()}`,
          createdAt: serverTimestamp(),
        });
      });
      toast.success("Withdrawal rejected and refunded");
      onClose();
      setReason("");
      setMode("none");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to reject");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={!!withdrawal} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdrawal request</DialogTitle>
          <DialogDescription>
            {formatNaira(withdrawal.amount)} to {withdrawal.bankName}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Row label="Status" value={<StatusBadge status={withdrawal.status} />} />
          <Row label="User UID" value={<span className="font-mono text-xs">{withdrawal.uid}</span>} />
          <Row label="Bank" value={withdrawal.bankName ?? "—"} />
          <Row label="Account number" value={<span className="font-mono">{withdrawal.accountNumber}</span>} />
          <Row label="Account name" value={withdrawal.accountName ?? "—"} />
          <Row label="Amount" value={<strong>{formatNaira(withdrawal.amount)}</strong>} />
          <Row label="Requested" value={formatDateTime(withdrawal.createdAt)} />
          {withdrawal.processedAt && (
            <Row label="Processed" value={formatDateTime(withdrawal.processedAt)} />
          )}
          {withdrawal.payoutReference && (
            <Row label="Payout ref" value={<span className="font-mono text-xs">{withdrawal.payoutReference}</span>} />
          )}
          {withdrawal.rejectionReason && (
            <Row label="Rejection reason" value={withdrawal.rejectionReason} />
          )}
        </div>

        {(withdrawal.status === "pending" || withdrawal.status === "processing") && mode === "approve" && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <Label>Bank transfer reference</Label>
            <Input
              placeholder="e.g. TRF-2024-12345"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              After you've transferred the money via your bank's portal, paste the
              reference here so it's logged in the user's transaction history.
            </p>
          </div>
        )}

        {(withdrawal.status === "pending" || withdrawal.status === "processing") && mode === "reject" && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <Label>Reason for rejection</Label>
            <Textarea
              placeholder="e.g. Account details don't match user identity"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              The amount will be refunded from pending withdrawals back to the
              user's wallet balance.
            </p>
          </div>
        )}

        <DialogFooter className="flex-row gap-2">
          {(withdrawal.status === "pending" || withdrawal.status === "processing") && (
            <>
              {mode === "none" && (
                <>
                  <Button variant="destructive" onClick={() => setMode("reject")}>
                    <X className="h-4 w-4" /> Reject
                  </Button>
                  <Button onClick={() => setMode("approve")}>
                    <Check className="h-4 w-4" /> Mark Paid
                  </Button>
                </>
              )}
              {mode === "approve" && (
                <>
                  <Button variant="outline" onClick={() => setMode("none")}>Back</Button>
                  <Button onClick={approve} disabled={working}>
                    {working && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirm payment
                  </Button>
                </>
              )}
              {mode === "reject" && (
                <>
                  <Button variant="outline" onClick={() => setMode("none")}>Back</Button>
                  <Button variant="destructive" onClick={reject} disabled={working}>
                    {working && <Loader2 className="h-4 w-4 animate-spin" />}
                    Confirm rejection
                  </Button>
                </>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="text-muted-foreground">{label}</div>
      <div className="text-right">{value}</div>
    </div>
  );
}
