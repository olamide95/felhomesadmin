"use client";

import { useEffect, useState } from "react";
import { collection, doc, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { Paths } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUploader } from "@/components/image-uploader";

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

export function VendorFormDialog({
  open,
  vendor,
  onClose,
}: {
  open: boolean;
  vendor: any | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    tagline: "",
    description: "",
    category: "buildingMaterials",
    location: "",
    tags: "",
    isVerified: true,
    isActive: true,
    isFeatured: false,
  });
  const [logoUrls, setLogoUrls] = useState<string[]>([]);
  const [coverUrls, setCoverUrls] = useState<string[]>([]);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (vendor) {
      setForm({
        name: vendor.name ?? "",
        tagline: vendor.tagline ?? "",
        description: vendor.description ?? "",
        category: vendor.category ?? "buildingMaterials",
        location: vendor.location ?? "",
        tags: (vendor.tags ?? []).join(", "),
        isVerified: vendor.isVerified ?? true,
        isActive: vendor.isActive ?? true,
        isFeatured: vendor.isFeatured ?? false,
      });
      setLogoUrls(vendor.logoUrl ? [vendor.logoUrl] : []);
      setCoverUrls(vendor.coverUrl ? [vendor.coverUrl] : []);
    } else {
      setForm({
        name: "",
        tagline: "",
        description: "",
        category: "buildingMaterials",
        location: "",
        tags: "",
        isVerified: true,
        isActive: true,
        isFeatured: false,
      });
      setLogoUrls([]);
      setCoverUrls([]);
    }
  }, [vendor, open]);

  async function submit() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setWorking(true);
    try {
      const payload = {
        name: form.name.trim(),
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        category: form.category,
        location: form.location.trim(),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        isVerified: form.isVerified,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        logoUrl: logoUrls[0] ?? null,
        coverUrl: coverUrls[0] ?? null,
        rating: vendor?.rating ?? 0,
        reviewCount: vendor?.reviewCount ?? 0,
        productCount: vendor?.productCount ?? 0,
      };

      if (vendor) {
        await updateDoc(doc(db, Paths.vendors, vendor.id), payload);
        toast.success("Vendor updated");
      } else {
        await addDoc(collection(db, Paths.vendors), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Vendor created");
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
            <Store className="h-5 w-5" />
            {vendor ? "Edit vendor" : "Add vendor"}
          </DialogTitle>
          <DialogDescription>
            Vendors appear in the mobile marketplace once activated.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Tagline</Label>
            <Input
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              placeholder="Short slogan shown under name"
            />
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
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Location</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Lagos"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Tags (comma-separated)</Label>
            <Input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="cement, blocks, steel"
            />
          </div>

          <div className="grid gap-2">
            <Label>Logo</Label>
            <ImageUploader folder="vendor_logos" value={logoUrls} onChange={setLogoUrls} max={1} />
          </div>
          <div className="grid gap-2">
            <Label>Cover image</Label>
            <ImageUploader folder="vendor_covers" value={coverUrls} onChange={setCoverUrls} max={1} />
          </div>

          <div className="flex flex-wrap gap-4">
            <FlagToggle
              label="Active"
              checked={form.isActive}
              onChange={(v) => setForm({ ...form, isActive: v })}
            />
            <FlagToggle
              label="Verified"
              checked={form.isVerified}
              onChange={(v) => setForm({ ...form, isVerified: v })}
            />
            <FlagToggle
              label="Featured"
              checked={form.isFeatured}
              onChange={(v) => setForm({ ...form, isFeatured: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={working}>
            {working && <Loader2 className="h-4 w-4 animate-spin" />}
            {vendor ? "Save changes" : "Create vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FlagToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}
