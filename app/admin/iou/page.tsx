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
import { FileText, Check, X, Loader2, Eye } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { Paths, formatNaira, Business } from "@/lib/constants";
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
import { Textarea } from "@/components/ui/textarea";

type IouDoc = {
  id: string;
  uid?: string;
  propertyId?: string;
  propertyValue?: number;
  annualRentValue?: number;
  iouAmount?: number;
  termYears?: number;
  repaymentMode?: string;
  status?: string;
  createdAt?: any;
  approvedAt?: any;
  rejectionReason?: string;
};

const STATUS_TABS = ["pending", "approved", "active", "completed", "rejected"] as const;

export default function IouPage() {
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("pending");
  const [selected, setSelected] = useState<IouDoc | null>(null);
  const [mode, setMode] = useState<"none" | "approve" | "reject">("none");
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const { docs, loading } = useFirestoreQuery<IouDoc>(
    Paths.iouApplications,
    [where("status", "==", tab), orderBy("createdAt", "desc")],
    [tab]
  );

  function open(doc: IouDoc) {
    setSelected(doc);
    setMode("none");
    setReason("");
  }
  function close() {
    setSelected(null);
    setMode("none");
    setReason("");
  }

  /**
   * Approve: mark application active, credit user wallet with iouAmount, log txn.
   */
  async function approve() {
    if (!selected || !selected.uid) return;
    setWorking(true);
    try {
      await runTransaction(db, async (txn) => {
        const appRef = doc(db, Paths.iouApplications, selected.id);
        const appSnap = await txn.get(appRef);
        if (!appSnap.exists()) throw new Error("Application not found");
        if (appSnap.data().status !== "pending") {
          throw new Error("Application already processed");
        }
        const amount = (selected.iouAmount as number) ?? 0;

        const walletRef = doc(db, Paths.wallets, selected.uid!);
        const walletSnap = await txn.get(walletRef);
        const prev = ((walletSnap.data()?.balance as number) ?? 0);

        if (walletSnap.exists()) {
          txn.update(walletRef, {
            balance: prev + amount,
            updatedAt: serverTimestamp(),
          });
        } else {
          txn.set(walletRef, {
            balance: amount,
            totalEarnings: 0,
            referralEarnings: 0,
            sponsorEarnings: 0,
            investmentReturns: 0,
            salesEarnings: 0,
            pendingWithdrawals: 0,
            updatedAt: serverTimestamp(),
          });
        }

        txn.update(appRef, {
          status: "active",
          approvedAt: serverTimestamp(),
          fundedAt: serverTimestamp(),
        });

        const txRef = doc(collection(db, Paths.transactions));
        txn.set(txRef, {
          uid: selected.uid,
          kind: "iouDisbursement",
          direction: "credit",
          status: "completed",
          amount,
          title: "IOU Funded",
          description: `IOU application approved against property ${selected.propertyId}`,
          reference: selected.id,
          createdAt: serverTimestamp(),
        });
      });
      toast.success("IOU approved and funded");
      close();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to approve");
    } finally {
      setWorking(false);
    }
  }

  async function reject() {
    if (!selected) return;
    if (reason.trim().length < 5) {
      toast.error("Provide a reason of at least 5 characters.");
      return;
    }
    setWorking(true);
    try {
      const appRef = doc(db, Paths.iouApplications, selected.id);
      await runTransaction(db, async (txn) => {
        const s = await txn.get(appRef);
        if (!s.exists()) throw new Error("Application not found");
        if (s.data().status !== "pending") throw new Error("Already processed");
        txn.update(appRef, {
          status: "rejected",
          rejectionReason: reason.trim(),
          processedAt: serverTimestamp(),
        });
      });
      toast.success("IOU application rejected");
      close();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to reject");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="IOU Applications"
        description={`Property-backed loans · Term ${Business.iouLoanMultiplierYears} years · Monthly repay ${Business.iouMonthlyRepaymentPercent}% / Annual ${Business.iouAnnualRepaymentPercent}%`}
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
                      icon={FileText}
                      title={`No ${s} applications`}
                      message="IOU applications submitted by users will appear here."
                    />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Property</TableHead>
                        <TableHead className="text-right">IOU Amount</TableHead>
                        <TableHead>Term</TableHead>
                        <TableHead>Repayment</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {docs.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs">
                            {a.uid?.slice(0, 8) ?? "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {a.propertyId?.slice(0, 10) ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatNaira(a.iouAmount)}
                          </TableCell>
                          <TableCell>{a.termYears} yrs</TableCell>
                          <TableCell className="capitalize">{a.repaymentMode}</TableCell>
                          <TableCell className="text-sm">
                            {formatDateTime(a.createdAt)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => open(a)}>
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

      <Dialog open={!!selected} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>IOU Application</DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <StatusBadge status={selected.status} />
                  <span>·</span>
                  <span>{formatNaira(selected.iouAmount)}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2 text-sm">
                <Row label="User UID" value={<span className="font-mono text-xs">{selected.uid}</span>} />
                <Row label="Property ID" value={<span className="font-mono text-xs">{selected.propertyId}</span>} />
                <Row label="Property value" value={formatNaira(selected.propertyValue)} />
                <Row label="Annual rent" value={formatNaira(selected.annualRentValue)} />
                <Row label="IOU amount" value={<strong>{formatNaira(selected.iouAmount)}</strong>} />
                <Row label="Term" value={`${selected.termYears} years`} />
                <Row label="Repayment mode" value={<span className="capitalize">{selected.repaymentMode}</span>} />
                <Row label="Submitted" value={formatDateTime(selected.createdAt)} />
                {selected.approvedAt && (
                  <Row label="Approved" value={formatDateTime(selected.approvedAt)} />
                )}
                {selected.rejectionReason && (
                  <Row label="Rejection reason" value={selected.rejectionReason} />
                )}
              </div>

              {selected.status === "pending" && mode === "reject" && (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <Textarea
                    placeholder="Reason for rejection (visible to the user)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                  />
                </div>
              )}
              {selected.status === "pending" && mode === "approve" && (
                <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
                  <p className="font-medium">Confirm IOU funding</p>
                  <p className="text-muted-foreground">
                    {formatNaira(selected.iouAmount)} will be credited to the user&apos;s
                    wallet immediately. Their property is locked as collateral
                    until the IOU is repaid in full.
                  </p>
                </div>
              )}

              <DialogFooter className="flex-row gap-2">
                {selected.status === "pending" && mode === "none" && (
                  <>
                    <Button variant="destructive" onClick={() => setMode("reject")}>
                      <X className="h-4 w-4" /> Reject
                    </Button>
                    <Button onClick={() => setMode("approve")}>
                      <Check className="h-4 w-4" /> Approve & Fund
                    </Button>
                  </>
                )}
                {mode === "approve" && (
                  <>
                    <Button variant="outline" onClick={() => setMode("none")}>Back</Button>
                    <Button onClick={approve} disabled={working}>
                      {working && <Loader2 className="h-4 w-4 animate-spin" />}
                      Fund wallet now
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
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
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
