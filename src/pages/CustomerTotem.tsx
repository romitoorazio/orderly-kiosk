import React, { useState, useRef, useEffect, useCallback } from "react";
import { ShoppingBasket, Plus, Minus, Utensils, X, ArrowLeft, Edit3, Trash2, Layers, CheckCircle2, Info } from "lucide-react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db, APP_ID } from "@/lib/firebase";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useFirestoreData } from "@/hooks/useFirestoreData";
import { useActiveOrders } from "@/hooks/useActiveOrders";
import { usePayment, buildOrderPayload } from "@/hooks/usePayment";
import { useOffline } from "@/hooks/useOffline";
import { DEPARTMENTS_FALLBACK, ICON_MAP, INACTIVITY_LIMIT, COUNTDOWN_LIMIT, resolveBackendUrl } from "@/lib/constants";
import PinModal from "@/components/totem/PinModal";
import CustomizerModal from "@/components/totem/CustomizerModal";
import PromoModal from "@/components/totem/PromoModal";
import InactivityWarning from "@/components/totem/InactivityWarning";
import PaymentModal from "@/components/totem/PaymentModal";
import PrintTemplate from "@/components/totem/PrintTemplate";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { usePrinterProfiles } from "@/hooks/usePrinterProfiles";
import { getPaperWidthMm } from "@/lib/print/engine";
import { getOrderNumber, hasPhysicalBeeper } from "@/lib/orderDisplay";

// 🖨️ Stampa non bloccante (doppio rAF) — vecchio totem
// 🛡️ BLOCCO HARD: mai stampare in modalità mobile (cliente da telefono)
const isMobileSearch = () => {
  try { return new URLSearchParams(window.location.search).get("mode") === "mobile"; }
  catch { return false; }
};
const safePrint = () => {
  if (isMobileSearch()) {
    console.log("[Print] 🚫 Skip: modalità mobile");
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try { window.print(); } catch (e) { console.warn("[Print] window.print failed", e); }
    });
  });
};

// 🔢 BUG-3 FIX: computeLocalOrderNumber + localStorage.orazio_lastBeeper RIMOSSI.
// La numerazione ordine è SOLO atomica via Firestore transaction
// (vedi usePayment.generateAtomicOrderNumber + lib/beeperPool).
// Nessun fallback locale: se Firestore è irraggiungibile, l'ordine viene
// rifiutato e il totem mostra errore (vedi useOffline gating).
const ACTIVE_STATUSES = new Set(["in_preparation", "ready"]);

let globalAudioCtx: AudioContext | null = null;

const LibroAllergeni: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <div onClick={(e) => { e.stopPropagation(); setIsOpen(true); }} className="absolute top-2 right-2 md:top-4 md:right-6 flex flex-col items-center justify-center cursor-pointer group active:scale-90 transition-transform z-50">
        <div className="w-10 h-10 md:w-14 md:h-14 bg-white border-2 border-amber-500 rounded-full shadow-lg flex items-center justify-center text-lg md:text-2xl group-hover:bg-amber-50 transition-colors">📖</div>
        <span className="block text-[10px] md:text-xs font-black text-slate-800 tracking-tighter uppercase italic mt-0.5">Allergeni</span>
      </div>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm normal-case text-left p-4" onClick={() => setIsOpen(false)}>
          <div className="bg-white rounded-[2.5rem] w-full max-w-3xl max-h-[85vh] overflow-y-auto shadow-2xl font-sans text-slate-800 relative border-t-[10px] border-amber-500 flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white p-6 border-b-2 border-slate-100 flex justify-between items-center z-10 rounded-t-[2.5rem]">
              <h2 className="m-0 text-2xl font-black uppercase italic tracking-tighter text-red-600 flex items-center gap-2">📝 INGREDIENTI E ALLERGENI</h2>
              <button className="bg-slate-100 text-slate-500 hover:text-red-600 p-2 rounded-full transition-colors" onClick={() => setIsOpen(false)}><X size={24} strokeWidth={3} /></button>
            </div>
            <div className="p-8 pt-6 overflow-y-auto text-sm space-y-6 text-black uppercase">
               <p className="text-xs font-bold text-slate-400 uppercase italic">(UE 1169/2011)</p>
               <section><h3 className="text-amber-600 mb-2 font-black italic">🥖 CEREALI E GLUTINE</h3><p>Contengono farina di grano (Glutine).</p></section>
               <section><h3 className="text-amber-600 mb-2 font-black italic">🥛 LATTE E DERIVATI</h3><p>Contengono Latte e Lattosio.</p></section>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const CustomerTotem: React.FC = () => {
  const { user } = useFirebaseAuth();
  const { settings: business } = useBusinessSettings(user);
  const { flags } = useFeatureFlags();
  const { printers } = usePrinterProfiles();
  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const isMobileMode = searchParams.get("mode") === "mobile";
  const isDemoMode = searchParams.get("mode") === "demo";

  // 📱 Mobile QR: useFirestoreData LEGGERO (one-shot menu, no beepers/printer/wheel/admin).
  const baseData = useFirestoreData(user, { mobile: isMobileMode });
  // 🔥 Listener live filtrato su ordini attivi — DISATTIVATO in mobile (nessun consumer).
  const activeOrders = useActiveOrders(user, { enabled: !isMobileMode });
  // Sostituisci `orders` nel data condiviso così tutti i consumer (radar, printSignal,
  // computeLocalOrderNumber) usano lo stesso array filtrato senza modifiche a valle.
  const data = baseData ? { ...baseData, orders: activeOrders } : baseData;
  
  const isBackendOffline = useOffline(data?.paymentSettings?.backendUrl).isOffline;
  const receiptPrinter = printers.find((p) => p.enabled && p.role === "receipt") || printers.find((p) => p.enabled);
  const receiptWidthMm = receiptPrinter ? getPaperWidthMm(receiptPrinter) : 72;
  
  const isFirestoreLoading = data === undefined || data === null;
  const hasMenu = Array.isArray(data?.menuItems);
  const isFirestoreOffline = !isFirestoreLoading && !hasMenu;

  const [currentStep, setCurrentStep] = useState<"welcome" | "departments" | "menu" | "customizer">("welcome");
  const [activeDept, setActiveDept] = useState<string | null>(null);

  // 🖼️ Preload immagini di un reparto: scarica in cache HTTP del browser così
  // quando React monta le <img> la decodifica è quasi immediata. Nessuna scrittura,
  // nessun listener, solo GET cacheati.
  const preloadDeptImages = useCallback((deptId: string | null) => {
    if (!deptId || !data?.menuItems) return;
    const items = data.menuItems.filter((i: any) => i.departmentId === deptId);
    items.forEach((i: any) => {
      const url = i?.imageUrl;
      if (!url) return;
      try {
        const img = new Image();
        (img as any).decoding = 'async';
        img.src = url;
      } catch {}
    });
  }, [data?.menuItems]);

  // Quando cambia il reparto attivo, prefetch di tutte le immagini del reparto.
  useEffect(() => {
    preloadDeptImages(activeDept);
  }, [activeDept, preloadDeptImages]);
  const [cart, setCart] = useState<any[]>([]);
  const [cartHydrated, setCartHydrated] = useState(false);
  // SSR-safe hydration del cart
  useEffect(() => {
    if (typeof window === "undefined") { setCartHydrated(true); return; }
    try {
      // Carrello per-sessione: sessionStorage è isolato per tab/sessione kiosk.
      // Non usare localStorage: rischia di condividere il carrello tra clienti.
      const s = sessionStorage.getItem("orazio_cart_session");
      if (s) setCart(JSON.parse(s));
    } catch { /* noop */ }
    setCartHydrated(true);
  }, []);
  useEffect(() => {
    if (!cartHydrated || typeof window === "undefined") return;
    try { sessionStorage.setItem("orazio_cart_session", JSON.stringify(cart)); } catch { /* noop */ }
  }, [cart, cartHydrated]);

  const [customizingItem, setCustomizingItem] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [orderComplete, setOrderComplete] = useState<any>(null);
  // (rimossi assigningOrder/assignStartedAt/assignElapsed: rollback a numero locale immediato)
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  const [infoModalItem, setInfoModalItem] = useState<any>(null);

  // FIX: Variabili del timer di inattività ripristinate
  const [inactivityWarning, setInactivityWarning] = useState(false);
  const [inactivityCountdown, setInactivityCountdown] = useState(COUNTDOWN_LIMIT);

  const longPressTimer = useRef<any>(null);
  const inactivityTimerRef = useRef<any>(null);
  const countdownTimerRef = useRef<any>(null);
  // 🛡️ Quando true, gli eventi globali NON resettano il timer (countdown irreversibile)
  const warningActiveRef = useRef<boolean>(false);
  // ⏱️ Auto-reset dopo "pagamento fallito"
  const paymentErrorTimerRef = useRef<any>(null);
  const kioskExitTimer = useRef<any>(null);
  const [showKioskExitPin, setShowKioskExitPin] = useState(false);
  const [showOperatorChoice, setShowOperatorChoice] = useState(false);
  const [kioskClosed, setKioskClosed] = useState(false);

  // 🖨️ Stato stampa "vecchio totem"
  const [reprintOrder, setReprintOrder] = useState<any>(null);
  const [radarOrder, setRadarOrder] = useState<any>(null);
  const processedPrintSignals = useRef<Record<string, number>>(
    (() => {
      try {
        const s = sessionStorage.getItem("orazio_processed_print_signals");
        return s ? JSON.parse(s) : {};
      } catch { return {}; }
    })()
  );
  const lastRadarPrintAt = useRef<number>(0);
  // 🛡️ Anti-doppio scontrino:
  // - seenOrderIds: dedup di sessione (radar)
  // - printedLocalIds / printedRadarIds / printedReprintKeys: dedup definitivo per i 3 trigger
  // - pageOpenedAt: filtro temporale per radar e printSignal (no stampe storiche al reload)
  // - radarBootstrapped: al PRIMO snapshot di data.orders dopo il mount, popoliamo
  //   seenOrderIds + printedRadarIds con TUTTI gli id già presenti. Così il radar NON
  //   tocca (e NON scrive printed:true su) ordini preesistenti — solo i nuovi arrivati
  //   dopo il mount possono passare. Obiettivo: 0 scritture all'apertura totem.
  const seenOrderIds = useRef<Set<string>>(new Set());
  const printedLocalIds = useRef<Set<string>>(new Set());
  const printedRadarIds = useRef<Set<string>>(new Set());
  const printedReprintKeys = useRef<Set<string>>(new Set());
  const radarBootstrapped = useRef<boolean>(false);
  const pageOpenedAt = useRef<number>(Date.now());
  const printerActive = data?.printerSettings?.active !== false;

  // 🪵 Log centralizzato di OGNI scrittura Firestore eseguita da questa pagina.
  // Serve a verificare che aprire il totem/mobile senza azioni produca 0 scritture.
  const logFirestoreWrite = (path: string, payload: any, source: string) => {
    try { console.log(`[FIRESTORE WRITE] ${path}`, { payload, source }); } catch {}
  };

  const getSafePrice = (val: any) => {
    if (val === undefined || val === null || val === "") return 0;
    const parsed = parseFloat(String(val).replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
  };

  const cartTotal = cart.reduce((s: number, i: any) => s + getSafePrice(i.price) * (i.quantity || 1), 0);
  const safePromoPrice = getSafePrice((data?.promoConfig as any)?.promoPrice ?? data?.promoConfig?.price);
  const showCartAside = cart.length > 0;

  const playDing = useCallback(() => {
    try {
      if (!globalAudioCtx) globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (globalAudioCtx.state === "suspended") globalAudioCtx.resume();
      const playNote = (freq: number, start: number, dur: number) => {
        const osc = globalAudioCtx!.createOscillator();
        const gain = globalAudioCtx!.createGain();
        osc.frequency.setValueAtTime(freq, start);
        gain.gain.setValueAtTime(0.2, start);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        osc.connect(gain); gain.connect(globalAudioCtx!.destination);
        osc.start(start); osc.stop(start + dur);
      };
      playNote(660, globalAudioCtx.currentTime, 0.5);
      playNote(523, globalAudioCtx.currentTime + 0.3, 0.8);
    } catch {}
  }, []);

  const payment = usePayment({
    isDemoMode,
    onOrderComplete: (order: any) => {
      setOrderComplete(order); setCart([]); setCurrentStep("welcome");
      setShowPromoModal(false); setIsMobileCartOpen(false);
      payment.resetPayment(); setTimeout(() => setOrderComplete(null), 6000);
    },
    onPlayDing: playDing,
  });

  const resetAppToHome = useCallback(() => {
    setCart([]);
    setCurrentStep("welcome");
    setActiveDept(null);
    setCustomizingItem(null);
    setIsMobileCartOpen(false);
    setShowPromoModal(false);
    setOrderComplete(null);
    setInfoModalItem(null);
    setShowPinModal(false);
    setShowKioskExitPin(false);
    setShowOperatorChoice(false);
    setIsSubmitting(false);
    setRadarOrder(null);
    setReprintOrder(null);
    setInactivityWarning(false);
    setInactivityCountdown(COUNTDOWN_LIMIT);
    warningActiveRef.current = false;
    if (paymentErrorTimerRef.current) { clearTimeout(paymentErrorTimerRef.current); paymentErrorTimerRef.current = null; }
    payment.resetPayment();
    try { sessionStorage.removeItem("orazio_cart_session"); } catch {}
  }, [payment]);

  // 🛡️ Ref a resetAppToHome per evitare che cambi di identità (causati da `payment`
  // ricreato a ogni render in usePayment) facciano rimontare l'effetto degli activity
  // listener — che cancellava `countdownTimerRef` ad ogni tick, congelando il countdown.
  const resetAppToHomeRef = useRef(resetAppToHome);
  useEffect(() => { resetAppToHomeRef.current = resetAppToHome; }, [resetAppToHome]);
  const isMobileModeRef = useRef(isMobileMode);
  useEffect(() => { isMobileModeRef.current = isMobileMode; }, [isMobileMode]);

  const resetInactivityTimer = useCallback(() => {
    if (isMobileModeRef.current) {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      setInactivityWarning(false);
      warningActiveRef.current = false;
      return;
    }
    // 🛡️ Se il warning è attivo, NON resettare: il countdown deve completarsi.
    if (warningActiveRef.current) return;
    setInactivityWarning(false);
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }

    inactivityTimerRef.current = setTimeout(() => {
      console.log('[TIMER] warning shown');
      warningActiveRef.current = true;
      setInactivityWarning(true);
      setInactivityCountdown(COUNTDOWN_LIMIT);
      console.log('[TIMER] interval started');
      countdownTimerRef.current = setInterval(() => {
        setInactivityCountdown((prev) => {
          const next = prev - 1;
          console.log('[TIMER] countdown', next);
          if (prev <= 1) {
            console.log('[TIMER] reset to home');
            if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
            warningActiveRef.current = false;
            resetAppToHomeRef.current();
            return COUNTDOWN_LIMIT;
          }
          return next;
        });
      }, 1000);
    }, (INACTIVITY_LIMIT || 60) * 1000 - (COUNTDOWN_LIMIT * 1000));
  }, []);

  // 🛡️ Mount-only: registra listener una sola volta. Niente teardown a ogni render
  // → i ref `inactivityTimerRef` / `countdownTimerRef` sopravvivono.
  useEffect(() => {
    const events = ['mousedown', 'touchstart', 'pointerdown', 'click', 'scroll', 'wheel', 'keydown'];
    const handleActivity = () => {
      if (warningActiveRef.current) return; // solo bottone CONTINUA può chiudere il warning
      resetInactivityTimer();
    };
    events.forEach(e => document.addEventListener(e, handleActivity));
    resetInactivityTimer();
    return () => {
      events.forEach(e => document.removeEventListener(e, handleActivity));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⏱️ Auto-reset dopo "pagamento fallito": se il cliente lascia il totem
  // sulla schermata di errore, dopo 12s torna automaticamente a home.
  useEffect(() => {
    if (paymentErrorTimerRef.current) {
      clearTimeout(paymentErrorTimerRef.current);
      paymentErrorTimerRef.current = null;
    }
    if (payment.paymentStep === 'error') {
      console.log('[TIMER] payment-error → auto reset in 12s');
      paymentErrorTimerRef.current = setTimeout(() => {
        console.log('[TIMER] reset to home (payment error)');
        resetAppToHome();
      }, 12000);
    }
    return () => {
      if (paymentErrorTimerRef.current) {
        clearTimeout(paymentErrorTimerRef.current);
        paymentErrorTimerRef.current = null;
      }
    };
  }, [payment.paymentStep, resetAppToHome]);

  // ==========================================================
  // 🖨️ A) AUTO-STAMPA su orderComplete (vecchio totem)
  // Warm-up 3500ms alla prima stampa di sessione, poi 800ms.
  // ==========================================================
  useEffect(() => {
    if (isMobileMode) { console.log("[PRINT] ⛔ skip local: mobile mode"); return; }
    if (!orderComplete) return;
    if (!printerActive) { console.log("[PRINT] ⛔ skip local: printer disabled"); return; }
    // ⏳ Aspetta numero/id reali (no stampa di placeholder card o id "pending")
    if (!orderComplete.id || orderComplete.id === 'pending') {
      console.log("[PRINT] ⏳ skip local: waiting real order id");
      return;
    }
    if (!orderComplete.number || orderComplete.number === '...') {
      console.log("[PRINT] ⏳ skip local: waiting real order number");
      return;
    }
    if (printedLocalIds.current.has(orderComplete.id)) {
      console.log("[PRINT] ⛔ skip duplicate local", { id: orderComplete.id });
      return;
    }
    printedLocalIds.current.add(orderComplete.id);

    const isFirstPrint = !sessionStorage.getItem("orazio_starter_ok");
    const delay = isFirstPrint ? 1200 : 250;
    console.log("[PRINT] 🧾 Local trigger orderComplete", { id: orderComplete?.id, origine: orderComplete?.origine, status: orderComplete?.status, delay });
    const t = setTimeout(() => {
      safePrint();
      console.log("[PRINT] ✅ safePrint() local executed", { id: orderComplete?.id });
      if (isFirstPrint) sessionStorage.setItem("orazio_starter_ok", "true");
      // Marca su Firestore: evita che un secondo totem lo riprenda via radar
      if (orderComplete?.id && !isDemoMode) {
        const path = `artifacts/${APP_ID}/public/data/orders/${orderComplete.id}`;
        logFirestoreWrite(path, { printed: true }, 'effectA-localPrint');
        updateDoc(doc(db, "artifacts", APP_ID, "public", "data", "orders", orderComplete.id), { printed: true })
          .then(() => console.log("[PRINT] 🏷️ marked printed:true (local)", { id: orderComplete.id }))
          .catch((e) => console.warn("[PRINT] mark printed (local) failed", e));
      }
    }, delay);
    return () => clearTimeout(t);
  }, [orderComplete, printerActive, isMobileMode, isDemoMode]);

  // ==========================================================
  // 🖨️ B) RADAR QR — stampa ordini esterni non ancora stampati
  // ==========================================================
  useEffect(() => {
    if (isMobileMode || !printerActive || orderComplete || radarOrder || reprintOrder) return;

    const orders = data?.orders || [];

    // 🛡️ BOOTSTRAP: al PRIMO snapshot non-vuoto, marca tutti gli ordini esistenti come
    // "già visti". Nessuna scrittura su ordini preesistenti. Solo i nuovi arrivati DOPO
    // potranno passare il filtro a valle. Obiettivo: 0 scritture all'apertura totem.
    if (!radarBootstrapped.current && Array.isArray(orders) && orders.length > 0) {
      orders.forEach((o: any) => {
        if (o?.id) {
          seenOrderIds.current.add(o.id);
          printedRadarIds.current.add(o.id);
        }
      });
      radarBootstrapped.current = true;
      console.log('[RADAR] bootstrap: ignoro', orders.length, 'ordini preesistenti — niente printed:true');
      return;
    }

    // 🛡️ throttle anti-quota: max 1 stampa radar al secondo
    if (Date.now() - lastRadarPrintAt.current < 1000) return;

    // Filtro temporale: solo ordini creati DOPO l'apertura pagina (con tolleranza 5s).
    // Niente "bootstrap swallow": se la collezione era vuota al mount e arriva un
    // ordine mobile/QR subito dopo, deve essere stampato.
    const cutoff = pageOpenedAt.current - 5000;
    const externalUnprinted = orders.filter((o: any) =>
      !seenOrderIds.current.has(o.id) &&
      !printedRadarIds.current.has(o.id) &&
      o.printed !== true &&
      o.origine !== "totem" &&
      ["pending", "in_preparation", "unconfirmed"].includes(o.status) &&
      // 🛡️ NON stampare placeholder card pre-conferma
      o.paymentStatus !== "pending" &&
      o.number && o.number !== "..." &&
      (Number(o.clientTimestamp) || 0) >= cutoff
    );
    if (externalUnprinted.length === 0) return;
    lastRadarPrintAt.current = Date.now();

    const orderToPrint = externalUnprinted[externalUnprinted.length - 1];
    seenOrderIds.current.add(orderToPrint.id);
    printedRadarIds.current.add(orderToPrint.id);
    console.log("[PRINT] 📡 Radar intercept", { id: orderToPrint.id, origine: orderToPrint.origine, status: orderToPrint.status, clientTimestamp: orderToPrint.clientTimestamp });
    setRadarOrder(orderToPrint);

    if (!isDemoMode) {
      const path = `artifacts/${APP_ID}/public/data/orders/${orderToPrint.id}`;
      logFirestoreWrite(path, { printed: true }, 'effectB-radar');
      updateDoc(doc(db, "artifacts", APP_ID, "public", "data", "orders", orderToPrint.id), { printed: true })
        .then(() => console.log("[PRINT] 🏷️ marked printed:true (radar)", { id: orderToPrint.id }))
        .catch((e) => console.error("[PRINT] mark printed (radar) failed", e));
    }

  }, [data?.orders, isMobileMode, printerActive, orderComplete, radarOrder, reprintOrder, isDemoMode]);

  // ==========================================================
  // 🖨️ B2) RADAR PRINT TRIGGER — speculare a Effect A
  // Separato da Effect B per evitare race condition: la cleanup
  // di B (causata da setRadarOrder che era anche dependency)
  // cancellava i timer di safePrint prima del fire.
  // ==========================================================
  useEffect(() => {
    if (isMobileMode) { console.log("[PRINT] ⛔ skip radar: mobile mode"); return; }
    if (!radarOrder) return;
    if (!printerActive) { console.log("[PRINT] ⛔ skip radar: printer disabled"); return; }

    const isFirstPrint = !sessionStorage.getItem("orazio_starter_ok");
    const delay = isFirstPrint ? 1200 : 250;
    console.log("[PRINT] 🧾 Radar trigger", { id: radarOrder?.id, delay });

    const t1 = setTimeout(() => {
      safePrint();
      console.log("[PRINT] ✅ safePrint() radar executed", { id: radarOrder?.id });
      if (isFirstPrint) sessionStorage.setItem("orazio_starter_ok", "true");
    }, delay);
    const t2 = setTimeout(() => {
      console.log("[PRINT] 🔄 radarOrder reset → null");
      setRadarOrder(null);
    }, delay + 1500);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [radarOrder, printerActive, isMobileMode]);


  // ==========================================================
  // 🖨️ C) RICEVITORE printSignal — ristampa remota da cassa/cucina
  // ==========================================================
  useEffect(() => {
    if (isMobileMode || !printerActive || orderComplete || radarOrder || reprintOrder) return;
    const now = Date.now();
    const signalOrder = (data?.orders || []).find((o: any) => {
      const sig = Number(o.printSignal || 0);
      const last = processedPrintSignals.current[o.id] || 0;
      // ignora segnali precedenti all'apertura pagina (no ristampe storiche al reload)
      if (sig <= pageOpenedAt.current) return false;
      return sig > last && (now - sig) < 60000;
    });
    if (!signalOrder) return;
    const reprintKey = `${signalOrder.id}-${Number(signalOrder.printSignal)}`;
    if (printedReprintKeys.current.has(reprintKey)) {
      console.log("[PRINT] ⛔ skip duplicate reprint", { key: reprintKey });
      return;
    }
    printedReprintKeys.current.add(reprintKey);
    processedPrintSignals.current[signalOrder.id] = Number(signalOrder.printSignal);
    try {
      sessionStorage.setItem(
        "orazio_processed_print_signals",
        JSON.stringify(processedPrintSignals.current)
      );
    } catch {}
    console.log("[PRINT] 🧾 Reprint trigger", { key: reprintKey });
    setReprintOrder(signalOrder);
  }, [data?.orders, isMobileMode, printerActive, orderComplete, radarOrder, reprintOrder]);

  // ==========================================================
  // 🖨️ D) RISTAMPA SILENZIOSA — su reprintOrder
  // ==========================================================
  useEffect(() => {
    if (isMobileMode || !reprintOrder || !printerActive) return;
    const t1 = setTimeout(() => safePrint(), 200);
    const t2 = setTimeout(() => setReprintOrder(null), 2000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reprintOrder, printerActive, isMobileMode]);

  const handleAddToCart = (itemToAdd: any, customIngredientsNames: string[] = [], qty = 1, cottura?: string) => {
    const formatLabel = itemToAdd._formato_scelto?.name || itemToAdd._formato_scelto || "";
    const contorniList = (itemToAdd._contorni || []).map((c:any) => c.name || c);
    const signatureIds = (itemToAdd.selectedIngredients || itemToAdd.defaultIngredients || []).slice().sort().join(",");
    const signature = `${itemToAdd.id}|${signatureIds}|${formatLabel}|${contorniList.join(",")}|${cottura || ""}`;
    
    setCart((prev: any[]) => {
      const idx = prev.findIndex((c: any) => c.signature === signature);
      if (idx >= 0) {
        const n = [...prev]; n[idx] = { ...n[idx], quantity: n[idx].quantity + qty, customization: customIngredientsNames }; return n;
      }
      return [...prev, { 
        cartId: Date.now() + Math.random(), 
        signature, id: itemToAdd.id, name: itemToAdd.name, 
        price: getSafePrice(itemToAdd.price), 
        customization: customIngredientsNames, 
        selectedIngredients: itemToAdd.selectedIngredients || itemToAdd.defaultIngredients || [], 
        quantity: qty, 
        _formato_scelto: formatLabel, _contorni: contorniList, _cottura: cottura 
      }];
    });
    setIsMobileCartOpen(true); 
  };

  const updateCartQuantity = (cartId: number, delta: number) => {
    setCart((prev) => prev.map((c) => (c.cartId === cartId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c)).filter((c) => c.quantity > 0));
  };

  const openCustomizer = (item: any, initialIngredients: string[] = [], cartItemId: number | null = null, initialFormatName: string | null = null, initialContorniNames: string[] = [], initialCottura?: string) => {
    setCustomizingItem({ ...item, selectedIngredients: [...initialIngredients], cartItemIdToUpdate: cartItemId, _cottura: initialCottura, _formato_scelto: initialFormatName, _contorni: initialContorniNames });
    setCurrentStep("customizer");
    if (isMobileMode) setIsMobileCartOpen(false);
  };

  const isCartItemEditable = (cartItem: any): boolean => {
    const m = data?.menuItems?.find((mi: any) => String(mi.id) === String(cartItem.id));
    if (!m) return false;
    return Boolean(
      m.isBaseProduct ||
      (Array.isArray(m.defaultIngredients) && m.defaultIngredients.length > 0) ||
      (Array.isArray(m.formats) && m.formats.length > 0) ||
      m.contpiattoDeptId ||
      (m as any).requiresCottura
    );
  };

  const handleEditCartItem = (cartItem: any) => {
    const baseItem = data?.menuItems?.find((i: any) => String(i.id) === String(cartItem.id));
    if (baseItem) {
      openCustomizer(baseItem, cartItem.selectedIngredients || [], cartItem.cartId, cartItem._formato_scelto || null, cartItem._contorni || [], cartItem._cottura);
    }
  };

  const finalizeOrder = async (cartData: any[], method = "cash") => {
    const finalCart = Array.isArray(cartData) ? cartData : cart;
    
    console.log(`[Totem] 🛒 Avvio finalizeOrder | Metodo: ${method} | Items: ${finalCart.length} | isSubmitting: ${isSubmitting}`);

    if (finalCart.length === 0) {
      console.warn("[Totem] 🛑 Checkout bloccato: Carrello vuoto.");
      return;
    }
    
    if (isSubmitting) {
      console.warn("[Totem] ⏳ Checkout bloccato: Invio già in corso. Evito doppi ordini.");
      return;
    }

    setIsSubmitting(true);

    // 🔢 Stato prenotazione beeper (per release su failure)
    let num: number = -1;
    let assignedBeeperNumber: number | null = null;
    let reserved = false;
    let released = false;
    const releaseIfNeeded = async (reason: string) => {
      if (!reserved || released) return;
      released = true;
      try {
        const { releaseBeeper } = await import('@/lib/beeperPool');
        await releaseBeeper(assignedBeeperNumber, flags.beepers);
        console.log(`[Beeper] 🔓 released #${assignedBeeperNumber} (${reason})`);
      } catch (relErr) {
        console.warn(`[Beeper] release failed (${reason})`, relErr);
      }
    };

    try {
      // 🔢 Numero ATOMICO reale (Firestore transaction): beeper configurabili prioritari, fallback numerico.
      // NESSUN fallback random: se la transaction fallisce → abort, niente ordine, niente stampa.
      try {
        const assignment = await payment.generateAtomicOrderAssignment({
          ...flags.beepers,
          status: Array.isArray(data?.beeperSettings) ? data.beeperSettings : undefined,
        });
        num = assignment.orderNumber;
        assignedBeeperNumber = assignment.beeperNumber;
        reserved = assignedBeeperNumber !== null;
        console.log(`[Totem] 🔢 Numero atomico assegnato: ordine #${num}, beeper=${assignedBeeperNumber ?? "OFF"}, source=${assignment.source}`);
      } catch (e: any) {
        console.error("[ORDER] generateAtomicOrderNumber failed", e);
        alert("Connessione lenta. Impossibile assegnare un numero.\nRivolgiti alla cassa.");
        setIsSubmitting(false);
        return;
      }

      const calculatedTotal = finalCart.reduce((s: number, i: any) => s + (getSafePrice(i.price) * (i.quantity || 1)), 0);
      const isExplicitFallback = method === "cash" && !!payment.pendingOrderId && payment.hasFailedCardAttempt;

      console.log(`[Totem] 📝 Costruzione payload ordine #${num}...`);
      const baseOrder = buildOrderPayload(finalCart, {
        method: method as "cash" | "card",
        isMobile: isMobileMode,
        isDemo: isDemoMode,
        num,
        total: calculatedTotal,
        fallbackFromOrderId: isExplicitFallback ? payment.pendingOrderId : null,
        beeperNumber: assignedBeeperNumber,
        beepersEnabled: flags.beepers.enabled
      });
      (baseOrder as any).receiptWidthMm = receiptWidthMm;
      // 🚨 Marcatura esplicita ordine mobile/tavolo
      const orderData = isMobileMode
        ? { ...baseOrder, isMobile: true, origine: "qr", sourceLabel: "ORDINE DA MOBILE / TAVOLO" }
        : baseOrder;

      // 📡 Scrittura Firestore PRIMA di mostrare conferma (evita id 'pending' che blocca stampa)
      let realId = isDemoMode ? `demo-${Date.now()}` : '';
      if (!isDemoMode) {
        try {
          console.log("[Totem] ☁️ Salvataggio su Firebase...");
          console.log("[ORDER] addDoc start", {
            number: orderData.number,
            total: orderData.total,
            origine: (orderData as any).origine,
            status: orderData.status,
            paymentStatus: (orderData as any).paymentStatus,
            isMobile: (orderData as any).isMobile === true,
          });
          const path = `artifacts/${APP_ID}/public/data/orders`;
          logFirestoreWrite(path, { number: orderData.number, total: orderData.total, origine: orderData.origine }, 'finalizeOrder');
          const docRef = await addDoc(collection(db, "artifacts", APP_ID, "public", "data", "orders"), orderData);
          realId = docRef.id;
          console.log("[ORDER] addDoc success", docRef.id);
          console.log("[ORDER] visible status", orderData.status, (orderData as any).paymentStatus, (orderData as any).origine);
          console.log(`[Totem] ✅ Ordine salvato. ID: ${realId}`);
        } catch (e: any) {
          console.error("[ORDER] addDoc failed", e);
          console.error("[Totem] ❌ ERRORE salvataggio:", e);
          await releaseIfNeeded('addDoc failed');
          alert(`ERRORE SALVATAGGIO ORDINE #${num}:\n${e.message}\nMostrare lo schermo alla cassa.`);
          setIsSubmitting(false);
          return;
        }
      }

      // ✅ Conferma con numero + id reali (la stampa locale parte ora)
      setOrderComplete({ ...orderData, id: realId });
      setCart([]);
      setCurrentStep("welcome");
      setShowPromoModal(false);
      setIsMobileCartOpen(false);
      payment.resetPayment();
      setTimeout(() => setOrderComplete(null), 6000);
      setIsSubmitting(false);

    } catch (e: any) {
      console.error("[Totem] ❌ ERRORE CRITICO in finalizeOrder:", e);
      await releaseIfNeeded('finalizeOrder catch');
      alert(`ERRORE DI RETE O DATABASE:\n${e.message}\nRivolgiti alla cassa.`);
      payment.setPaymentStep('error');
      payment.setPaymentError("Impossibile salvare l'ordine. Riprova o vai in cassa.");
      setIsSubmitting(false);
    }
    console.log("[Totem] 🏁 finalizeOrder terminato.");
  };

  const executePaymentStep = (currentCart = cart) => {
    setShowPromoModal(false);
    if (isMobileMode) finalizeOrder(currentCart, "cash");
    else if (data?.paymentSettings?.sumupActive && flags.payments.sumup) payment.setPaymentStep("selection");
    else finalizeOrder(currentCart, "cash");
  };

  const handleProceedToPayment = () => {
    if (data?.promoConfig?.active && data?.promoConfig?.productId && !showPromoModal) {
      const promoItem = data.menuItems?.find((i: any) => i.id === data.promoConfig.productId);
      const isAlreadyInCart = cart.some(c => String(c.id) === String(data.promoConfig.productId));
      if (promoItem && !isAlreadyInCart) { setShowPromoModal(true); return; }
    }
    executePaymentStep(cart);
  };

  const processPaymentSelection = async (method: 'cash' | 'card') => {
    if (method === "cash") { await finalizeOrder(cart, "cash"); return; }
    const backendUrl = resolveBackendUrl(data?.paymentSettings?.backendUrl, window.location.origin);
    // 🔢 Numero ATOMICO pre-assegnato e passato a processCard
    let localNum: number;
    try {
      const assignment = await payment.generateAtomicOrderAssignment({
        ...flags.beepers,
        status: Array.isArray(data?.beeperSettings) ? data.beeperSettings : undefined,
      });
      localNum = assignment.orderNumber;
      console.log(`[Totem] 🔢 Numero atomico per carta: #${localNum} (beeper=${assignment.beeperNumber ?? "OFF"})`);
    } catch (e: any) {
      console.error("[ORDER] generateAtomicOrderNumber failed (card)", e);
      alert("Connessione lenta. Impossibile assegnare un numero.\nRivolgiti alla cassa.");
      return;
    }
    await payment.processCard(
      backendUrl,
      cart,
      cartTotal,
      isMobileMode,
      localNum
    );
  };

  const activeDepartments = [...(data?.departments || DEPARTMENTS_FALLBACK)].filter((d: any) => d.available !== false).sort((a: any, b: any) => (a.sortOrder || 99) - (b.sortOrder || 99));

  // Mobile body scroll fix
  useEffect(() => {
    if (isMobileMode) {
      document.body.classList.add("mobile-mode");
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
    }
    return () => {
      document.body.classList.remove("mobile-mode");
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [isMobileMode]);

  if (isFirestoreOffline && !isMobileMode && !isFirestoreLoading) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center uppercase z-[99999] relative">
        <div className="text-red-500 mb-6 animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M13.83 10.17A10 10 0 0 1 19 12.859"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M17.83 6.17A15 15 0 0 1 22 8.82"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
        </div>
        <h1 className="text-4xl md:text-6xl font-black italic text-white mb-4 tracking-tighter uppercase">TOTEM OFFLINE</h1>
        <p className="text-lg md:text-xl font-bold text-slate-400 mb-8 uppercase">La connessione al database è assente.</p>
        <div className="bg-red-600 text-white p-6 md:p-8 rounded-3xl border-4 border-red-800 shadow-2xl"><p className="text-2xl md:text-4xl font-black italic tracking-widest uppercase">RIVOLGERSI IN CASSA</p></div>
      </div>
    );
  }

  if (isBackendOffline && !isMobileMode) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center uppercase z-[99999] relative">
        <div className="text-red-500 mb-6 animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M13.83 10.17A10 10 0 0 1 19 12.859"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M17.83 6.17A15 15 0 0 1 22 8.82"/><line x1="2" y1="2" x2="22" y2="22"/></svg>
        </div>
        <h1 className="text-4xl md:text-6xl font-black italic text-white mb-4 tracking-tighter uppercase">TOTEM NON DISPONIBILE</h1>
        <p className="text-lg md:text-xl font-bold text-slate-400 mb-8 uppercase">CONNESSIONE ASSENTE</p>
        <div className="bg-red-600 text-white p-6 md:p-8 rounded-3xl border-4 border-red-800 shadow-2xl"><p className="text-2xl md:text-4xl font-black italic tracking-widest uppercase">RIVOLGERSI IN CASSA</p></div>
      </div>
    );
  }

  return (
    <>
      <div className={`kiosk-customer-mode bg-[#fdfbf7] flex flex-col relative uppercase w-full select-none ${isMobileMode ? "min-h-screen" : "h-screen overflow-hidden"}`}>
        
        {isMobileMode && isBackendOffline && (
          <div className="bg-amber-400 text-amber-900 font-black p-2 text-center text-sm md:text-base animate-pulse">
            ⚠️ ATTENZIONE: POS TEMPORANEAMENTE NON DISPONIBILE - SI ACCETTANO SOLO CONTANTI ALLA CASSA
          </div>
        )}

        {isMobileMode && (
          <div className="bg-fuchsia-600 text-white font-black p-2 text-center text-sm uppercase tracking-wider shadow-md">
            📱 MODALITÀ MOBILE · PAGAMENTO IN CASSA AL RITIRO
          </div>
        )}

        <header className={`bg-white flex items-center shrink-0 relative z-40 sticky top-0 ${isMobileMode ? "border-b-4 border-[#FFC72C] px-4 py-2 gap-3 justify-start" : "border-b-8 border-amber-500 p-4 flex-col"}`}>
          <div
            className={`rounded-full overflow-hidden border-2 border-[#FFC72C] shadow-lg bg-white flex items-center justify-center relative cursor-pointer select-none ${isMobileMode ? "h-12 w-12 shrink-0" : "h-16 w-16"}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (kioskExitTimer.current) clearTimeout(kioskExitTimer.current);
              kioskExitTimer.current = setTimeout(() => {
                console.log("[ADMIN] 🔑 long-press logo header → operator PIN");
                setShowKioskExitPin(true);
              }, 5000);
            }}
            onPointerUp={() => { if (kioskExitTimer.current) { clearTimeout(kioskExitTimer.current); kioskExitTimer.current = null; } }}
            onPointerLeave={() => { if (kioskExitTimer.current) { clearTimeout(kioskExitTimer.current); kioskExitTimer.current = null; } }}
            onPointerCancel={() => { if (kioskExitTimer.current) { clearTimeout(kioskExitTimer.current); kioskExitTimer.current = null; } }}
          >
            {!logoError ? (
              <img
                src={business.logoUrl}
                alt={`Logo ${business.name}`}
                className="h-full w-full object-cover pointer-events-none"
                onError={() => setLogoError(true)}
              />
            ) : (
              <span className={`font-black text-[#E30613] ${isMobileMode ? "text-lg" : "text-2xl"}`}>
                {business.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <p className={`font-black italic leading-none tracking-tighter uppercase ${isMobileMode ? "text-[#E30613] text-base" : "text-red-600 mt-1"}`}>
            {business.name} {isMobileMode ? "" : business.tagline}
          </p>
          <LibroAllergeni />
        </header>

        <div className="flex-1 flex overflow-hidden relative w-full">
          <main className={`flex-1 h-full flex flex-col transition-all duration-500 overflow-y-auto ${showCartAside && !isMobileMode ? "w-[60%]" : "w-full"}`}>
            {currentStep === "welcome" && (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center min-h-[70vh] relative" onClick={() => setCurrentStep("departments")}>
                <div
                  className="rounded-full border-[15px] border-amber-500 shadow-2xl overflow-hidden bg-white mb-8 w-64 h-64 md:w-96 md:h-96 uppercase select-none"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    if (kioskExitTimer.current) clearTimeout(kioskExitTimer.current);
                    kioskExitTimer.current = setTimeout(() => {
                      console.log("[ADMIN] 🔑 long-press logo welcome → operator PIN");
                      setShowKioskExitPin(true);
                    }, 5000);
                  }}
                  onPointerUp={(e) => { e.stopPropagation(); if (kioskExitTimer.current) { clearTimeout(kioskExitTimer.current); kioskExitTimer.current = null; } }}
                  onPointerLeave={() => { if (kioskExitTimer.current) { clearTimeout(kioskExitTimer.current); kioskExitTimer.current = null; } }}
                  onPointerCancel={() => { if (kioskExitTimer.current) { clearTimeout(kioskExitTimer.current); kioskExitTimer.current = null; } }}
                  onClick={(e) => e.stopPropagation()}
                >
                   <img
                     src={business.logoUrl}
                     alt={`Logo ${business.name}`}
                     className="w-full h-full object-cover pointer-events-none"
                   />
                </div>
                <h2 className="font-black italic tracking-tighter text-slate-900 leading-none mb-2 text-6xl md:text-9xl uppercase">BENVENUTI</h2>
                <h3 className="font-black text-red-600 italic text-4xl md:text-6xl uppercase">
                  {business.name}
                </h3>
                <div className="mt-12 animate-bounce">
                  <p className="bg-amber-500 text-white px-8 py-4 rounded-full font-black italic text-2xl shadow-2xl uppercase">TOCCA PER ORDINARE</p>
                </div>

                {/* 🔒 Hotspot invisibile per uscita kiosk: long-press 5s → PIN */}
                {!isMobileMode && (
                  <div
                    aria-hidden="true"
                    className="absolute bottom-2 right-2 w-16 h-16 opacity-0"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (kioskExitTimer.current) clearTimeout(kioskExitTimer.current);
                      kioskExitTimer.current = setTimeout(() => {
                        setShowKioskExitPin(true);
                      }, 5000);
                    }}
                    onPointerUp={() => { if (kioskExitTimer.current) { clearTimeout(kioskExitTimer.current); kioskExitTimer.current = null; } }}
                    onPointerLeave={() => { if (kioskExitTimer.current) { clearTimeout(kioskExitTimer.current); kioskExitTimer.current = null; } }}
                    onPointerCancel={() => { if (kioskExitTimer.current) { clearTimeout(kioskExitTimer.current); kioskExitTimer.current = null; } }}
                    onTouchCancel={() => { if (kioskExitTimer.current) { clearTimeout(kioskExitTimer.current); kioskExitTimer.current = null; } }}
                    onMouseLeave={() => { if (kioskExitTimer.current) { clearTimeout(kioskExitTimer.current); kioskExitTimer.current = null; } }}
                  />
                )}
              </div>
            )}

            {currentStep === "departments" && (
              <div className={`flex-1 overflow-y-auto pb-40 animate-in slide-in-from-left uppercase ${isMobileMode ? "p-3" : "p-6 md:p-12"}`}>
                <h2 className={`font-black italic border-l-8 pl-4 uppercase ${isMobileMode ? "text-2xl mb-4 border-[#E30613] text-[#E30613]" : "text-3xl mb-10 border-red-600 text-red-600"}`}>COSA PREFERISCI?</h2>
                <div className={`grid gap-3 uppercase ${isMobileMode ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"}`}>
                  {activeDepartments.map((d: any) => {
                    const DeptIcon = ICON_MAP[d.iconName] || Layers;
                    return (
                      <button key={d.id} onPointerDown={() => preloadDeptImages(d.id)} onClick={() => { setActiveDept(d.id); setCurrentStep("menu"); }} className={`relative text-white shadow-xl flex flex-col items-center justify-center active:scale-95 transition-all overflow-hidden group uppercase ${isMobileMode ? "p-4 rounded-3xl gap-3 h-[160px]" : "p-8 rounded-[3.5rem] gap-6 h-[300px]"}`}>
                        {d.imageUrl && <img src={d.imageUrl} className="absolute inset-0 w-full h-full object-cover transition-transform group-hover:scale-105" />}
                        <div className={`absolute inset-0 ${isMobileMode ? "bg-[#E30613]/55" : `${d.color} opacity-40`}`} />
                        <div className={`relative z-10 bg-white/25 rounded-full ${isMobileMode ? "p-2" : "p-4 md:p-5"}`}><DeptIcon size={isMobileMode ? 28 : 40} /></div>
                        <span className={`relative z-10 font-black italic drop-shadow-md uppercase text-center leading-tight ${isMobileMode ? "text-lg" : "text-3xl"}`}>{d.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {currentStep === "menu" && (
              <div className={`flex-1 overflow-y-auto animate-in slide-in-from-right uppercase ${isMobileMode ? "p-3 pb-32" : "p-6 md:p-12"}`}>
                <div className={`flex items-center mb-4 uppercase ${isMobileMode ? "gap-3" : "gap-6 mb-8"}`}>
                  <button onClick={() => setCurrentStep("departments")} className={`bg-white shadow-lg active:scale-90 transition-transform ${isMobileMode ? "p-3 rounded-full text-[#E30613]" : "p-4 rounded-full text-red-600"}`}><ArrowLeft size={isMobileMode ? 20 : 24} /></button>
                  <h2 className={`font-black italic uppercase ${isMobileMode ? "text-2xl text-[#E30613]" : "text-4xl text-red-600"}`}>{activeDepartments.find((d: any) => d.id === activeDept)?.name}</h2>
                </div>
                <div className={`grid pb-40 uppercase ${isMobileMode ? "grid-cols-2 gap-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"}`}>
                  {data?.menuItems?.filter((i: any) => i.departmentId === activeDept).sort((a: any, b: any) => (a.sortOrder || 99) - (b.sortOrder || 99)).map((i: any, idx: number) => {
                    const isAvailable = i.available !== false;
                    const needsCustomizer = i.isBaseProduct || (i.defaultIngredients?.length > 0) || (i.formats?.length > 0) || !!i.contpiattoDeptId || i.requiresCottura;
                    const cartQty = cart.filter((c: any) => String(c.id) === String(i.id)).reduce((s: number, c: any) => s + c.quantity, 0);
                    const isAboveFold = idx < 8;
                    return (
                      <div key={i.id} className={`bg-white flex flex-col transition-all relative uppercase ${isMobileMode ? "p-2 rounded-2xl shadow-md border-b-4 border-slate-100" : "p-6 rounded-[2.5rem] shadow-xl border-b-8 border-slate-100"} ${isAvailable ? "" : "opacity-60 grayscale"} ${cartQty > 0 ? (isMobileMode ? "ring-2 ring-[#FFC72C]" : "ring-4 ring-amber-500") : ""}`}>
                        <div onClick={() => isAvailable && (needsCustomizer ? openCustomizer(i, i.defaultIngredients || []) : handleAddToCart(i))} className={`w-full bg-slate-100 overflow-hidden relative cursor-pointer uppercase ${isMobileMode ? "aspect-square rounded-xl mb-2" : "h-32 rounded-[1.5rem] mb-4"}`}>
                          {i.imageUrl ? (
                            <img
                              src={i.imageUrl}
                              alt={i.name}
                              loading={isAboveFold ? "eager" : "lazy"}
                              decoding="async"
                              {...(isAboveFold ? { fetchpriority: "high" as any } : {})}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                console.warn('[IMG ERROR]', i.imageUrl);
                                const el = e.currentTarget as HTMLImageElement;
                                el.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-200"><Utensils size={isMobileMode ? 32 : 40} /></div>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); setInfoModalItem(i); }} className={`absolute top-1 right-1 bg-white/90 rounded-full text-blue-600 shadow-md z-20 ${isMobileMode ? "p-1" : "p-2 top-2 right-2"}`}><Info size={isMobileMode ? 14 : 20} /></button>
                          {cartQty > 1 && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 pointer-events-none animate-in zoom-in-50">
                              <span className={`text-white font-black italic drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] ${isMobileMode ? "text-4xl" : "text-6xl"}`}>
                                {cartQty}X
                              </span>
                            </div>
                          )}
                        </div>
                        <h3 className={`font-black italic text-center text-black uppercase leading-tight ${isMobileMode ? "text-sm mb-2 min-h-[2.5rem]" : "text-xl mb-4"}`}>{i.name}</h3>
                        <div className={`mt-auto flex flex-col uppercase ${isMobileMode ? "gap-1.5" : "pt-4 border-t-2 border-slate-50 gap-3"}`}>
                          {!i.isBaseProduct && (
                            <span className={`font-black italic text-center uppercase ${isMobileMode ? "text-xl text-[#E30613]" : "text-2xl text-red-600"}`}>€{getSafePrice(i.price).toFixed(2)}</span>
                          )}

                           {i.isBaseProduct ? (
                             <button onClick={(e) => { e.preventDefault(); if (!isAvailable) return; openCustomizer(i, i.defaultIngredients || []); }} className={`w-full font-black italic uppercase shadow-md active:scale-95 ${isMobileMode ? "py-2.5 rounded-xl text-sm" : "py-3 rounded-full text-xl"} ${isAvailable ? (isMobileMode ? "bg-[#FFC72C] text-[#E30613]" : "bg-indigo-500 text-white") : "bg-slate-300 text-slate-500"}`}>CREA ORA</button>
                           ) : needsCustomizer ? (
                             <div className="flex items-center gap-1.5 w-full">
                               <button onClick={(e) => { e.preventDefault(); if (!isAvailable) return; handleAddToCart({ ...i, selectedIngredients: [...(i.defaultIngredients || [])] }); }} className={`flex-1 font-black italic uppercase shadow-sm flex items-center justify-center gap-1 active:scale-95 ${isMobileMode ? "py-2.5 rounded-xl text-sm" : "py-3 rounded-full text-base md:text-xl gap-2"} ${isAvailable ? (isMobileMode ? "bg-[#FFC72C] text-[#E30613]" : "bg-emerald-100 text-emerald-700") : "bg-slate-200 text-slate-400"}`}><Plus size={isMobileMode ? 16 : 20} /> AGGIUNGI</button>
                               <button onClick={(e) => { e.preventDefault(); if (!isAvailable) return; openCustomizer(i, i.defaultIngredients || []); }} className={`shrink-0 flex items-center justify-center shadow-sm active:scale-95 ${isMobileMode ? "w-10 h-10 rounded-xl" : "w-[48px] h-[48px] md:w-[56px] md:h-[56px] rounded-[1rem]"} ${isAvailable ? (isMobileMode ? "bg-[#E30613] text-white" : "bg-orange-500 text-white") : "bg-slate-300 text-slate-500"}`}><Edit3 size={isMobileMode ? 16 : 20} /></button>
                             </div>
                           ) : (
                             <button onClick={(e) => { e.preventDefault(); if (!isAvailable) return; handleAddToCart(i); }} className={`w-full font-black italic uppercase shadow-md active:scale-95 ${isMobileMode ? "py-2.5 rounded-xl text-sm" : "py-3 rounded-full text-xl"} ${isAvailable ? (isMobileMode ? "bg-[#FFC72C] text-[#E30613]" : "bg-emerald-500 text-white") : "bg-slate-300 text-slate-500"}`}>AGGIUNGI</button>
                           )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {currentStep === "customizer" && customizingItem && (
              <CustomizerModal
                item={customizingItem}
                ingredients={data?.ingredientsPool || []}
                initialSelected={customizingItem.selectedIngredients || customizingItem.defaultIngredients || []}
                initialFormatName={customizingItem._formato_scelto} 
                initialContorniNames={customizingItem._contorni || []} 
                initialCottura={customizingItem._cottura}
                contorni={data?.menuItems?.filter((m: any) => m.departmentId === customizingItem.contpiattoDeptId && m.available !== false).sort((a: any, b: any) => (a.sortOrder || 99) - (b.sortOrder || 99)) || []}
                onCancel={() => { setCurrentStep("menu"); setCustomizingItem(null); }}
                onConfirm={(sel: string[], ext: number, fmt: any, cnt: any[], cot?: string) => {
                  const sCounts: Record<string, number> = {}; sel.forEach(id => sCounts[id] = (sCounts[id] || 0) + 1);
                  const bCounts: Record<string, number> = {}; (customizingItem.defaultIngredients || []).forEach((id:any) => bCounts[id] = (bCounts[id] || 0) + 1);
                  const names = customizingItem.isBaseProduct 
                    ? Object.entries(sCounts).map(([id, q]) => { const ing = data?.ingredientsPool?.find((i:any) => String(i.id) === String(id)); return (q as number) > 1 ? `${q}x ${ing?.name}` : ing?.name; }).filter(Boolean) as string[]
                    : [ ...Object.keys(sCounts).flatMap(id => { const add = sCounts[id] - (bCounts[id] || 0); const ing = data?.ingredientsPool?.find((i:any) => String(i.id) === String(id)); return add > 0 && ing ? [`+ ${add > 1 ? add + "x " : ""}${ing.name}`] : []; }), ...Object.keys(bCounts).flatMap(id => { const rem = bCounts[id] - (sCounts[id] || 0); const ing = data?.ingredientsPool?.find((i:any) => String(i.id) === String(id)); return rem > 0 && ing ? [`SENZA ${ing.name}`] : []; }) ];
                  if (cot) names.push(`COTTURA: ${cot.toUpperCase()}`);
                  
                  const qtyToRestore = customizingItem.cartItemIdToUpdate ? cart.find((c: any) => c.cartId === customizingItem.cartItemIdToUpdate)?.quantity || 1 : 1;
                  
                  if (customizingItem.cartItemIdToUpdate) setCart(prev => prev.filter(c => c.cartId !== customizingItem.cartItemIdToUpdate));
                  handleAddToCart({ ...customizingItem, price: getSafePrice(customizingItem.price) + ext, selectedIngredients: sel, _formato_scelto: fmt?.name || undefined, _contorni: cnt?.map((c:any) => c.name) || undefined }, names, qtyToRestore, cot);
                  setCurrentStep("menu"); setCustomizingItem(null);
                }}
              />
            )}
          </main>

          {showCartAside && !isMobileMode && (
            <aside className="bg-white flex flex-col shadow-2xl animate-in slide-in-from-right z-[150] relative w-[40%] border-l-[10px] border-amber-500 pb-48 uppercase">
              <div className="p-6 border-b-4 border-slate-50 bg-[#fdfbf7] flex justify-between items-center uppercase font-black italic text-red-600">
                <h2 className="text-2xl uppercase">IL TUO ORDINE</h2>
                <button onClick={() => setCart([])} className="text-slate-300 hover:text-red-500 uppercase"><Trash2 size={24} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4 uppercase">
                {cart.map((i: any) => (
                  <div key={i.cartId} className="bg-white rounded-[2rem] p-4 shadow-md border-l-[10px] border-amber-500 flex flex-col uppercase">
                    <div className="flex justify-between items-start gap-3 font-black italic uppercase">
                      <div className="flex-1 min-w-0">
                        <p className="text-lg text-black uppercase break-words">{i.name}</p>
                        {i.customization?.length > 0 && <p className="text-[10px] text-amber-600 leading-tight mt-1 uppercase break-words">{i.customization.join(", ")}</p>}
                        {isCartItemEditable(i) && (
                          <button onClick={() => handleEditCartItem(i)} className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg text-[11px] mt-2 flex items-center gap-1 uppercase font-black active:scale-95">
                            <Edit3 size={14}/> MODIFICA
                          </button>
                        )}
                      </div>
                      <span className="text-red-600 text-xl uppercase whitespace-nowrap shrink-0">€{(getSafePrice(i.price) * i.quantity).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-3 bg-slate-100 border-2 border-slate-300 rounded-2xl p-2 shadow-inner">
                      <button onClick={() => updateCartQuantity(i.cartId, -1)} className="w-14 h-14 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md border-2 border-red-700 active:scale-90">
                        {i.quantity === 1 ? <Trash2 size={26} strokeWidth={3} /> : <Minus size={26} strokeWidth={4} />}
                      </button>
                      <span className="text-3xl font-black text-slate-900 w-16 text-center">{i.quantity}</span>
                      <button onClick={() => updateCartQuantity(i.cartId, 1)} className="w-14 h-14 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-md border-2 border-emerald-700 active:scale-90">
                        <Plus size={26} strokeWidth={4} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="absolute bottom-0 left-0 w-full bg-red-600 text-white p-8 uppercase shadow-2xl">
                <div className="flex justify-between items-end mb-6 uppercase">
                  <span className="font-black text-sm opacity-90 uppercase">TOTALE</span>
                  <span className="text-5xl font-black italic text-amber-400 uppercase">€{cartTotal.toFixed(2)}</span>
                </div>
                <button disabled={payment.isPolling || isSubmitting} onClick={handleProceedToPayment} className="w-full py-6 rounded-full font-black text-3xl italic bg-white text-red-600 active:scale-95 transition-transform uppercase">ORDINA ORA</button>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* MOBILE: Sticky bottom cart bar — sempre visibile (stile McDonald's) */}
      {isMobileMode && !isMobileCartOpen && currentStep !== "customizer" && (
        <div className="fixed bottom-0 left-0 right-0 z-[200] bg-[#E30613] text-white shadow-2xl border-t-4 border-[#FFC72C] px-4 py-3 flex items-center justify-between gap-3">
          <button
            onClick={() => cart.length > 0 && setIsMobileCartOpen(true)}
            disabled={cart.length === 0}
            className="flex items-center gap-3 active:scale-95 disabled:opacity-60"
          >
            <div className="relative bg-white/15 rounded-full p-2.5">
              <ShoppingBasket size={26} />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#FFC72C] text-[#E30613] text-xs font-black rounded-full w-6 h-6 flex items-center justify-center border-2 border-[#E30613]">
                  {cart.reduce((s, i: any) => s + i.quantity, 0)}
                </span>
              )}
            </div>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[10px] font-black opacity-90 uppercase tracking-wider">
                {cart.length === 0 ? "Carrello vuoto" : "Vedi ordine"}
              </span>
              <span className="text-2xl font-black italic text-[#FFC72C]">€{cartTotal.toFixed(2)}</span>
            </div>
          </button>
          <button
            disabled={cart.length === 0 || payment.isPolling || isSubmitting}
            onClick={handleProceedToPayment}
            className="bg-[#FFC72C] text-[#E30613] font-black italic px-6 py-4 rounded-2xl shadow-lg active:scale-95 disabled:opacity-50 text-base uppercase tracking-tight"
          >
            ORDINA ORA
          </button>
        </div>
      )}

      {/* MOBILE: Fullscreen cart drawer (stile McDonald's) */}
      {isMobileMode && isMobileCartOpen && (
        <div className="fixed inset-0 z-[300] bg-white flex flex-col uppercase">
          <div className="p-3 border-b-4 border-[#FFC72C] bg-white flex justify-between items-center sticky top-0 z-10 gap-2 shadow-md">
            <button
              onClick={() => setIsMobileCartOpen(false)}
              className="bg-slate-900 text-white font-black px-3 py-2 rounded-full text-xs uppercase flex items-center gap-1.5"
            >
              <ArrowLeft size={14} strokeWidth={3} /> CONTINUA
            </button>
            <h2 className="text-lg font-black italic text-[#E30613]">IL TUO ORDINE</h2>
            <button
              onClick={() => setCart([])}
              className="text-slate-400 hover:text-[#E30613] p-2"
              title="Svuota carrello"
            >
              <Trash2 size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-48">
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-slate-400">
                <ShoppingBasket size={48} strokeWidth={1.5} />
                <p className="font-black italic">CARRELLO VUOTO</p>
              </div>
            )}
            {cart.map((i: any) => (
              <div key={i.cartId} className="bg-white rounded-2xl p-3 shadow-md border-l-[8px] border-[#FFC72C] flex flex-col">
                <div className="flex justify-between items-start gap-3 font-black italic">
                  <div className="flex-1 min-w-0">
                    <p className="text-base text-black break-words">{i.name}</p>
                    {i.customization?.length > 0 && <p className="text-[10px] text-[#E30613] leading-tight mt-1 normal-case break-words">{i.customization.join(", ")}</p>}
                    {isCartItemEditable(i) && (
                      <button onClick={() => handleEditCartItem(i)} className="text-blue-700 bg-blue-50 border border-blue-200 px-2 py-1 rounded-lg text-[11px] mt-2 flex items-center gap-1 font-black active:scale-95">
                        <Edit3 size={14}/> MODIFICA
                      </button>
                    )}
                  </div>
                  <span className="text-[#E30613] text-lg whitespace-nowrap shrink-0">€{(getSafePrice(i.price) * i.quantity).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between mt-3 bg-slate-100 border-2 border-slate-300 rounded-2xl p-2 shadow-inner">
                  <button onClick={() => updateCartQuantity(i.cartId, -1)} className="w-12 h-12 bg-[#E30613] text-white rounded-full flex items-center justify-center shadow-md active:scale-90">
                    {i.quantity === 1 ? <Trash2 size={22} strokeWidth={3} /> : <Minus size={22} strokeWidth={4} />}
                  </button>
                  <span className="text-2xl font-black text-slate-900 w-14 text-center">{i.quantity}</span>
                  <button onClick={() => updateCartQuantity(i.cartId, 1)} className="w-12 h-12 bg-[#FFC72C] text-[#E30613] rounded-full flex items-center justify-center shadow-md active:scale-90">
                    <Plus size={22} strokeWidth={4} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="fixed bottom-0 left-0 w-full bg-[#E30613] text-white p-4 shadow-2xl z-[310]">
            <div className="bg-[#FFC72C] text-[#E30613] font-black text-center py-2 px-3 rounded-xl mb-3 text-sm uppercase tracking-wide">
              💶 PAGAMENTO IN CASSA AL RITIRO
            </div>
            <div className="flex justify-between items-end mb-3">
              <span className="font-black text-sm opacity-90">TOTALE</span>
              <span className="text-4xl font-black italic text-[#FFC72C]">€{cartTotal.toFixed(2)}</span>
            </div>
            <button
              disabled={payment.isPolling || isSubmitting || cart.length === 0}
              onClick={handleProceedToPayment}
              className="w-full py-4 rounded-2xl font-black text-2xl italic bg-[#FFC72C] text-[#E30613] active:scale-95 transition-transform disabled:opacity-50"
            >
              ORDINA ORA
            </button>
          </div>
        </div>
      )}

      {payment.paymentStep && <PaymentModal step={payment.paymentStep} total={cartTotal} errorDetail={payment.paymentError || ""} onSelectMethod={processPaymentSelection} onCancel={payment.resetPayment} onCancelPolling={payment.cancelPolling} isBackendOffline={isBackendOffline} checkoutId={payment.checkoutId} pollAttempts={payment.pollAttempts} lastStatus={payment.lastStatus} pollStartedAt={payment.pollStartedAt} onSwitchToCash={() => { try { payment.cancelPolling(); } catch {} processPaymentSelection('cash'); }} />}

      {/* (Overlay assegnazione rimosso: numero locale immediato) */}

      {orderComplete && (
        <div className="fixed inset-0 bg-slate-950/98 flex items-center justify-center z-[1000] p-6 text-center uppercase">
          <div className="bg-white max-w-sm rounded-[4rem] p-10 border-b-[20px] border-emerald-500 shadow-2xl animate-in zoom-in-95 uppercase">
            <CheckCircle2 className="mx-auto mb-6 text-emerald-500" size={80}/>
            <p className="text-sm font-black text-emerald-600 uppercase mb-2">IL TUO NUMERO</p>
            <p className="text-[7rem] font-black text-slate-800 italic leading-none uppercase">#{getOrderNumber(orderComplete)}</p>
            <p className="text-xl font-black text-slate-800 uppercase leading-tight mb-2 mt-4">
              {flags.beepers.enabled && hasPhysicalBeeper(orderComplete, flags.beepers)
                ? "Ritira il campanello in cassa/panineria"
                : flags.beepers.fallbackText}
            </p>
          </div>
        </div>
      )}
      
      {showPromoModal && data?.promoConfig && (
        <PromoModal 
          promoItem={data.menuItems?.find((i: any) => i.id === data.promoConfig.productId)} 
          promoPrice={safePromoPrice} 
          message={data.promoConfig.message} 
          onAccept={() => {
            const promoItem = data.menuItems?.find((i: any) => i.id === data.promoConfig.productId);
            if (promoItem) {
              const newItem = {
                cartId: Date.now() + Math.random(), signature: `${promoItem.id}|PROMOZIONE|||`,
                id: promoItem.id, name: promoItem.name, price: safePromoPrice,
                customization: ["PROMOZIONE"], selectedIngredients: promoItem.defaultIngredients || [],
                defaultIngredients: promoItem.defaultIngredients || [], quantity: 1, paid: false,
              };
              const newCart = [...cart, newItem];
              setCart(newCart); executePaymentStep(newCart);
            } else { executePaymentStep(cart); }
          }} 
          onDecline={() => executePaymentStep(cart)} 
        />
      )}
      
      {infoModalItem && <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 p-4 uppercase" onClick={() => setInfoModalItem(null)}><div className="bg-white rounded-[3rem] p-8 max-w-md w-full relative border-b-[15px] border-blue-500 uppercase" onClick={e => e.stopPropagation()}><h2 className="text-3xl font-black italic mb-4 uppercase">{infoModalItem.name}</h2><div className="bg-blue-50 p-6 rounded-2xl text-left uppercase"><p className="text-blue-800 font-black mb-2 text-sm uppercase">DETTAGLI / ALLERGENI</p><p className="text-blue-900 font-medium text-sm leading-snug uppercase">{infoModalItem.ingredients || "Chiedere al personale."}</p></div><button onClick={() => setInfoModalItem(null)} className="mt-6 w-full py-4 bg-slate-100 rounded-2xl font-black uppercase">CHIUDI</button></div></div>}
      {showKioskExitPin && (
        <PinModal
          correctPin={data?.adminPin}
          onSuccess={() => {
            setShowKioskExitPin(false);
            setShowOperatorChoice(true);
          }}
          onCancel={() => setShowKioskExitPin(false)}
        />
      )}

      {showOperatorChoice && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 uppercase">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full relative border-b-[15px] border-amber-500 shadow-2xl">
            <h2 className="text-3xl font-black italic mb-2 text-red-600 uppercase tracking-tighter text-center">ACCESSO OPERATORE</h2>
            <p className="text-sm font-bold text-slate-500 mb-6 uppercase text-center">SELEZIONA AZIONE</p>
            <div className="flex flex-col gap-4">
              <button
                onClick={() => { window.location.href = "/admin"; }}
                className="w-full py-5 rounded-2xl font-black italic text-xl uppercase bg-indigo-600 text-white shadow-md active:scale-95"
              >
                ENTRA IN ADMIN
              </button>
              <button
                onClick={async () => {
                  console.log("[ADMIN] 🔒 Close kiosk triggered");

                  // 1) Reset stato app
                  try { setShowOperatorChoice(false); } catch {}
                  try { setCart([]); } catch {}
                  try { payment.resetPayment(); } catch {}
                  try { setShowPromoModal(false); } catch {}
                  try { setIsMobileCartOpen(false); } catch {}
                  try { setInfoModalItem(null); } catch {}
                  try { setCustomizingItem(null); } catch {}
                  try { setOrderComplete(null); } catch {}
                  // (rimossi reset assigningOrder/assignStartedAt: stato eliminato)
                  try { sessionStorage.removeItem("orazio_cart_session"); } catch {}

                  // 2) Exit fullscreen forzato cross-browser (errori NON bloccano)
                  console.log("[ADMIN] 🖥️ Exit fullscreen");
                  try {
                    const d: any = document;
                    if (document.fullscreenElement && document.exitFullscreen) {
                      await document.exitFullscreen();
                    } else if (d.webkitFullscreenElement && d.webkitExitFullscreen) {
                      d.webkitExitFullscreen();
                    } else if (d.msFullscreenElement && d.msExitFullscreen) {
                      d.msExitFullscreen();
                    }
                  } catch (e) {
                    console.warn("[ADMIN] exitFullscreen failed (ignorato)", e);
                  }

                  // 3) window.close
                  try { window.close(); } catch {}

                  // 4) Fallback touch-friendly: schermata kioskClosed + custom protocol
                  setTimeout(() => {
                    if (!window.closed) {
                      console.log("[ADMIN] ❌ window.close bloccato → kiosk-exit:// + schermata kioskClosed");
                      // Tenta custom protocol Windows (richiede kiosk-exit.reg installato)
                      try {
                        const a = document.createElement("a");
                        a.href = "kiosk-exit://close";
                        a.style.display = "none";
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(() => { try { document.body.removeChild(a); } catch {} }, 100);
                      } catch (e) {
                        console.warn("[ADMIN] kiosk-exit:// failed (ignorato)", e);
                      }
                      // Mostra schermata pulita invece di pagina bianca
                      setKioskClosed(true);
                    }
                  }, 300);
                }}
                className="w-full py-5 rounded-2xl font-black italic text-xl uppercase bg-red-600 text-white shadow-md active:scale-95"
              >
                CHIUDI KIOSK
              </button>
              <button
                onClick={() => setShowOperatorChoice(false)}
                className="w-full py-4 rounded-2xl font-black italic text-lg uppercase bg-slate-100 text-slate-700 active:scale-95"
              >
                ANNULLA
              </button>
            </div>
          </div>
        </div>
      )}

      {kioskClosed && (
        <div className="fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-slate-950 text-white p-8 uppercase">
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-amber-400 bg-white p-2 mb-8 shadow-2xl">
            {!logoError ? (
              <img
                src={business.logoUrl}
                alt={`Logo ${business.name}`}
                className="w-full h-full object-contain rounded-full"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="w-full h-full kiosk-gradient flex items-center justify-center rounded-full">
                <span className="text-5xl font-black text-primary-foreground">
                {business.name.charAt(0).toUpperCase()}
              </span>
              </div>
            )}
          </div>
          <h1 className="text-5xl md:text-6xl font-black italic tracking-tighter text-center text-amber-400 mb-4">
            KIOSK CHIUSO
          </h1>
          <p className="text-lg md:text-xl font-bold text-slate-300 text-center mb-12 max-w-md">
            Puoi tornare al desktop Windows oppure riavviare il totem.
          </p>
          <div className="flex flex-col gap-5 w-full max-w-md">
            <button
              onClick={() => {
                console.log("[ADMIN] 🔄 Riavvia totem");
                setKioskClosed(false);
                window.location.href = "/";
                setTimeout(() => { try { window.location.reload(); } catch {} }, 50);
              }}
              className="w-full py-7 rounded-2xl font-black italic text-2xl uppercase bg-emerald-600 text-white shadow-2xl active:scale-95 transition-transform"
            >
              RIAVVIA TOTEM
            </button>
            <button
              onClick={() => {
                console.log("[ADMIN] 🚪 Esci da Edge (retry)");
                try { window.close(); } catch {}
                setTimeout(() => {
                  try {
                    const a = document.createElement("a");
                    a.href = "kiosk-exit://close";
                    a.style.display = "none";
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => { try { document.body.removeChild(a); } catch {} }, 100);
                  } catch (e) {
                    console.warn("[ADMIN] kiosk-exit:// retry failed", e);
                  }
                }, 100);
              }}
              className="w-full py-6 rounded-2xl font-black italic text-xl uppercase bg-red-600 text-white shadow-xl active:scale-95 transition-transform"
            >
              ESCI DA EDGE
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-12 text-center max-w-md font-medium tracking-wider">
            "ESCI DA EDGE" RICHIEDE IL PROTOCOLLO KIOSK-EXIT INSTALLATO SUL PC.
            ALTRIMENTI USA "RIAVVIA TOTEM" E CHIUDI DAL DESKTOP.
          </p>
        </div>
      )}

      {inactivityWarning && (
        <InactivityWarning
          countdown={inactivityCountdown}
          onDismiss={() => {
            // Solo questo bottone può annullare il countdown.
            warningActiveRef.current = false;
            setInactivityWarning(false);
            setInactivityCountdown(COUNTDOWN_LIMIT);
            if (countdownTimerRef.current) { clearInterval(countdownTimerRef.current); countdownTimerRef.current = null; }
            resetInactivityTimer();
          }}
        />
      )}

      {/* 🖨️ Slot di stampa nascosti a video, visibili solo in @media print.
          Filtri: niente placeholder card pre-conferma (number "...") né id 'pending'. */}
      {!isMobileMode && orderComplete && orderComplete.id !== 'pending' && orderComplete.number && orderComplete.number !== '...' && <PrintTemplate order={orderComplete} />}
      {!isMobileMode && radarOrder && radarOrder.number && radarOrder.number !== '...' && <PrintTemplate order={radarOrder} />}
      {!isMobileMode && reprintOrder && reprintOrder.number && reprintOrder.number !== '...' && <PrintTemplate order={reprintOrder} isReprint />}
    </>
  );
};

export default CustomerTotem;
