'use client';
   import { useEffect, useState } from 'react';  import { collection, onSnapshot, query, where } from 'firebase/firestore';
   import { db } from '@/lib/firebase';

   export function usePendingVerificationsCount() {
     const [count, setCount] = useState(0);
    useEffect(() => {
      const q = query(
        collection(db, 'payment_verifications'),
        where('status', '==', 'pending')
      );
       return onSnapshot(q, (snap) => setCount(snap.size));
    }, []);
     return count;
  }
