 'use client';
   import { useEffect, useState } from 'react';
   import { collection, onSnapshot, query, where } from 'firebase/firestore';
   import { db } from '@/lib/firebase';

   export function useUnreadSupportCount() {
    const [count, setCount] = useState(0);
   useEffect(() => {
     const q = query(
       collection(db, 'support_threads'),
        where('adminUnreadCount', '>', 0)
      );
      return onSnapshot(q, (snap) => setCount(snap.size));
    }, []);
    return count;
   }
