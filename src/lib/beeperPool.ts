// 🔓 Rilascio beeper — chiamato quando un ordine è delivered/cancelled/closed.
// Idempotente: se il numero non è in activeBeepers, no-op.
// Da A.2.2 il range fisico è configurabile da Admin; fallback default range configurabile.
import { doc, runTransaction, collection, query, where, getDocs } from "firebase/firestore";
import { db, APP_ID } from "@/lib/firebase";
import { normalizeBeeperConfig, readGlobalBeeperConfig, type BeeperRuntimeConfig } from "@/lib/beeperConfig";

export const releaseBeeper = async (rawNum: any, config?: Partial<BeeperRuntimeConfig> | null): Promise<void> => {
  const cfg = normalizeBeeperConfig(config || readGlobalBeeperConfig());
  const n = Number(rawNum);
  console.log(`[Beeper] release requested #${rawNum} → ${n}`);

  if (!cfg.enabled || !Number.isFinite(n) || n < cfg.rangeMin || n > cfg.rangeMax) {
    console.log(`[Beeper] release skipped: disabled/out of range (${cfg.rangeMin}-${cfg.rangeMax})`);
    return;
  }

  const poolRef = doc(db, "artifacts", APP_ID, "public", "data", "counters", "beeperPool");
  try {
    await runTransaction(db, async (t) => {
      const snap = await t.get(poolRef);
      if (!snap.exists()) {
        console.log(`[Beeper] pool doc missing, skip`);
        return;
      }
      const data = snap.data() as any;
      const active: number[] = (Array.isArray(data.activeBeepers) ? data.activeBeepers : [])
        .map((x: any) => Number(x))
        .filter((x: number) => Number.isFinite(x));

      console.log(`[Beeper] active before`, active);

      if (!active.includes(n)) {
        console.log(`[Beeper] #${n} not in pool, skip`);
        return;
      }
      const next = active.filter((x) => x !== n);
      console.log(`[Beeper] active after`, next);
      t.update(poolRef, { activeBeepers: next, updatedAt: Date.now() });
    });
    console.log(`[Beeper] released #${n}`);
  } catch (e) {
    console.warn(`[Beeper] release failed for #${n}`, e);
  }
};

// 🧹 RECONCILE — ricostruisce activeBeepers leggendo gli ordini realmente attivi.
// Rimuove beeper "fantasma". Idempotente, safe in offline (catch silenzioso).
const ACTIVE_STATUSES = ["pending", "unconfirmed", "in_preparation", "ready"];

export const reconcileBeeperPool = async (config?: Partial<BeeperRuntimeConfig> | null): Promise<void> => {
  const cfg = normalizeBeeperConfig(config || readGlobalBeeperConfig());
  if (!cfg.enabled) return;

  try {
    const ordersCol = collection(db, "artifacts", APP_ID, "public", "data", "orders");
    const q = query(ordersCol, where("status", "in", ACTIVE_STATUSES));
    const snap = await getDocs(q);

    // Nuovi ordini: beeperNumber separato. Legacy: number nel range fisico.
    const fromOrders = Array.from(
      new Set(
        snap.docs
          .map((d) => {
            const data = d.data() as any;
            if (Object.prototype.hasOwnProperty.call(data, "beeperNumber")) return Number(data.beeperNumber);
            return Number(data.number);
          })
          .filter((n) => Number.isFinite(n) && n >= cfg.rangeMin && n <= cfg.rangeMax)
      )
    ).sort((a, b) => a - b);

    console.log(`[Beeper] reconcile active orders`, fromOrders);

    const poolRef = doc(db, "artifacts", APP_ID, "public", "data", "counters", "beeperPool");
    await runTransaction(db, async (t) => {
      const pSnap = await t.get(poolRef);
      const data = pSnap.exists() ? (pSnap.data() as any) : { activeBeepers: [] };
      const before: number[] = (Array.isArray(data.activeBeepers) ? data.activeBeepers : [])
        .map((x: any) => Number(x))
        .filter((x: number) => Number.isFinite(x) && x >= cfg.rangeMin && x <= cfg.rangeMax);

      console.log(`[Beeper] reconcile before`, before);

      const sameLen = before.length === fromOrders.length;
      const sameSet = sameLen && fromOrders.every((n) => before.includes(n));
      if (sameSet) {
        console.log(`[Beeper] reconcile after`, before, `(no change)`);
        return;
      }

      if (pSnap.exists()) {
        t.update(poolRef, { activeBeepers: fromOrders, rangeMin: cfg.rangeMin, rangeMax: cfg.rangeMax, updatedAt: Date.now() });
      } else {
        t.set(poolRef, { activeBeepers: fromOrders, takeawayCounter: Math.max(cfg.rangeMax + 1, 17) - 1, lastBeeperIndex: -1, rangeMin: cfg.rangeMin, rangeMax: cfg.rangeMax }, { merge: true });
      }
      console.log(`[Beeper] reconcile after`, fromOrders);
    });
  } catch (e) {
    console.warn(`[Beeper] reconcile failed`, e);
  }
};
