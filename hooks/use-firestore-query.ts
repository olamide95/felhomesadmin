'use client';

import { useEffect, useState } from 'react';
import {
  collection, onSnapshot, query,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useFirestoreQuery<T extends { id: string }>(
  path: string,
  constraints: QueryConstraint[] = [],
  deps: unknown[] = [],
) {
  const [docs, setDocs] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const q = query(collection(db, path), ...constraints);
    const unsub = onSnapshot(
      q,
      (snap) => {
        setDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() } as T)));
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  return { docs, loading, error };
}
