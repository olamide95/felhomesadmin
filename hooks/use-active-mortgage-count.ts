  'use client';
  import { useEffect, useState } from 'react';
  import { collection, onSnapshot, query, where } from 'firebase/firestore';
   import { db } from '@/lib/firebase';

   const ACTIVE_STAGES = [
     'submitted', 'documentsReceived', 'reviewing',
     'bankContacted', 'awaitingBankResponse', 'bankApproved',
   ];

   export function useActiveMortgageCount() {
     const [count, setCount] = useState(0);
    useEffect(() => {
      const q = query(
         collection(db, 'mortgage_applications'),
        where('currentStage', 'in', ACTIVE_STAGES)
      );
      return onSnapshot(q, (snap) => setCount(snap.size));
     }, []);
     return count;
   }

