import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as fbLimit,
  Unsubscribe,
} from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import type { Order } from '@/lib/constants';

/**
 * Listener Firestore CONDIVISO sugli ordini ATTIVI.
 *
 * - 1 sola sottoscrizione fisica per (statusKey + limit), refcounted tra i consumer.
 * - Filtri: where("status","in",[...]) + orderBy timestamp desc + limit.
 * - Riduce drasticamente le letture rispetto al vecchio listener su tutta la collection.
 *
 * Indice Firestore richiesto: orders (status ASC, timestamp DESC).
 * Il primo errore in console fornirà il link diretto per la creazione.
 */

export const ACTIVE_STATUSES_DEFAULT = [
  'pending',
  'unconfirmed',
  'in_preparation',
  'ready',
] as const;

type Status = string;

interface SharedEntry {
  refCount: number;
  unsub: Unsubscribe | null;
  orders: Order[];
  listeners: Set<(orders: Order[]) => void>;
}

const shared = new Map<string, SharedEntry>();

function keyFor(statuses: readonly Status[], limit: number) {
  return `${[...statuses].sort().join('|')}::${limit}`;
}

function subscribe(
  statuses: readonly Status[],
  limit: number,
  user: any,
  cb: (orders: Order[]) => void
): () => void {
  const key = keyFor(statuses, limit);
  let entry = shared.get(key);
  if (!entry) {
    entry = { refCount: 0, unsub: null, orders: [], listeners: new Set() };
    shared.set(key, entry);
  }
  entry.refCount += 1;
  entry.listeners.add(cb);
  // Snapshot immediato per il nuovo consumer
  cb(entry.orders);

  if (!entry.unsub && user) {
    const ordersCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'orders');

    const handleSnap = (s: any) => {
      const list = s.docs
        .map((d: any) => ({ id: d.id, ...d.data() } as Order))
        .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      entry!.orders = list;
      entry!.listeners.forEach((l) => l(list));
    };

    // Fallback senza orderBy server-side: non richiede indice composito.
    const startFallback = () => {
      try {
        console.warn('[useActiveOrders] FALLBACK no-index — query senza orderBy, sort lato client', { key });
        const qFallback = query(
          ordersCol,
          where('status', 'in', [...statuses]),
          fbLimit(limit)
        );
        entry!.unsub = onSnapshot(
          qFallback,
          handleSnap,
          (e: any) => {
            console.error('[useActiveOrders] FALLBACK snapshot error', {
              code: e?.code,
              message: e?.message,
              key,
            }, e);
          }
        );
      } catch (e: any) {
        console.error('[useActiveOrders] FALLBACK subscribe failed', { code: e?.code, message: e?.message }, e);
      }
    };

    try {
      const q = query(
        ordersCol,
        where('status', 'in', [...statuses]),
        orderBy('timestamp', 'desc'),
        fbLimit(limit)
      );
      console.log('[useActiveOrders] subscribe', { key, limit, statuses });
      entry.unsub = onSnapshot(
        q,
        handleSnap,
        (e: any) => {
          const code = e?.code;
          const message = e?.message || String(e);
          console.error('[useActiveOrders] snapshot error', { code, message, key }, e);
          if (code === 'failed-precondition') {
            console.warn('[useActiveOrders] indice composito mancante (status ASC + timestamp DESC). Attivo fallback.');
            try { entry!.unsub?.(); } catch {}
            entry!.unsub = null;
            startFallback();
          }
        }
      );
    } catch (e: any) {
      console.error('[useActiveOrders] subscribe failed', { code: e?.code, message: e?.message }, e);
      if (e?.code === 'failed-precondition') startFallback();
    }
  }

  return () => {
    const cur = shared.get(key);
    if (!cur) return;
    cur.listeners.delete(cb);
    cur.refCount -= 1;
    if (cur.refCount <= 0) {
      try { cur.unsub?.(); } catch {}
      shared.delete(key);
      console.log('[useActiveOrders] unsubscribe (last consumer)', { key });
    }
  };
}

export function useActiveOrders(
  user: any,
  opts?: { statuses?: readonly Status[]; limit?: number; enabled?: boolean }
) {
  const statuses = opts?.statuses || ACTIVE_STATUSES_DEFAULT;
  const limit = opts?.limit ?? 100;
  const enabled = opts?.enabled !== false; // default true (retro-compat)
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!user || !enabled) return;
    const off = subscribe(statuses, limit, user, setOrders);
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, limit, enabled, statuses.join('|')]);

  return orders;
}

/** Snapshot corrente del listener condiviso, senza aprire un nuovo listener. */
export function getSharedActiveOrders(
  statuses: readonly Status[] = ACTIVE_STATUSES_DEFAULT,
  limit = 100
): Order[] {
  const entry = shared.get(keyFor(statuses, limit));
  return entry?.orders || [];
}
