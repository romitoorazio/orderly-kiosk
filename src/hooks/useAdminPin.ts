import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';

const ENV_ADMIN_PIN = String(import.meta.env.VITE_ADMIN_PIN || '1234').trim();

/**
 * Listener su un SINGOLO documento (settings/admin).
 * 1 read iniziale + reads su update. Sostituisce useFirestoreData solo per il PIN.
 */
export function useAdminPin(user: any) {
  const [adminPin, setAdminPin] = useState<string>(ENV_ADMIN_PIN);

  useEffect(() => {
    if (!user) return;
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'settings', 'admin');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data: any = snap.data() || {};
        setAdminPin(typeof data.pin === 'string' ? data.pin.trim() : ENV_ADMIN_PIN);
      },
      (e) => console.error('[useAdminPin] error', e)
    );
    return () => unsub();
  }, [user]);

  return adminPin;
}
