"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  type DocumentData,
  type Query,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type FirestoreDoc<T = DocumentData> = { id: string } & T;

export function useFirestoreQuery<T = DocumentData>(
  path: string,
  constraints: QueryConstraint[] = [],
  deps: any[] = []
) {
  const [docs, setDocs] = useState<FirestoreDoc<T>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const q: Query = constraints.length
      ? query(collection(db, path), ...constraints)
      : collection(db, path);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { docs, loading, error };
}
