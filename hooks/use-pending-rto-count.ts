 'use client';
   import { useEffect, useState } from 'react';
   import { collection, onSnapshot, query, where } from 'firebase/firestore';
   import { db } from '@/lib/firebase';
   export function usePendingRtoCount() {
    const [count, setCount] = useState(0);
    useEffect(() => {
       const q = query(
       collection(db, 'rent_to_own_applications'),
        where('status', '==', 'pending')
      );
      return onSnapshot(q, (snap) => setCount(snap.size));
    }, []);
    return count;
   }
