"use client";

import { useState } from "react";
import Image from "next/image";
import { orderBy, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { Store, Plus, Star, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VendorFormDialog } from "./vendor-form";

type VendorDoc = {
  id: string;
  name?: string;
  tagline?: string;
  description?: string;
  category?: string;
  location?: string;
  rating?: number;
  reviewCount?: number;
  productCount?: number;
  isVerified?: boolean;
  isFeatured?: boolean;
  isActive?: boolean;
  logoUrl?: string;
  coverUrl?: string;
  tags?: string[];
  createdAt?: unknown;
};

export default function VendorsPage() {
  const [editing, setEditing] = useState<VendorDoc | null>(null);
  const [creating, setCreating] = useState(false);
  const { docs, loading } = useFirestoreQuery<VendorDoc>(Paths.vendors, [
    orderBy("createdAt", "desc"),
  ]);

  async function toggleActive(v: VendorDoc) {
    try {
      await updateDoc(doc(db, Paths.vendors, v.id), {
        isActive: !v.isActive,
      });
      toast.success(v.isActive ? "Vendor deactivated" : "Vendor activated");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  async function toggleFeatured(v: VendorDoc) {
    try {
      await updateDoc(doc(db, Paths.vendors, v.id), {
        isFeatured: !v.isFeatured,
      });
      toast.success(!v.isFeatured ? "Featured" : "Unfeatured");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  async function remove(v: VendorDoc) {
    if (!confirm(`Delete vendor "${v.name}"? Their products stay but become orphaned.`)) return;
    try {
      await deleteDoc(doc(db, Paths.vendors, v.id));
      toast.success("Vendor deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="Vendors"
        description={`${docs.length} marketplace vendors`}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Add vendor
          </Button>
        }
      />
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : docs.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Store}
                title="No vendors yet"
                message="Add a vendor to start populating the marketplace."
                action={
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" /> Add first vendor
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {v.logoUrl ? (
                          <div className="relative h-10 w-10 overflow-hidden rounded-md">
                            <Image src={v.logoUrl} alt="" fill sizes="40px" className="object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                            <Store className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{v.name}</div>
                          <div className="text-xs text-muted-foreground">{v.tagline ?? ""}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{v.category ?? "—"}</TableCell>
                    <TableCell>{v.location ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {v.isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                        {v.isFeatured && <Badge variant="info">Featured</Badge>}
                        {v.isVerified && <Badge variant="default">Verified</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => toggleFeatured(v)}>
                          <Star className={v.isFeatured ? "h-4 w-4 fill-amber-500 text-amber-500" : "h-4 w-4"} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(v)}>
                          {v.isActive ? "Deactivate" : "Activate"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(v)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(v)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <VendorFormDialog
        open={creating || !!editing}
        vendor={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </div>
  );
}
