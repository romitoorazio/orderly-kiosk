import { useState, useEffect, useCallback } from 'react';
import { collection, doc, onSnapshot, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { resolveBackendUrl } from '@/lib/constants';
import type { Department, MenuItem, Ingredient, Order } from '@/lib/constants';
import { ACTIVE_STATUSES_DEFAULT } from '@/hooks/useActiveOrders';

const ENV_ADMIN_PIN = String(import.meta.env.VITE_ADMIN_PIN || '1234').trim();
const ENV_PRODUCTION_MODE = String(import.meta.env.VITE_KIOSK_PRODUCTION || '').toLowerCase() === 'true';

export interface UseFirestoreDataOptions {
  /**
   * Modalità "leggera" per mobile QR.
   * - departments / menu_items / ingredients: getDocs ONE-SHOT (no listener live)
   * - settings: solo `payment` + `promo` (live, doc-listener)
   * - NIENTE beepers / printer / wheel / admin
   */
  mobile?: boolean;
}

/**
 * Wrapper di accesso a Firestore.
 *
 * - `settings` non è più ascoltato come collection: doc-listener separati
 *   (payment, promo, beepers, printer). `admin` → useAdminPin. `wheel` → WheelGame.
 * - In modalità mobile menu/dept/ingredients sono `getDocs` one-shot (no resub)
 *   e settings live solo per payment + promo.
 * - Nessun listener su `orders` / `leads` / `registro_pos` (vedi useActiveOrders /
 *   useArchiveCollections). `orders` qui resta sempre `[]` per compat di shape.
 */
export function useFirestoreData(user: any, opts?: UseFirestoreDataOptions) {
  const isMobile = !!opts?.mobile;

  const [departments, setDepartments] = useState<Department[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [ingredientsPool, setIngredientsPool] = useState<Ingredient[]>([]);
  const [promoConfig, setPromoConfig] = useState({ active: false, productId: '', price: 0, message: '' });
  const [beeperSettings, setBeeperSettings] = useState<boolean[]>(Array(16).fill(true));
  const [paymentSettings, setPaymentSettings] = useState({ sumupActive: false, backendUrl: '' });
  const [printerSettings, setPrinterSettings] = useState({ active: true });
  // Compat shape — non più ascoltati qui:
  const [wheelSettings] = useState<any>({ active: true, gameType: 'slot', prizes: [] });
  const [adminPin] = useState(ENV_ADMIN_PIN);
  const [securitySettings] = useState({ productionMode: ENV_PRODUCTION_MODE });

  // ───────────── menu / dept / ingredients ─────────────
  useEffect(() => {
    if (!user) return;

    const col = (name: string) => collection(db, 'artifacts', APP_ID, 'public', 'data', name);
    const errHandler = (e: any) => console.error('[useFirestoreData]', e);

    if (isMobile) {
      // 📱 ONE-SHOT: il menu non cambia durante la sessione del cliente al telefono.
      let cancelled = false;
      console.log('[useFirestoreData] mobile mode — one-shot getDocs(menu/dept/ingredients)');
      (async () => {
        try {
          const [depSnap, menuSnap, ingSnap] = await Promise.all([
            getDocs(col('departments')),
            getDocs(col('menu_items')),
            getDocs(col('ingredients')),
          ]);
          if (cancelled) return;
          setDepartments(depSnap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
          setMenuItems(menuSnap.docs.map(d => {
            const raw = d.data();
            return { id: d.id, ...raw, departmentId: raw.departmentId || raw.department || '', isBaseProduct: raw.isBaseProduct || false } as MenuItem;
          }));
          setIngredientsPool(ingSnap.docs.map(d => {
            const raw = d.data();
            return { id: d.id, ...raw, sortOrder: raw.sortOrder } as Ingredient & { imageUrl?: string; sortOrder?: number };
          }));
        } catch (e) {
          console.error('[useFirestoreData] mobile one-shot failed', e);
        }
      })();
      return () => { cancelled = true; };
    }

    // 🖥️ Totem fisso / cassa / cucina / admin: listener live (il menu può cambiare in negozio).
    const unsubs = [
      onSnapshot(col('departments'), (s) => setDepartments(s.docs.map(d => ({ id: d.id, ...d.data() } as Department))), errHandler),
      onSnapshot(col('menu_items'), (s) => setMenuItems(s.docs.map(d => {
        const raw = d.data();
        return { id: d.id, ...raw, departmentId: raw.departmentId || raw.department || '', isBaseProduct: raw.isBaseProduct || false } as MenuItem;
      })), errHandler),
      onSnapshot(col('ingredients'), (s) => setIngredientsPool(s.docs.map(d => {
        const raw = d.data();
        return { id: d.id, ...raw, sortOrder: raw.sortOrder } as Ingredient & { imageUrl?: string; sortOrder?: number };
      })), errHandler),
    ];

    return () => unsubs.forEach(u => u());
  }, [user, isMobile]);

  // ───────────── settings (doc-listener specifici) ─────────────
  useEffect(() => {
    if (!user) return;

    const settingDoc = (id: string) => doc(db, 'artifacts', APP_ID, 'public', 'data', 'settings', id);
    const errHandler = (id: string) => (e: any) => console.error(`[settings/${id}]`, e);

    const unsubs: Array<() => void> = [];

    // payment + promo: SEMPRE attivi (servono in mobile per backendUrl/sumupActive e promo).
    unsubs.push(onSnapshot(settingDoc('payment'), (s) => {
      const pData: any = s.data() || {};
      setPaymentSettings({
        sumupActive: pData?.sumupActive || false,
        backendUrl: resolveBackendUrl(pData?.backendUrl, typeof window !== 'undefined' ? window.location.origin : undefined),
      });
    }, errHandler('payment')));

    unsubs.push(onSnapshot(settingDoc('promo'), (s) => {
      setPromoConfig((s.data() as any) || { active: false, productId: '', price: 0, message: '' });
    }, errHandler('promo')));

    if (!isMobile) {
      // beepers + printer: solo dispositivi operativi.
      unsubs.push(onSnapshot(settingDoc('beepers'), (s) => {
        setBeeperSettings(s.data()?.status || Array(16).fill(true));
      }, errHandler('beepers')));

      unsubs.push(onSnapshot(settingDoc('printer'), (s) => {
        setPrinterSettings({ active: s.data()?.active !== false });
      }, errHandler('printer')));
    }

    return () => unsubs.forEach(u => u());
  }, [user, isMobile]);

  const fetchOrdersInRange = useCallback(async (startMs: number, endMs: number): Promise<Order[]> => {
    const ordersCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'orders');
    const sortClient = (list: any[]) =>
      list.sort((a, b) => (Number(b.clientTimestamp) || 0) - (Number(a.clientTimestamp) || 0));
    try {
      const q = query(
        ordersCol,
        where('clientTimestamp', '>=', startMs),
        where('clientTimestamp', '<=', endMs),
        orderBy('clientTimestamp', 'desc')
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
      sortClient(list);
      return list;
    } catch (e: any) {
      // Fallback no-index: se manca l'indice composito, query senza orderBy + sort client.
      const code = String(e?.code || e?.message || '');
      if (code.includes('failed-precondition') || code.includes('index')) {
        console.warn('[fetchOrdersInRange] index missing, fallback no-orderBy', e?.message);
        try {
          const q2 = query(
            ordersCol,
            where('clientTimestamp', '>=', startMs),
            where('clientTimestamp', '<=', endMs),
          );
          const snap2 = await getDocs(q2);
          const list2 = snap2.docs.map(d => ({ id: d.id, ...d.data() } as Order));
          sortClient(list2);
          return list2;
        } catch (e2) {
          console.error('[fetchOrdersInRange] fallback failed', e2);
          throw e2;
        }
      }
      console.error('[fetchOrdersInRange] failed', e);
      throw e;
    }
  }, []);

  return {
    departments,
    menuItems,
    ingredientsPool,
    orders: [] as Order[], // ⚠️ usa useActiveOrders nei consumer
    promoConfig,
    beeperSettings,
    paymentSettings,
    printerSettings,
    wheelSettings,           // ⚠️ deprecato — WheelGame ha già il suo listener
    adminPin,                // ⚠️ deprecato — usa useAdminPin
    securitySettings,        // ⚠️ deprecato
    leads: [] as any[],      // ⚠️ deprecato — usa useArchiveCollections
    posRecords: [] as any[], // ⚠️ deprecato — usa useArchiveCollections
    fetchOrdersInRange,
  };
}

export { ACTIVE_STATUSES_DEFAULT };
