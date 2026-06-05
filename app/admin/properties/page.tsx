"use client";

import { useState } from "react";
import { orderBy, where, doc, updateDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { Home, ExternalLink, Eye, Check, X, Trash2, Loader2 } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { Paths, formatCompactNaira, formatNaira } from "@/lib/constants";
import { formatDate, formatDateTime } from "@/lib/firestore-helpers";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type PropertyDoc = {
  id: string;
  title?: string;
  description?: string;
  location?: string;
  price?: number;
  category?: string;
  status?: string;
  ownerUid?: string;
  imageUrls?: string[];
  bedrooms?: number;
  bathrooms?: number;
  sizeSqm?: number;
  annualRent?: number;
  createdAt?: unknown;
  approvedAt?: unknown;
  rejectionReason?: string;
};

const STATUS_TABS = ["pending", "approved", "rejected", "sold"] as const;

export default function PropertiesPage() {
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("pending");
  const [selected, setSelected] = useState<PropertyDoc | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const { docs, loading } = useFirestoreQuery<PropertyDoc>(
    Paths.properties,
    [where("status", "==", tab), orderBy("createdAt", "desc")],
    [tab]
  );

  return (
    <div>
      <PageHeader
        title="Properties"
        description="Review and moderate user-submitted property listings"
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
                      icon={Home}
                      title={`No ${s} listings`}
                      message={
                        s === "pending"
                          ? "Nothing to review right now. Listings will appear here as users submit them."
                          : `Properties with ${s} status will appear here.`
                      }
                    />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Submitted</TableHead>
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
                                  <Image
                                    src={p.imageUrls[0]}
                                    alt=""
                                    fill
                                    sizes="56px"
                                    className="object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="flex h-10 w-14 items-center justify-center rounded bg-muted">
                                  <Home className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <div className="font-medium">{p.title ?? "—"}</div>
                                <div className="text-xs text-muted-foreground">
                                  {p.location ?? "—"}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{p.category ?? "—"}</TableCell>
                          <TableCell className="font-medium">
                            {formatCompactNaira(p.price)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {p.ownerUid?.slice(0, 8) ?? "—"}
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(p.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelected(p)}
                            >
                              <Eye className="h-4 w-4" />
                              View
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

      <PropertyDetailsDialog
        property={selected}
        onClose={() => setSelected(null)}
        onReject={(id) => {
          setSelected(null);
          setRejectingId(id);
        }}
      />
      <RejectionDialog
        propertyId={rejectingId}
        onClose={() => setRejectingId(null)}
      />
    </div>
  );
}

function PropertyDetailsDialog({
  property,
  onClose,
  onReject,
}: {
  property: PropertyDoc | null;
  onClose: () => void;
  onReject: (id: string) => void;
}) {
  const [working, setWorking] = useState(false);

  if (!property) return null;

  async function approve() {
    if (!property) return;
    setWorking(true);
    try {
      await updateDoc(doc(db, Paths.properties, property.id), {
        status: "approved",
        approvedAt: serverTimestamp(),
        rejectionReason: null,
      });
      toast.success("Property approved");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to approve");
    } finally {
      setWorking(false);
    }
  }

  async function archive() {
    if (!property) return;
    setWorking(true);
    try {
      await updateDoc(doc(db, Paths.properties, property.id), {
        status: "archived",
      });
      toast.success("Property archived");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setWorking(false);
    }
  }

  async function remove() {
    if (!property) return;
    if (!confirm("Permanently delete this property? This cannot be undone.")) return;
    setWorking(true);
    try {
      await deleteDoc(doc(db, Paths.properties, property.id));
      toast.success("Property deleted");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={!!property} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{property.title ?? "Property"}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <StatusBadge status={property.status} />
            <span>·</span>
            <span className="capitalize">{property.category}</span>
            <span>·</span>
            <span>{property.location}</span>
          </DialogDescription>
        </DialogHeader>

        {(property.imageUrls?.length ?? 0) > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {property.imageUrls!.slice(0, 6).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <div className="relative aspect-square overflow-hidden rounded">
                  <Image src={url} alt="" fill sizes="200px" className="object-cover" />
                </div>
              </a>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <Stat label="Price" value={formatNaira(property.price)} />
          {property.annualRent && (
            <Stat label="Annual rent" value={formatNaira(property.annualRent)} />
          )}
          {property.bedrooms != null && (
            <Stat label="Bedrooms" value={String(property.bedrooms)} />
          )}
          {property.bathrooms != null && (
            <Stat label="Bathrooms" value={String(property.bathrooms)} />
          )}
          {property.sizeSqm != null && (
            <Stat label="Size" value={`${property.sizeSqm} sqm`} />
          )}
          <Stat label="Owner UID" value={property.ownerUid ?? "—"} mono />
          <Stat label="Submitted" value={formatDateTime(property.createdAt)} />
          {property.approvedAt && (
            <Stat label="Approved" value={formatDateTime(property.approvedAt)} />
          )}
        </div>

        {property.description && (
          <div>
            <h4 className="mb-1 text-xs font-medium uppercase text-muted-foreground">
              Description
            </h4>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              {property.description}
            </p>
          </div>
        )}

        {property.status === "rejected" && property.rejectionReason && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <div className="mb-1 text-xs font-medium uppercase text-destructive">
              Rejection reason
            </div>
            <div>{property.rejectionReason}</div>
          </div>
        )}

        <DialogFooter className="flex-row gap-2">
          {property.status === "pending" && (
            <>
              <Button
                variant="destructive"
                onClick={() => onReject(property.id)}
                disabled={working}
              >
                <X className="h-4 w-4" /> Reject
              </Button>
              <Button onClick={approve} disabled={working}>
                {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Approve
              </Button>
            </>
          )}
          {property.status === "approved" && (
            <Button variant="outline" onClick={archive} disabled={working}>
              Archive
            </Button>
          )}
          {(property.status === "rejected" || property.status === "archived") && (
            <Button variant="destructive" onClick={remove} disabled={working}>
              <Trash2 className="h-4 w-4" /> Delete forever
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectionDialog({
  propertyId,
  onClose,
}: {
  propertyId: string | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  async function submit() {
    if (!propertyId) return;
    const r = reason.trim();
    if (r.length < 5) {
      toast.error("Provide a reason of at least 5 characters.");
      return;
    }
    setWorking(true);
    try {
      await updateDoc(doc(db, Paths.properties, propertyId), {
        status: "rejected",
        rejectionReason: r,
      });
      toast.success("Property rejected");
      setReason("");
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={!!propertyId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject property</DialogTitle>
          <DialogDescription>
            The user will see this reason in their My Properties screen.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Why is this listing being rejected? (e.g. low-quality images, suspicious pricing, duplicate listing)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={working}>
            {working && <Loader2 className="h-4 w-4 animate-spin" />}
            Reject listing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-xs" : "text-sm"}>{value}</div>
    </div>
  );
}
