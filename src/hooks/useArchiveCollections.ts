import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';

/**
 * Listener per leads + registro_pos. Da usare SOLO nell'AdminPanel.
 * Le pagine non-admin NON devono importare questo hook.
 */
export function useArchiveCollections(user: any) {
  const [leads, setLeads] = useState<any[]>([]);
  const [posRecords, setPosRecords] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const col = (name: string) => collection(db, 'artifacts', APP_ID, 'public', 'data', name);
    const u1 = onSnapshot(
      col('leads'),
      (s) => setLeads(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error('[leads]', e)
    );
    const u2 = onSnapshot(
      col('registro_pos'),
      (s) => setPosRecords(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error('[registro_pos]', e)
    );
    return () => { u1(); u2(); };
  }, [user]);

  return { leads, posRecords };
}
