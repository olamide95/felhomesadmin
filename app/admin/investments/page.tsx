"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, orderBy,
} from "firebase/firestore";
import { TrendingUp, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { Paths, formatNaira, formatCompactNaira } from "@/lib/constants";
import { formatDate } from "@/lib/firestore-helpers";
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

type InvestmentDoc = {
  id: string;
  title?: string;
  description?: string;
  location?: string;
  targetAmount?: number;
  raisedAmount?: number;
  minimumUnit?: number;
  durationMonths?: number;
  projectedRoi?: number;
  status?: string;
  imageUrls?: string[];
  createdAt?: any;
};

export default function InvestmentsPage() {
  const [editing, setEditing] = useState<InvestmentDoc | null>(null);
  const [creating, setCreating] = useState(false);
  const { docs, loading } = useFirestoreQuery<InvestmentDoc>(Paths.investments, [
    orderBy("createdAt", "desc"),
  ]);

  async function remove(p: InvestmentDoc) {
    if (!confirm(`Delete "${p.title}"? Existing participations will be orphaned.`)) return;
    try {
      await deleteDoc(doc(db, Paths.investments, p.id));
      toast.success("Deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="Investment Projects"
        description="Projects users can buy units in"
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New project
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
                icon={TrendingUp}
                title="No investment projects"
                message="Create your first project to make it available to users."
                action={
                  <Button onClick={() => setCreating(true)}>
                    <Plus className="h-4 w-4" /> Create project
                  </Button>
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Raised</TableHead>
                  <TableHead>Min unit</TableHead>
                  <TableHead>ROI</TableHead>
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
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{p.title}</div>
                          <div className="text-xs text-muted-foreground">{p.location}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{formatCompactNaira(p.targetAmount)}</TableCell>
                    <TableCell>{formatCompactNaira(p.raisedAmount)}</TableCell>
                    <TableCell>{formatCompactNaira(p.minimumUnit)}</TableCell>
                    <TableCell>{p.projectedRoi ? `${p.projectedRoi}%` : "—"}</TableCell>
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

      <InvestmentForm
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

function InvestmentForm({
  open, record, onClose,
}: {
  open: boolean;
  record: InvestmentDoc | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: "", description: "", location: "",
    targetAmount: "", minimumUnit: "", durationMonths: "", projectedRoi: "",
    status: "active",
  });
  const [images, setImages] = useState<string[]>([]);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (record) {
      setForm({
        title: record.title ?? "",
        description: record.description ?? "",
        location: record.location ?? "",
        targetAmount: String(record.targetAmount ?? ""),
        minimumUnit: String(record.minimumUnit ?? ""),
        durationMonths: String(record.durationMonths ?? ""),
        projectedRoi: String(record.projectedRoi ?? ""),
        status: record.status ?? "active",
      });
      setImages(record.imageUrls ?? []);
    } else {
      setForm({
        title: "", description: "", location: "",
        targetAmount: "", minimumUnit: "", durationMonths: "", projectedRoi: "",
        status: "active",
      });
      setImages([]);
    }
  }, [record, open]);

  async function submit() {
    if (!form.title.trim() || !form.targetAmount) {
      toast.error("Title and target amount are required");
      return;
    }
    setWorking(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        targetAmount: parseFloat(form.targetAmount.replace(/,/g, "")) || 0,
        minimumUnit: parseFloat(form.minimumUnit.replace(/,/g, "")) || 0,
        durationMonths: parseInt(form.durationMonths) || 12,
        projectedRoi: parseFloat(form.projectedRoi) || 0,
        status: form.status,
        imageUrls: images,
        raisedAmount: record?.raisedAmount ?? 0,
      };
      if (record) {
        await updateDoc(doc(db, Paths.investments, record.id), payload);
        toast.success("Project updated");
      } else {
        await addDoc(collection(db, Paths.investments), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        toast.success("Project created");
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
          <DialogTitle>{record ? "Edit project" : "New investment project"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <Field label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target amount (₦)" value={form.targetAmount} onChange={(v) => setForm({ ...form, targetAmount: v })} />
            <Field label="Minimum unit (₦)" value={form.minimumUnit} onChange={(v) => setForm({ ...form, minimumUnit: v })} />
            <Field label="Duration (months)" value={form.durationMonths} onChange={(v) => setForm({ ...form, durationMonths: v })} />
            <Field label="Projected ROI (%)" value={form.projectedRoi} onChange={(v) => setForm({ ...form, projectedRoi: v })} />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Images</Label>
            <ImageUploader folder="investments" value={images} onChange={setImages} max={5} />
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

function Field({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
