"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadImages } from "@/lib/firestore-helpers";

export function ImageUploader({
  folder,
  value,
  onChange,
  max = 6,
}: {
  folder: string;
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    if (value.length + files.length > max) {
      alert(`Max ${max} images`);
      return;
    }
    setUploading(true);
    try {
      const urls = await uploadImages(folder, files);
      onChange([...value, ...urls]);
    } catch (err: any) {
      alert("Upload failed: " + (err.message ?? "unknown"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((url, i) => (
          <div key={url} className="group relative aspect-square overflow-hidden rounded-md border">
            <Image src={url} alt="" fill sizes="120px" className="object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex aspect-square items-center justify-center rounded-md border border-dashed text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={pick}
      />
      <p className="text-xs text-muted-foreground">
        Up to {max} images. JPEG or PNG. {value.length} of {max} added.
      </p>
    </div>
  );
}
