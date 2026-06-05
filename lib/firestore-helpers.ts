import { Timestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

export function tsToDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDate(v: unknown, opts?: Intl.DateTimeFormatOptions): string {
  const d = tsToDate(v);
  if (!d) return "—";
  return d.toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...opts,
  });
}

export function formatDateTime(v: unknown): string {
  const d = tsToDate(v);
  if (!d) return "—";
  return d.toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function uploadImages(folder: string, files: File[]): Promise<string[]> {
  if (!files.length) return [];
  const urls: string[] = [];
  for (const file of files) {
    const path = `admin_uploads/${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const r = ref(storage, path);
    await uploadBytes(r, file);
    const url = await getDownloadURL(r);
    urls.push(url);
  }
  return urls;
}
