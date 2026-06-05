"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, orderBy,
} from "firebase/firestore";
import { Map, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { Paths, formatNaira, formatCompactNaira } from "@/lib/constants";
import { useFirestoreQuery } from "@/hooks/use-firestore-query";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ImageUploader } from "@/components/image-uploader";
import { StatusBadge } from "@/components/status-badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type LandDoc = {
  id: string;
  title?: string;
  description?: string;
  location?: string;
  price?: number;
  sizeSqm?: number;
  status?: string;
  imageUrls?: string[];
  documentUrls?: string[];
  createdAt?: any;
};

export default function LandPage() {
  const [editing, setEditing] = useState<LandDoc | null>(null);
  const [creating, setCreating] = useState(false);
  const { docs, loading } = useFirestoreQuery<LandDoc>(Paths.lands, [
    orderBy("createdAt", "desc"),
  ]);

  async function remove(p: LandDoc) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    try {
      await deleteDoc(doc(db, Paths.lands, p.id));
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="Land Plots"
        description="Plots available for acquisition"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New plot
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
                icon={Map}
                title="No land plots"
                message="Add plots to make them available in the Site & Services section of the app."
                action={
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" /> Add first plot
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plot</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Price</TableHead>
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
                          <div className="relative h-10 w-14 overflow-hidden rounded">
                            <Image src={p.imageUrls[0]} alt="" fill sizes="56px" className="object-cover" />
                          </div>
                        ) : (
                          <div className="flex h-10 w-14 items-center justify-center rounded bg-muted">
                            <Map className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="font-medium">{p.title}</div>
                      </div>
                    </TableCell>
                    <TableCell>{p.location ?? "—"}</TableCell>
                    <TableCell>{p.sizeSqm ? `${p.sizeSqm} sqm` : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatNaira(p.price)}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LandForm
        open={creating || !!editing}
        record={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function LandForm({
  open, record, onClose,
}: {
  open: boolean;
  record: LandDoc | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: "", description: "", location: "",
    price: "", sizeSqm: "", status: "available",
  });
  const [images, setImages] = useState<string[]>([]);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (record) {
      setForm({
        title: record.title ?? "",
        description: record.description ?? "",
        location: record.location ?? "",
        price: String(record.price ?? ""),
        sizeSqm: String(record.sizeSqm ?? ""),
        status: record.status ?? "available",
      });
      setImages(record.imageUrls ?? []);
    } else {
      setForm({
        title: "", description: "", location: "",
        price: "", sizeSqm: "", status: "available",
      });
      setImages([]);
    }
  }, [record, open]);

  async function submit() {
    if (!form.title.trim() || !form.price) {
      toast.error("Title and price are required");
      return;
    }
    setWorking(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        price: parseFloat(form.price.replace(/,/g, "")) || 0,
        sizeSqm: parseFloat(form.sizeSqm.replace(/,/g, "")) || 0,
        status: form.status,
        imageUrls: images,
      };
      if (record) {
        await updateDoc(doc(db, Paths.lands, record.id), payload);
        toast.success("Plot updated");
      } else {
        await addDoc(collection(db, Paths.lands), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Plot created");
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
          <DialogTitle>{record ? "Edit plot" : "New land plot"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Price (₦)</Label>
              <Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Size (sqm)</Label>
              <Input value={form.sizeSqm} onChange={(e) => setForm({ ...form, sizeSqm: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Images</Label>
            <ImageUploader folder="lands" value={images} onChange={setImages} max={5} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={working}>
            {working && <Loader2 className="h-4 w-4 animate-spin" />}
            {record ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
