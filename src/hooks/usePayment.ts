import { useState, useRef, useCallback } from 'react';
import { collection, addDoc, updateDoc, doc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { normalizeBeeperConfig, getEnabledBeeperNumbers, type BeeperRuntimeConfig, type OrderNumberAssignment } from '@/lib/beeperConfig';


// 🔥 CLEAN PROFONDO (FIX DEFINITIVO FIRESTORE)
const cleanObjectDeep = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(cleanObjectDeep);
  }
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) => [k, cleanObjectDeep(v)])
    );
  }
  return obj;
};


// ✅ PAYLOAD ORDINE STABILE
export const buildOrderPayload = (cart: any[], options: any) => {
  const { method, isMobile, isDemo, num, total, checkoutId, fallbackFromOrderId, beeperNumber, beepersEnabled = true } = options;

  // 🔧 FIX BUG-2: safeNum hardened — rifiuta "...", null, undefined, NaN.
  // Niente più placeholder "..." nel campo number. Se manca un numero atomico
  // valido, fail loud invece di bruciare un random.
  const isValidNumber = (typeof num === "number" && Number.isFinite(num) && num > 0) ||
    (typeof num === "string" && num.trim() !== "" && num.trim() !== "..." && Number.isFinite(Number(num)));
  if (!isValidNumber) {
    throw new Error(
      "[buildOrderPayload] numero ordine non valido: deve essere intero atomico Firestore (no fallback locale).",
    );
  }
  const safeNum = typeof num === "number" ? num : Number(num);
  const safeTotal = parseFloat(Number(total || 0).toFixed(2));
  const safeMethod = method || 'cash';

  const items = cart.map((item: any, idx: number) => ({
    id: item.id || `item-${idx}`,
    cartId: item.cartId ? `${item.cartId}-${idx}` : `item-${Date.now()}-${idx}`,
    name: item.name || "Prodotto",
    price: Number(item.price || 0),
    quantity: Number(item.quantity || 1),
    customization: item.customization || [],
    selectedIngredients: item.selectedIngredients || [],
    _formato_scelto: item._formato_scelto || null,
    _contorni: item._contorni || [],
    _cottura: item._cottura || null,
    paid: false
  }));

  const printStatus = (!isMobile && safeMethod === 'cash') ? 'PENDING' : 'NONE';

  const payload = {
    number: String(safeNum),
    orderNumber: String(safeNum),
    beeperNumber: beeperNumber === undefined ? null : beeperNumber,
    beepersEnabled,
    items,
    total: safeTotal,
    timestamp: isDemo ? Date.now() : serverTimestamp(),
    clientTimestamp: Date.now(),

    // 🔥 cucina + cassa subito sincronizzati
    status: "in_preparation",

    paymentStatus: safeMethod === 'card' ? "pending" : "cash",

    type: safeMethod,
    origine: isMobile ? "qr" : "totem",

    print: {
      status: printStatus,
      requestedAt: printStatus === 'PENDING' ? Date.now() : null,
      lastAttemptAt: null,
      printedAt: null,
      attempts: 0,
      printerClientId: null,
      reprintRequested: false
    },

    checkoutId: checkoutId || null,
    paid: false,
    fallbackFromOrderId: fallbackFromOrderId || null,
    note: "",

    // 🖨️ Sistema "vecchio totem": flag semplice
    // - totem cassa/carta: già stampati subito al volo dal browser → printed:true
    // - mobile/QR: vengono intercettati dal radar QR del totem → printed:false
    // 🖨️ Sempre false alla creazione: la stampa locale totem è guidata da
    // `orderComplete` (stato React); il flag `printed` è del radar Firestore
    // per dedup tra istanze. Marca `printed:true` DOPO la stampa effettiva.
    printed: false,
    printSignal: 0
  };

  return cleanObjectDeep(payload); // 🔥 CRUCIALE
};


// 🧠 HOOK PAGAMENTO
export function usePayment({ isDemoMode, onOrderComplete, onPlayDing }: any) {
  const [paymentStep, setPaymentStep] = useState<'selection' | 'processing' | 'error' | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [hasFailedCardAttempt, setHasFailedCardAttempt] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  // 🧪 [POS TEST] info diagnostiche per modale
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [pollAttempts, setPollAttempts] = useState(0);
  const [lastStatus, setLastStatus] = useState<string | null>(null);
  const [pollStartedAt, setPollStartedAt] = useState<number | null>(null);
  // 🧪 [POS DIAG] ultimo dump diagnostico fail (esposto al consumer)
  const [lastFailureDiagnostic, setLastFailureDiagnostic] = useState<any>(null);

  const pollTimerRef = useRef<any>(null);
  const pendingOrderIdRef = useRef<string | null>(null);
  // 🔢 Numero beeper prenotato in modalità carta (per release su cancel utente)
  const reservedNumRef = useRef<number>(-1);


  // 🔁 RETRY SOLO SU ERRORE DI RETE
  const fetchWithRetry = async (url: string, options: any, retries = 3): Promise<Response> => {
    let lastErr: unknown;
    for (let i = 0; i < retries; i++) {
      try {
        return await fetch(url, options);
      } catch (e) {
        lastErr = e;
        if (i === retries - 1) throw e;
        await new Promise(res => setTimeout(res, 2000));
      }
    }
    throw lastErr ?? new Error("fetchWithRetry: exhausted");
  };


  // 🔢 NUMERO ORDINE ATOMICO + BEEPER OPZIONALI
  // - Se beeper enabled: rotazione atomica nel range configurato, fallback asporto se abilitato.
  // - Se beeper disabled: contatore ordine sequenziale atomico, beeperNumber=null.
  // ⚠️ NESSUN FALLBACK random/fisso: se la transaction fallisce, lancia errore.
  const generateAtomicOrderAssignment = async (
    beepersInput?: boolean[] | Partial<BeeperRuntimeConfig> | null,
  ): Promise<OrderNumberAssignment> => {
    const cfg = normalizeBeeperConfig(beepersInput);

    if (isDemoMode) {
      const n = Math.floor(Math.random() * 99) + 1;
      return {
        orderNumber: n,
        beeperNumber: cfg.enabled && n >= cfg.rangeMin && n <= cfg.rangeMax ? n : null,
        source: cfg.enabled ? "physical_beeper" : "order_sequence",
      };
    }

    // Se i beeper sono spenti o l'assegnazione automatica è off, uso un contatore ordine dedicato.
    if (!cfg.enabled || !cfg.autoAssign) {
      const seqRef = doc(db, "artifacts", APP_ID, "public", "data", "counters", "orderSeq");
      let orderNumber = -1;
      await runTransaction(db, async (t) => {
        const snap = await t.get(seqRef);
        const current = snap.exists() && Number.isFinite(Number(snap.data().lastNumber))
          ? Number(snap.data().lastNumber)
          : 0;
        orderNumber = current >= 9999 ? 1 : current + 1;
        t.set(seqRef, { lastNumber: orderNumber, updatedAt: Date.now() }, { merge: true });
      });
      if (orderNumber < 1) throw new Error("Numero ordine non assegnato");
      console.log(`[OrderSeq] assigned #${orderNumber} (beeper disabled/autoAssign off)`);
      return { orderNumber, beeperNumber: null, source: "order_sequence" };
    }

    // 🧹 Pulisci beeper fantasmi prima di assegnare un nuovo numero.
    try {
      const { reconcileBeeperPool } = await import("@/lib/beeperPool");
      await reconcileBeeperPool(cfg);
    } catch (e) {
      console.warn("[Beeper] reconcile pre-assign failed (continuo)", e);
    }

    const poolRef = doc(db, "artifacts", APP_ID, "public", "data", "counters", "beeperPool");
    const enabled = getEnabledBeeperNumbers(cfg);
    const takeawayStart = Math.max(cfg.rangeMax + 1, 17);
    const takeawayEnd = 99;

    let assigned = -1;
    let source: OrderNumberAssignment["source"] = "physical_beeper";

    console.log(`[Beeper] enabled=`, enabled, `(range=${cfg.rangeMin}-${cfg.rangeMax}, takeaway=${cfg.takeawayMode})`);

    await runTransaction(db, async (t) => {
      const snap = await t.get(poolRef);
      const data = snap.exists()
        ? snap.data()
        : { activeBeepers: [], takeawayCounter: takeawayStart - 1, lastBeeperIndex: -1 };

      let active: number[] = Array.isArray(data.activeBeepers)
        ? data.activeBeepers.map((x: any) => Number(x)).filter((x: number) => Number.isFinite(x))
        : [];
      active = active.filter((n) => n >= cfg.rangeMin && n <= cfg.rangeMax);

      let takeaway = typeof data.takeawayCounter === "number" ? data.takeawayCounter : takeawayStart - 1;
      let lastIdx = typeof data.lastBeeperIndex === "number" ? data.lastBeeperIndex : -1;

      if (enabled.length === 0 || lastIdx >= enabled.length) lastIdx = -1;
      assigned = -1;

      if (enabled.length > 0) {
        for (let step = 1; step <= enabled.length; step++) {
          const candidateIdx = (lastIdx + step) % enabled.length;
          const candidate = enabled[candidateIdx];
          if (!active.includes(candidate)) {
            assigned = candidate;
            lastIdx = candidateIdx;
            source = "physical_beeper";
            break;
          }
        }
      }

      if (assigned === -1) {
        if (cfg.takeawayMode) {
          takeaway = takeaway >= takeawayEnd ? takeawayStart : Math.max(takeaway + 1, takeawayStart);
          assigned = takeaway;
          source = "takeaway_number";
        } else {
          const seqRef = doc(db, "artifacts", APP_ID, "public", "data", "counters", "orderSeq");
          const seqSnap = await t.get(seqRef);
          const current = seqSnap.exists() && Number.isFinite(Number(seqSnap.data().lastNumber))
            ? Number(seqSnap.data().lastNumber)
            : 0;
          assigned = current >= 9999 ? 1 : current + 1;
          source = "order_sequence";
          t.set(seqRef, { lastNumber: assigned, updatedAt: Date.now() }, { merge: true });
        }
      } else {
        active.push(assigned);
      }

      t.set(
        poolRef,
        {
          activeBeepers: active,
          takeawayCounter: takeaway,
          lastBeeperIndex: lastIdx,
          rangeMin: cfg.rangeMin,
          rangeMax: cfg.rangeMax,
          updatedAt: Date.now(),
        },
        { merge: true },
      );
    });

    if (assigned < 1) throw new Error("Numero ordine non assegnato");

    const beeperNumber = source === "physical_beeper" ? assigned : null;
    console.log(`[Beeper] assigned order #${assigned}, beeper=${beeperNumber ?? "OFF"}, source=${source}`);
    return { orderNumber: assigned, beeperNumber, source };
  };

  // Compatibilità vecchio codice: restituisce solo il numero visibile.
  const generateAtomicOrderNumber = async (
    beepersInput?: boolean[] | Partial<BeeperRuntimeConfig> | null,
  ): Promise<number> => {
    const assignment = await generateAtomicOrderAssignment(beepersInput);
    return assignment.orderNumber;
  };

  // ❌ CANCEL POLLING (FIX CORRETTO)
  const cancelPolling = useCallback(async () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    setIsPolling(false);
    setHasFailedCardAttempt(true);
    setPaymentStep('error');
    setPaymentError("Pagamento annullato o fallito.");

    // 🔓 Rilascia beeper prenotato (compat carta legacy; no-op se non è fisico)
    const num = reservedNumRef.current;
    if (num >= 1) {
      try {
        const { releaseBeeper } = await import('@/lib/beeperPool');
        await releaseBeeper(num);
      } catch (e) {
        console.warn('[Beeper] release on cancel failed', e);
      }
      reservedNumRef.current = -1;
    }

    if (!isDemoMode && pendingOrderIdRef.current) {
      try {
        await updateDoc(
          doc(db, "artifacts", APP_ID, "public", "data", "orders", pendingOrderIdRef.current),
          {
            paymentStatus: "failed"
          }
        );
      } catch {}
    }
  }, [isDemoMode]);


  // 💳 PAGAMENTO CARTA — PRENOTAZIONE ATOMICA PRIMA DEL CHECKOUT
  // Il numero viene PRENOTATO via Firestore in modo atomico
  // transaction PRIMA di chiamare SumUp. Su qualsiasi fallimento → releaseBeeper.
  // L'ordine viene creato già con il numero reale (paymentStatus: "pending" lo nasconde
  // a cucina/cassa/radar finché il pagamento non è confermato).
  const processCard = async (
    backendUrl: string,
    cart: any[],
    total: number,
    isMobile: boolean,
    preassignedNum: number
  ) => {
    if (isPolling) return;

    setIsPolling(true);
    setPaymentStep('processing');
    setPaymentError(null);
    setCheckoutId(null);
    setPollAttempts(0);
    setLastStatus(null);
    setPollStartedAt(Date.now());

    let reservedNum: number = -1;
    let orderIdStr = "";

    // 🔓 Rilascia beeper su qualsiasi fail (no-op se non è fisico)
    const releaseIfReserved = async () => {
      if (reservedNum >= 1) {
        try {
          const { releaseBeeper } = await import('@/lib/beeperPool');
          await releaseBeeper(reservedNum);
        } catch (e) {
          console.warn('[POS TEST] ⚠️ releaseBeeper failed', e);
        }
      }
      reservedNum = -1;
      reservedNumRef.current = -1;
    };

    // 🔒 Helper: marca ordine pagato e notifica (numero già prenotato pre-checkout)
    const finalizeCardSuccess = async (basePayload: any) => {
      console.log('[POS TEST] ✅ Conferma pagamento — numero già prenotato:', reservedNum);
      // Numero ormai "consumato" → niente release su eventuali cancel successivi
      reservedNumRef.current = -1;

      if (!isDemoMode && orderIdStr) {
        try {
          await updateDoc(
            doc(db, "artifacts", APP_ID, "public", "data", "orders", orderIdStr),
            {
              paymentStatus: "card",
              paid: true,
              paymentVerifiedAt: Date.now(),
            }
          );
        } catch (e) {
          console.error('[POS TEST] ❌ updateDoc post-success failed', e);
        }
      }

      onPlayDing();
      onOrderComplete({ ...basePayload, number: String(reservedNum), id: orderIdStr || pendingOrderIdRef.current, paid: true });
    };

    try {
      // 1️⃣ Numero pre-assegnato localmente dal totem
      reservedNum = preassignedNum;
      reservedNumRef.current = reservedNum;
      console.log('[POS TEST] 🔢 Numero locale pre-assegnato:', reservedNum);

      // 2️⃣ Crea ordine con numero reale (nascosto da paymentStatus: "pending")
      const payload = buildOrderPayload(cart, {
        method: 'card',
        isMobile,
        isDemo: isDemoMode,
        num: reservedNum,
        total
      });

      if (!isDemoMode) {
        const docRef = await addDoc(
          collection(db, "artifacts", APP_ID, "public", "data", "orders"),
          payload
        );

        pendingOrderIdRef.current = docRef.id;
        setPendingOrderId(docRef.id);
        orderIdStr = docRef.id;
      }

      console.log('[POS TEST] ▶️ Creazione checkout SumUp', { backendUrl, total, orderId: orderIdStr });

      const res = await fetchWithRetry(backendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: total, orderId: orderIdStr })
      });

      const result = await res.json();
      console.log('[POS TEST] 📥 Risposta checkout', result);

      if (!res.ok) {
        console.error("[POS TEST] ❌ HTTP ERROR", res.status, result);
        setLastStatus(`HTTP_${res.status}`);
        setLastFailureDiagnostic({
          http_status: res.status,
          failure_reason: result?.message || `HTTP ${res.status}`,
          raw: result,
          attemptId: result?.attemptId ?? null,
        });
        setPaymentError(result?.message || `Errore server POS (HTTP ${res.status})`);
        await releaseIfReserved();
        await cancelPolling();
        return;
      }

      if (result?.id) setCheckoutId(result.id);
      if (result?.status) setLastStatus(String(result.status).toUpperCase());
      if (result?.attemptId) console.log('[POS DIAG] attemptId:', result.attemptId);

      if (['PAID', 'SUCCESSFUL', 'SUCCESS'].includes(result.status?.toUpperCase())) {
        console.log('[POS TEST] ✅ Pagamento immediato OK');
        await finalizeCardSuccess(payload);
      } else if (result.id) {
        let attempts = 0;

        pollTimerRef.current = setInterval(async () => {
          attempts++;
          setPollAttempts(attempts);

          if (attempts > 60) {
            console.warn('[POS TEST] ⏱️ Timeout polling (60 tentativi)');
            await releaseIfReserved();
            cancelPolling();
            return;
          }

          try {
            const pRes = await fetch(`${backendUrl}?id=${result.id}&amount=${total}&orderId=${orderIdStr}`);
            const pData = await pRes.json();
            const st = String(pData.status || '').toUpperCase();
            setLastStatus(st || null);
            console.log(`[POS TEST] 🔄 Polling #${attempts}`, { status: st, raw: pData });

            if (['SUCCESSFUL', 'PAID', 'SUCCESS'].includes(st)) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
              console.log('[POS TEST] ✅ Pagamento confermato dopo polling');
              await finalizeCardSuccess(payload);
            }

            if (['FAILED', 'CANCELLED', 'DECLINED'].includes(st)) {
              console.warn('[POS TEST] ❌ Pagamento rifiutato:', st);
              const diag = {
                failure_reason: pData?.failure_reason ?? null,
                failure_error_code: pData?.failure_error_code ?? null,
                failure_detail: pData?.failure_detail ?? null,
                reader_status: pData?.reader_status ?? null,
                transactions: pData?.transactions ?? [],
                attemptId: pData?.attemptId ?? null,
                raw: pData?.raw ?? null,
              };
              console.error('[POS DIAG]', diag);
              setLastFailureDiagnostic(diag);
              await releaseIfReserved();
              cancelPolling();
            }

          } catch (pollErr) {
            console.error('[POS TEST] ⚠️ Errore polling', pollErr);
          }
        }, 2000);
      } else {
        console.error('[POS TEST] ❌ Risposta SumUp senza id e senza status PAID', result);
        setPaymentError(result?.message || 'Risposta SumUp non valida');
        await releaseIfReserved();
        await cancelPolling();
      }

    } catch (e: any) {
      console.error('[POS TEST] 💥 Errore creazione checkout', e);
      setPaymentStep('error');
      setPaymentError(e?.message || 'Errore di rete');
      await releaseIfReserved();
      await cancelPolling();
    }
  };


  // 🔄 RESET COMPLETO
  const resetPayment = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    setPaymentStep(null);
    setPaymentError(null);
    setIsPolling(false);
    setHasFailedCardAttempt(false);
    setPendingOrderId(null);
    setCheckoutId(null);
    setPollAttempts(0);
    setLastStatus(null);
    setPollStartedAt(null);
    setLastFailureDiagnostic(null);
    pendingOrderIdRef.current = null;
  };


  return {
    paymentStep,
    setPaymentStep,
    paymentError,
    setPaymentError,
    isPolling,
    processCard,
    resetPayment,
    cancelPolling,
    pendingOrderId,
    hasFailedCardAttempt,
    generateAtomicOrderNumber,
    generateAtomicOrderAssignment,
    checkoutId,
    pollAttempts,
    lastStatus,
    pollStartedAt,
    lastFailureDiagnostic
  };
}
