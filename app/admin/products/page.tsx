"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
  getDocs,
  query,
} from "firebase/firestore";
import { Package, Plus, Pencil, Trash2, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { Paths, formatNaira } from "@/lib/constants";
import { useFirestoreQuery } from "@/hooks/use-firestore-query";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ImageUploader } from "@/components/image-uploader";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProductDoc = {
  id: string;
  vendorId?: string;
  name?: string;
  description?: string;
  price?: number;
  originalPrice?: number;
  unit?: string;
  stock?: number;
  category?: string;
  imageUrls?: string[];
  specifications?: string[];
  isFeatured?: boolean;
  isInStock?: boolean;
  isActive?: boolean;
};

const CATEGORIES = [
  "buildingMaterials",
  "furniture",
  "appliances",
  "fittings",
  "electricals",
  "plumbing",
  "decor",
  "tools",
  "other",
];

export default function ProductsPage() {
  const [editing, setEditing] = useState<ProductDoc | null>(null);
  const [creating, setCreating] = useState(false);
  const { docs, loading } = useFirestoreQuery<ProductDoc>(Paths.products, [
    orderBy("name"),
  ]);

  async function remove(p: ProductDoc) {
    if (!confirm(`Delete "${p.name}"?`)) return;
    try {
      await deleteDoc(doc(db, Paths.products, p.id));
      toast.success("Product deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  async function toggle(p: ProductDoc, field: "isActive" | "isFeatured") {
    try {
      await updateDoc(doc(db, Paths.products, p.id), {
        [field]: !p[field],
      });
      toast.success("Updated");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description={`${docs.length} products in marketplace`}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> Add product
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
                icon={Package}
                title="No products yet"
                message="Add products to the marketplace under each vendor."
                action={
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" /> Add first product
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {docs.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {p.imageUrls?.[0] ? (
                          <div className="relative h-10 w-10 overflow-hidden rounded-md">
                            <Image src={p.imageUrls[0]} alt="" fill sizes="40px" className="object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="font-medium">{p.name}</div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.vendorId?.slice(0, 10) ?? "—"}</TableCell>
                    <TableCell className="capitalize">{p.category ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatNaira(p.price)}</TableCell>
                    <TableCell>{p.stock ?? 0}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                        {p.isFeatured && <Badge variant="info">Featured</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => toggle(p, "isFeatured")}>
                          <Star className={p.isFeatured ? "h-4 w-4 fill-amber-500 text-amber-500" : "h-4 w-4"} />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => toggle(p, "isActive")}>
                          {p.isActive ? "Hide" : "Show"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => remove(p)}>
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

      <ProductFormDialog
        open={creating || !!editing}
        product={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function ProductFormDialog({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product: ProductDoc | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    vendorId: "",
    name: "",
    description: "",
    price: "",
    originalPrice: "",
    unit: "item",
    stock: "",
    category: "buildingMaterials",
    specifications: "",
    isFeatured: false,
    isInStock: true,
    isActive: true,
  });
  const [images, setImages] = useState<string[]>([]);
  const [working, setWorking] = useState(false);
  const [vendors, setVendors] = useState<{ id: string; name: string }[]>([]);

  // Load vendor list once for the dropdown
  useEffect(() => {
    (async () => {
      const snap = await getDocs(query(collection(db, Paths.vendors), orderBy("name")));
      setVendors(snap.docs.map((d) => ({ id: d.id, name: (d.data().name as string) ?? d.id })));
    })().catch(() => {});
  }, []);

  useEffect(() => {
    if (product) {
      setForm({
        vendorId: product.vendorId ?? "",
        name: product.name ?? "",
        description: product.description ?? "",
        price: String(product.price ?? ""),
        originalPrice: String(product.originalPrice ?? ""),
        unit: product.unit ?? "item",
        stock: String(product.stock ?? ""),
        category: product.category ?? "buildingMaterials",
        specifications: (product.specifications ?? []).join("\n"),
        isFeatured: product.isFeatured ?? false,
        isInStock: product.isInStock ?? true,
        isActive: product.isActive ?? true,
      });
      setImages(product.imageUrls ?? []);
    } else {
      setForm({
        vendorId: "",
        name: "",
        description: "",
        price: "",
        originalPrice: "",
        unit: "item",
        stock: "",
        category: "buildingMaterials",
        specifications: "",
        isFeatured: false,
        isInStock: true,
        isActive: true,
      });
      setImages([]);
    }
  }, [product, open]);

  async function submit() {
    if (!form.name.trim() || !form.vendorId || !form.price) {
      toast.error("Name, vendor, and price are required");
      return;
    }
    setWorking(true);
    try {
      const payload = {
        vendorId: form.vendorId,
        name: form.name.trim(),
        description: form.description.trim(),
        price: parseFloat(form.price.replace(/,/g, "")) || 0,
        originalPrice: form.originalPrice ? parseFloat(form.originalPrice.replace(/,/g, "")) : null,
        unit: form.unit.trim() || "item",
        stock: parseInt(form.stock) || 0,
        category: form.category,
        imageUrls: images,
        specifications: form.specifications
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        isFeatured: form.isFeatured,
        isInStock: form.isInStock,
        isActive: form.isActive,
        rating: product?.["rating" as keyof ProductDoc] ?? 0,
        reviewCount: product?.["reviewCount" as keyof ProductDoc] ?? 0,
      };
      if (product) {
        await updateDoc(doc(db, Paths.products, product.id), payload);
        toast.success("Product updated");
      } else {
        await addDoc(collection(db, Paths.products), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Product created");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {product ? "Edit product" : "Add product"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Vendor</Label>
            <Select
              value={form.vendorId}
              onValueChange={(v) => setForm({ ...form, vendorId: v })}
            >
              <SelectTrigger><SelectValue placeholder="Select a vendor" /></SelectTrigger>
              <SelectContent>
                {vendors.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vendors.length === 0 && (
              <p className="text-xs text-amber-600">
                No vendors yet. Add one in the Vendors section first.
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Price (₦)</Label>
              <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Original price (optional)</Label>
              <Input value={form.originalPrice} onChange={(e) => setForm({ ...form, originalPrice: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Unit</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="bag, item, pcs" />
            </div>
            <div className="grid gap-2">
              <Label>Stock</Label>
              <Input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Specifications (one per line)</Label>
            <Textarea
              value={form.specifications}
              onChange={(e) => setForm({ ...form, specifications: e.target.value })}
              rows={4}
              placeholder="50kg bag&#10;Grade 42.5&#10;Made in Nigeria"
            />
          </div>
          <div className="grid gap-2">
            <Label>Images</Label>
            <ImageUploader folder="products" value={images} onChange={setImages} max={6} />
          </div>
          <div className="flex gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4"
              />
              Active
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={form.isFeatured}
                onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
                className="h-4 w-4"
              />
              Featured
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={form.isInStock}
                onChange={(e) => setForm({ ...form, isInStock: e.target.checked })}
                className="h-4 w-4"
              />
              In stock
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={working}>
            {working && <Loader2 className="h-4 w-4 animate-spin" />}
            {product ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
