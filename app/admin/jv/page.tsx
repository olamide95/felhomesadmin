"use client";

import { useState } from "react";
import Image from "next/image";
import {
  orderBy, where, doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { Handshake, Check, X, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { Paths, formatNaira } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/firestore-helpers";
import { useFirestoreQuery } from "@/hooks/use-firestore-query";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type JvDoc = {
  id: string;
  uid?: string;
  landLocation?: string;
  landSize?: number;
  description?: string;
  status?: string;
  imageUrls?: string[];
  documentUrls?: string[];
  partnership?: string;
  createdAt?: unknown;
  rejectionReason?: string;
  adminNotes?: string;
};

const STATUS_TABS = ["pending", "under_review", "approved", "in_progress", "completed", "rejected"] as const;

export default function JvPage() {
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("pending");
  const [selected, setSelected] = useState<JvDoc | null>(null);
  const { docs, loading } = useFirestoreQuery<JvDoc>(
    Paths.jvProjects,
    [where("status", "==", tab), orderBy("createdAt", "desc")],
    [tab]
  );

  return (
    <div>
      <PageHeader
        title="Joint Ventures"
        description="Review JV proposals where users offer land for Felhomes to develop"
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          {STATUS_TABS.map((s) => (
            <TabsTrigger key={s} value={s} className="capitalize">
              {s.replace("_", " ")}
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
                      icon={Handshake}
                      title={`No ${s.replace("_", " ")} proposals`}
                      message="JV proposals submitted by users will appear here."
                    />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Land</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Submitted by</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {docs.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              {p.imageUrls?.[0] ? (
                                <div className="relative h-10 w-14 overflow-hidden rounded">
                                  <Image src={p.imageUrls[0]} alt="" fill sizes="56px" className="object-cover" />
                                </div>
                              ) : (
                                <div className="flex h-10 w-14 items-center justify-center rounded bg-muted">
                                  <Handshake className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div className="font-medium">{p.landLocation ?? "—"}</div>
                            </div>
                          </TableCell>
                          <TableCell>{p.landSize ? `${p.landSize} sqm` : "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{p.uid?.slice(0, 8) ?? "—"}</TableCell>
                          <TableCell className="text-sm">{formatDate(p.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelected(p)}>
                              <Eye className="h-4 w-4" /> Review
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
      <JvReviewDialog jv={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function JvReviewDialog({ jv, onClose }: { jv: JvDoc | null; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"none" | "approve" | "reject">("none");
  const [working, setWorking] = useState(false);

  async function setStatus(status: string, extra: Record<string, unknown> = {}) {
    if (!jv) return;
    setWorking(true);
    try {
      await updateDoc(doc(db, Paths.jvProjects, jv.id), {
        status,
        processedAt: serverTimestamp(),
        ...extra,
      });
      toast.success("Updated");
      setMode("none");
      setNote("");
      setReason("");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setWorking(false);
    }
  }

  if (!jv) return null;
  return (
    <Dialog open={!!jv} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>JV Proposal</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <StatusBadge status={jv.status} />
            <span>·</span>
            <span>{jv.landLocation}</span>
          </DialogDescription>
        </DialogHeader>
        {(jv.imageUrls?.length ?? 0) > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {jv.imageUrls!.slice(0, 6).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <div className="relative aspect-square overflow-hidden rounded">
                  <Image src={url} alt="" fill sizes="200px" className="object-cover" />
                </div>
              </a>
            ))}
          </div>
        )}
        <div className="space-y-2 text-sm">
          <Row label="Location" value={jv.landLocation ?? "—"} />
          <Row label="Size" value={jv.landSize ? `${jv.landSize} sqm` : "—"} />
          <Row label="Submitted by" value={<span className="font-mono text-xs">{jv.uid}</span>} />
          <Row label="Submitted" value={formatDateTime(jv.createdAt)} />
          {jv.partnership && <Row label="Partnership terms" value={jv.partnership} />}
          {jv.adminNotes && <Row label="Admin notes" value={jv.adminNotes} />}
          {jv.rejectionReason && <Row label="Rejection reason" value={jv.rejectionReason} />}
        </div>
        {jv.description && (
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase text-muted-foreground">Description</h4>
            <p className="whitespace-pre-wrap text-sm">{jv.description}</p>
          </div>
        )}

        {mode === "approve" && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <p className="text-sm font-medium">Admin notes (optional)</p>
            <Textarea
              placeholder="Internal notes about this approval"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        )}
        {mode === "reject" && (
          <Textarea
            placeholder="Why is this being rejected?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        )}

        <DialogFooter className="flex-row flex-wrap gap-2">
          {jv.status === "pending" && mode === "none" && (
            <>
              <Button variant="destructive" onClick={() => setMode("reject")}>
                <X className="h-4 w-4" /> Reject
              </Button>
              <Button variant="outline" onClick={() => setStatus("under_review")}>
                Move to under review
              </Button>
              <Button onClick={() => setMode("approve")}>
                <Check className="h-4 w-4" /> Approve
              </Button>
            </>
          )}
          {jv.status === "under_review" && (
            <>
              <Button variant="destructive" onClick={() => setMode("reject")}>
                <X className="h-4 w-4" /> Reject
              </Button>
              <Button onClick={() => setMode("approve")}>
                <Check className="h-4 w-4" /> Approve
              </Button>
            </>
          )}
          {jv.status === "approved" && (
            <Button onClick={() => setStatus("in_progress")}>Mark in progress</Button>
          )}
          {jv.status === "in_progress" && (
            <Button onClick={() => setStatus("completed")}>Mark completed</Button>
          )}
          {mode === "approve" && (
            <>
              <Button variant="outline" onClick={() => setMode("none")}>Back</Button>
              <Button
                onClick={() =>
                  setStatus("approved", note.trim() ? { adminNotes: note.trim() } : {})
                }
                disabled={working}
              >
                {working && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm approval
              </Button>
            </>
          )}
          {mode === "reject" && (
            <>
              <Button variant="outline" onClick={() => setMode("none")}>Back</Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (reason.trim().length < 5) {
                    toast.error("Provide a reason");
                    return;
                  }
                  setStatus("rejected", { rejectionReason: reason.trim() });
                }}
                disabled={working}
              >
                {working && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm rejection
              </Button>
            </>
          )}
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
