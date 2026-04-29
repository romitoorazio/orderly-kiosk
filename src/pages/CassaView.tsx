import React, { useState, useMemo, useEffect } from "react";
import { Plus, Printer, CheckSquare, CheckCircle2, Square, RefreshCw, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { doc, updateDoc, deleteField } from "firebase/firestore";
import { db, APP_ID } from "@/lib/firebase";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useFirestoreData } from "@/hooks/useFirestoreData";
import { useActiveOrders } from "@/hooks/useActiveOrders";
import { resolveBackendUrl } from "@/lib/constants";
import { releaseBeeper, reconcileBeeperPool } from "@/lib/beeperPool";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { getOrderNumber, getReleaseNumberForOrder } from "@/lib/orderDisplay";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const getSafeDate = (o: any) => {
  if (!o) return new Date();
  if (o.timestamp?.seconds) return new Date(o.timestamp.seconds * 1000);
  if (typeof o.timestamp?.toDate === "function") return o.timestamp.toDate();
  if (typeof o.timestamp === "number" || typeof o.timestamp === "string") {
    const d = new Date(o.timestamp);
    if (!isNaN(d.getTime())) return d;
  }
  if (o.clientTimestamp) return new Date(o.clientTimestamp);
  return new Date();
};

// Range helpers in LOCAL timezone (no UTC conversions)
const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtDay = (d: Date) => d.toLocaleDateString();

type RangePreset = "today" | "yesterday" | "last7" | "month" | "custom";

// Payment status classification — "card" is only a method type, NOT a paid confirmation.
const PAID_CARD_STATUSES = new Set(["success", "successful", "paid", "completed", "captured"]);
const PENDING_STATUSES = new Set(["pending", "processing", "in_progress"]);
const FAILED_STATUSES = new Set(["failed", "cancelled", "canceled", "expired", "declined", "error"]);

const isPaidCardOrder = (o: any) => {
  const ps = String(o?.paymentStatus || "").toLowerCase();
  if (PAID_CARD_STATUSES.has(ps)) return true;
  if (o?.paid === true && o?.type === "card") return true;
  return false;
};
const isPaidCashOrder = (o: any) => {
  const ps = String(o?.paymentStatus || "").toLowerCase();
  return ps === "cash" || (o?.paid === true && o?.type === "cash");
};
const isPendingPayment = (o: any) => {
  const ps = String(o?.paymentStatus || "").toLowerCase();
  return PENDING_STATUSES.has(ps) && o?.paid !== true;
};
const isFailedPayment = (o: any) => {
  const ps = String(o?.paymentStatus || "").toLowerCase();
  return FAILED_STATUSES.has(ps) && o?.paid !== true;
};

const CassaView: React.FC = () => {
  const { user } = useFirebaseAuth();
  const data = useFirestoreData(user);
  const { flags } = useFeatureFlags();
  // 🔥 Live SOLO ordini attivi (open/in lavorazione/pronti). Storico via fetchOrdersInRange.
  const orders = useActiveOrders(user);
  const fetchOrdersInRange = data?.fetchOrdersInRange;

  // 🧹 Reconcile beeperPool al mount (rimuove fantasmi)
  useEffect(() => {
    if (!user) return;
    reconcileBeeperPool(flags.beepers);
  }, [user, flags.beepers]);

  const [tab, setTab] = useState<"riepilogo" | "aperti">("aperti");
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedToPay, setSelectedToPay] = useState<number[]>([]);
  const [extraModal, setExtraModal] = useState<{ orderId: string } | null>(null);
  const [extraName, setExtraName] = useState("");
  const [extraPrice, setExtraPrice] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  // ---- HISTORY FILTERS (riepilogo) ----
  const [preset, setPreset] = useState<RangePreset>("today");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [singleDayOffset, setSingleDayOffset] = useState(0);
  const [historyOrders, setHistoryOrders] = useState<any[] | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Compute current range in LOCAL TZ
  const { rangeStart, rangeEnd, rangeLabel, isSingleDay, isToday } = useMemo(() => {
    const now = new Date();
    if (preset === "today") {
      const base = addDays(now, singleDayOffset);
      const isT = singleDayOffset === 0;
      return {
        rangeStart: startOfLocalDay(base),
        rangeEnd: endOfLocalDay(base),
        rangeLabel: isT ? `OGGI · ${fmtDay(base)}` : fmtDay(base),
        isSingleDay: true,
        isToday: isT,
      };
    }
    if (preset === "yesterday") {
      const base = addDays(now, -1 + singleDayOffset);
      return {
        rangeStart: startOfLocalDay(base),
        rangeEnd: endOfLocalDay(base),
        rangeLabel: `${fmtDay(base)}`,
        isSingleDay: true,
        isToday: false,
      };
    }
    if (preset === "last7") {
      const s = startOfLocalDay(addDays(now, -6));
      const e = endOfLocalDay(now);
      return { rangeStart: s, rangeEnd: e, rangeLabel: `ULTIMI 7 GIORNI · ${fmtDay(s)} → ${fmtDay(now)}`, isSingleDay: false, isToday: false };
    }
    if (preset === "month") {
      const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const e = endOfLocalDay(now);
      return { rangeStart: s, rangeEnd: e, rangeLabel: `QUESTO MESE · ${fmtDay(s)} → ${fmtDay(now)}`, isSingleDay: false, isToday: false };
    }
    const f = customFrom ? startOfLocalDay(customFrom) : startOfLocalDay(now);
    const t = customTo ? endOfLocalDay(customTo) : endOfLocalDay(now);
    return { rangeStart: f, rangeEnd: t, rangeLabel: `${fmtDay(f)} → ${fmtDay(t)}`, isSingleDay: f.toDateString() === t.toDateString(), isToday: false };
  }, [preset, singleDayOffset, customFrom, customTo]);

  useEffect(() => {
    if (preset !== "today" && preset !== "yesterday") setSingleDayOffset(0);
  }, [preset]);

  // Fetch history per qualsiasi range (incluso OGGI).
  useEffect(() => {
    if (tab !== "riepilogo") return;
    if (!fetchOrdersInRange) return;
    let cancelled = false;
    const startMs = rangeStart.getTime();
    const endMs = rangeEnd.getTime();
    setLoadingHistory(true);
    setHistoryError(null);
    fetchOrdersInRange(startMs, endMs)
      .then((list) => {
        if (cancelled) return;
        if (isToday) {
          console.log("[CASSA TODAY FETCH]", { startMs, endMs, count: list.length, first: list[0] });
        }
        setHistoryOrders(list);
      })
      .catch((e: any) => { if (!cancelled) { setHistoryError(String(e?.message || e)); setHistoryOrders([]); } })
      .finally(() => { if (!cancelled) setLoadingHistory(false); });
    return () => { cancelled = true; };
  }, [tab, isToday, rangeStart, rangeEnd, fetchOrdersInRange]);

  const refOrder = (id: string) => doc(db, "artifacts", APP_ID, "public", "data", "orders", id);

  // Stats source: sempre da historyOrders (anche OGGI). 'orders' live serve solo alla tab "aperti".
  const statsOrders = useMemo(() => {
    return (historyOrders || []).filter((o: any) => !["cancelled"].includes(o.status));
  }, [historyOrders]);

  const stats = useMemo(() => {
    const cashT = statsOrders
      .filter(isPaidCashOrder)
      .reduce((s: number, o: any) => s + Number(o.total || 0), 0);
    const cardT = statsOrders
      .filter(isPaidCardOrder)
      .reduce((s: number, o: any) => s + Number(o.total || 0), 0);
    const unpaidT = statsOrders
      .filter((o: any) =>
        !isPaidCashOrder(o) &&
        !isPaidCardOrder(o) &&
        !isPendingPayment(o) &&
        !isFailedPayment(o)
      )
      .reduce((s: number, o: any) => s + Number(o.total || 0), 0);
    return { today: cashT + cardT, cashT, cardT, unpaidT, count: statsOrders.length };
  }, [statsOrders]);

  // History list ordered DESC (newest first), consistent with OGGI live view
  const historyList = useMemo(() => {
    return [...statsOrders].sort((a: any, b: any) => getSafeDate(b).getTime() - getSafeDate(a).getTime());
  }, [statsOrders]);

  const displayOrders = orders.filter(
    (o: any) =>
      !["closed", "cancelled"].includes(o.status) &&
      // 🛡️ Nascondi placeholder card pre-conferma
      !(o?.paymentStatus === "pending" && (!o?.number || o?.number === "..."))
  );
  const selected: any = orders.find((o: any) => o.id === selectedOrder);
  const items = selected?.items || [];
  const paidAmount = items.reduce(
    (s: number, i: any) => (i.paid ? s + Number(i.price) * Number(i.quantity) : s),
    0
  );

  const reprint = async (id: string) => {
    try {
      await updateDoc(refOrder(id), { printSignal: Date.now() });
    } catch (e) {
      console.error("[Cassa] reprint failed", e);
    }
  };

  const handlePaySelected = async () => {
    if (!selected || isActionLoading || selectedToPay.length === 0) return;
    setIsActionLoading(true);
    try {
      const ni = [...items];
      selectedToPay.forEach((idx) => {
        if (ni[idx]) ni[idx] = { ...ni[idx], paid: true };
      });
      const isAllPaid = ni.every((i: any) => i.paid);
      await updateDoc(refOrder(selected.id), {
        items: ni,
        paid: isAllPaid,
        ...(isAllPaid
          ? {
              paymentStatus: "cash",
              paymentVerifiedAt: Date.now(),
              syncError: deleteField(),
            }
          : {}),
      });
      setSelectedToPay([]);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handlePayAll = async () => {
    if (!selected || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const ni = items.map((it: any) => ({ ...it, paid: true }));
      await updateDoc(refOrder(selected.id), {
        items: ni,
        paid: true,
        paymentStatus: "cash",
        paymentVerifiedAt: Date.now(),
        syncError: deleteField(),
        manualCheckRequired: deleteField(),
      });
      setSelectedToPay([]);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!selected || isActionLoading) return;
    setIsActionLoading(true);
    try {
      await updateDoc(refOrder(selected.id), { status: "closed" });
      // 🔓 Rilascia beeper alla chiusura ordine
      const releaseNumber = getReleaseNumberForOrder(selected, flags.beepers);
      if (releaseNumber !== null) await releaseBeeper(releaseNumber, flags.beepers);
      setSelectedOrder(null);
      setSelectedToPay([]);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRecoverySumUp = async () => {
    if (!selected || isActionLoading) return;
    setIsActionLoading(true);
    try {
      const backendUrl = resolveBackendUrl(data?.paymentSettings?.backendUrl, window.location.origin);
      const url = `${backendUrl}?${
        selected.checkoutId ? `id=${selected.checkoutId}&` : ""
      }orderId=${selected.id}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.status === "SUCCESS" && json.firebase_updated) alert("✔️ RECOVERY RIUSCITO!");
      else alert("❌ FALLITO O NON PAGATO.");
    } catch (e) {
      alert("ERRORE CONNESSIONE.");
    } finally {
      setIsActionLoading(false);
    }
  };

  const submitExtra = async () => {
    if (!extraModal) return;
    const order: any = orders.find((o: any) => o.id === extraModal.orderId);
    if (!order) return;
    const price = parseFloat(extraPrice);
    if (!extraName.trim() || isNaN(price)) return;
    const newItem = { name: extraName.trim(), price, quantity: 1, isExtra: true };
    const newItems = [...(order.items || []), newItem];
    const newTotal = newItems.reduce(
      (s: number, i: any) => s + Number(i.price) * Number(i.quantity),
      0
    );
    await updateDoc(refOrder(order.id), { items: newItems, total: newTotal });
    setExtraModal(null);
    setExtraName("");
    setExtraPrice("");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4">
      <div className="flex items-center justify-between bg-slate-900 rounded-2xl px-4 py-3 mb-4">
        <a href="/hub" className="px-3 py-2 bg-slate-700 text-white rounded-lg font-black text-sm">
          ← HUB
        </a>
        <h1 className="text-3xl font-black">💰 CASSA CENTRALE</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setTab("aperti")}
            className={`px-6 py-2 rounded-2xl font-black text-base border-4 ${
              tab === "aperti" ? "bg-white text-black border-white" : "bg-slate-800 text-slate-500 border-transparent"
            }`}
          >
            ATTIVI
          </button>
          <button
            onClick={() => setTab("riepilogo")}
            className={`px-6 py-2 rounded-2xl font-black text-base border-4 ${
              tab === "riepilogo"
                ? "bg-indigo-600 border-indigo-400 text-white"
                : "bg-slate-800 text-slate-500 border-transparent"
            }`}
          >
            RESOCONTO
          </button>
        </div>
      </div>

      {tab === "riepilogo" ? (
        <div className="space-y-4">
          {/* FILTRI */}
          <div className="bg-slate-900 rounded-2xl p-4 flex flex-wrap items-center gap-2">
            {([
              { id: "today", label: "OGGI" },
              { id: "yesterday", label: "IERI" },
              { id: "last7", label: "ULTIMI 7 GG" },
              { id: "month", label: "QUESTO MESE" },
              { id: "custom", label: "INTERVALLO…" },
            ] as { id: RangePreset; label: string }[]).map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-4 py-2 rounded-xl font-black text-xs uppercase border-2 ${
                  preset === p.id
                    ? "bg-white text-slate-900 border-white"
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500"
                }`}
              >
                {p.label}
              </button>
            ))}

            {preset === "custom" && (
              <div className="flex items-center gap-2 ml-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="px-3 py-2 rounded-xl bg-slate-800 text-white font-black text-xs flex items-center gap-2 border-2 border-slate-700">
                      <CalendarIcon className="w-4 h-4" />
                      {customFrom ? fmtDay(customFrom) : "DA"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700 pointer-events-auto" align="start">
                    <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <span className="text-slate-500 font-black">→</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="px-3 py-2 rounded-xl bg-slate-800 text-white font-black text-xs flex items-center gap-2 border-2 border-slate-700">
                      <CalendarIcon className="w-4 h-4" />
                      {customTo ? fmtDay(customTo) : "A"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-slate-900 border-slate-700 pointer-events-auto" align="start">
                    <Calendar mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {isSingleDay && (preset === "today" || preset === "yesterday") && (
                <>
                  <button
                    onClick={() => setSingleDayOffset((v) => v - 1)}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-white font-black border-2 border-slate-700"
                    title="Giorno precedente"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setSingleDayOffset((v) => v + 1)}
                    disabled={preset === "today" && singleDayOffset >= 0}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-white font-black border-2 border-slate-700 disabled:opacity-40"
                    title="Giorno successivo"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              )}
              <span className="px-3 py-2 rounded-xl bg-slate-800 text-amber-300 font-black text-xs uppercase border-2 border-slate-700">
                {rangeLabel}
              </span>
              {!isToday && (
                <span className="px-3 py-2 rounded-xl bg-orange-500/20 text-orange-300 font-black text-xs uppercase border-2 border-orange-500/40">
                  STORICO — Sola lettura
                </span>
              )}
            </div>
          </div>

          {/* TOTALI */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-emerald-600 p-6 rounded-3xl text-center">
              <div className="text-xs font-black uppercase opacity-80">Incasso Totale</div>
              <div className="text-5xl font-black mt-2">€{stats.today.toFixed(2)}</div>
              <div className="text-xs mt-2 opacity-80">{stats.count} ordini</div>
            </div>
            <div className="bg-amber-600 p-6 rounded-3xl text-center">
              <div className="text-xs font-black uppercase opacity-80">Contanti</div>
              <div className="text-4xl font-black mt-2">€{stats.cashT.toFixed(2)}</div>
            </div>
            <div className="bg-blue-600 p-6 rounded-3xl text-center">
              <div className="text-xs font-black uppercase opacity-80">POS / Carta</div>
              <div className="text-4xl font-black mt-2">€{stats.cardT.toFixed(2)}</div>
            </div>
            <div className="bg-slate-700 p-6 rounded-3xl text-center">
              <div className="text-xs font-black uppercase opacity-80">Non Pagato</div>
              <div className="text-4xl font-black mt-2">€{stats.unpaidT.toFixed(2)}</div>
            </div>
          </div>

          {/* LISTA STORICO */}
          <div className="bg-slate-900 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-black uppercase">Ordini nel periodo</h3>
              {loadingHistory && <span className="text-xs font-black text-slate-400 animate-pulse">CARICO…</span>}
            </div>
            {historyError && (
              <div className="bg-red-500/20 text-red-300 p-3 rounded-xl text-xs font-mono mb-3 break-words">
                {historyError}
              </div>
            )}
            {historyList.length === 0 && !loadingHistory ? (
              <div className="text-center py-12 text-slate-500 font-black uppercase">Nessun ordine nel periodo</div>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                {historyList.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xl font-black">#{getOrderNumber(o)}</span>
                      <span className="text-xs text-slate-400 font-mono">{getSafeDate(o).toLocaleString()}</span>
                      {(o.origine === "qr" || o.isMobile) ? (
                        <span className="bg-fuchsia-600 text-white px-2 py-0.5 rounded text-[10px] font-black">📱 MOBILE</span>
                      ) : (
                        <span className="bg-slate-600 text-white px-2 py-0.5 rounded text-[10px] font-black">🖥️ TOTEM</span>
                      )}
                      {isFailedPayment(o) ? (
                        <span className="bg-red-600 text-white px-2 py-0.5 rounded text-[10px] font-black">❌ FALLITO</span>
                      ) : isPendingPayment(o) ? (
                        <span className="bg-amber-500 text-black px-2 py-0.5 rounded text-[10px] font-black">⏳ IN ATTESA</span>
                      ) : isPaidCardOrder(o) ? (
                        <span className="bg-blue-500 text-white px-2 py-0.5 rounded text-[10px] font-black">POS</span>
                      ) : isPaidCashOrder(o) ? (
                        <span className="bg-amber-500 text-black px-2 py-0.5 rounded text-[10px] font-black">CONTANTI</span>
                      ) : (
                        <span className="bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-black">💶 DA INCASSARE</span>
                      )}
                    </div>
                    <span className="text-xl font-black">€{Number(o.total || 0).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-4">
          {/* LISTA ORDINI */}
          <div className="space-y-2 max-h-[80vh] overflow-y-auto pr-2">
            {displayOrders.length === 0 ? (
              <div className="text-center py-20 text-slate-500 font-black">NESSUN ORDINE ATTIVO</div>
            ) : (
              displayOrders
                .sort((a: any, b: any) => getSafeDate(b).getTime() - getSafeDate(a).getTime())
                .map((o: any) => (
                  <button
                    key={o.id}
                    onClick={() => {
                      setSelectedOrder(o.id);
                      setSelectedToPay([]);
                    }}
                    className={`w-full p-4 rounded-2xl border-4 text-left transition ${
                      selectedOrder === o.id
                        ? "bg-indigo-600 border-white"
                        : "bg-slate-800/40 border-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-black">#{getOrderNumber(o)}</span>
                      <span className="text-2xl font-black">€{Number(o.total || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(o.origine === "qr" || o.isMobile) ? (
                        <span className="bg-fuchsia-600 text-white px-2 py-1 rounded text-xs font-black">📱 MOBILE</span>
                      ) : (
                        <span className="bg-slate-600 text-white px-2 py-1 rounded text-xs font-black">🖥️ TOTEM</span>
                      )}
                      {o.paid ? (
                        <span className="bg-emerald-500 text-white px-2 py-1 rounded text-xs font-black">
                          ✔ PAGATO
                        </span>
                      ) : (
                        <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-black">
                          💶 DA INCASSARE
                        </span>
                      )}
                      {o.status === "ready" && (
                        <span className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-black">
                          PRONTO
                        </span>
                      )}
                      {o.syncError && (
                        <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-black">
                          ⚠️ SYNC ERROR
                        </span>
                      )}
                    </div>
                  </button>
                ))
            )}
          </div>

          {/* DETTAGLIO */}
          <div className="bg-slate-900 rounded-3xl p-6">
            {selected ? (
              <>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-4xl font-black">#{getOrderNumber(selected)}</div>
                      {(selected.origine === "qr" || selected.isMobile) ? (
                        <span className="bg-fuchsia-600 text-white px-2 py-1 rounded text-xs font-black uppercase">📱 ORDINE MOBILE / TAVOLO</span>
                      ) : (
                        <span className="bg-slate-600 text-white px-2 py-1 rounded text-xs font-black uppercase">🖥️ ORDINE TOTEM</span>
                      )}
                    </div>
                    <div className="text-sm text-slate-400 mt-1">
                      {getSafeDate(selected).toLocaleString()}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 uppercase font-black">
                      Origine: {(selected.origine === "qr" || selected.isMobile) ? "mobile / tavolo (QR)" : "totem cassa"}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {selected.syncError && (
                      <button
                        onClick={handleRecoverySumUp}
                        disabled={isActionLoading}
                        className="p-3 bg-orange-500 text-white rounded-xl font-black flex items-center gap-1"
                        title="Recovery SumUp"
                      >
                        <RefreshCw className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => setExtraModal({ orderId: selected.id })}
                      className="p-3 bg-white text-slate-900 rounded-xl font-black"
                      title="Aggiungi Extra"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => reprint(selected.id)}
                      className="p-3 bg-white text-slate-900 rounded-xl font-black"
                      title="Ristampa"
                    >
                      <Printer className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 mb-4 max-h-[50vh] overflow-y-auto pr-2">
                  {items.map((item: any, i: number) => (
                    <div
                      key={i}
                      onClick={() =>
                        !item.paid &&
                        setSelectedToPay((prev) =>
                          prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
                        )
                      }
                      className={`p-5 rounded-[2.5rem] border-4 border-slate-900 flex justify-between items-center transition ${
                        item.paid
                          ? "bg-emerald-50 text-slate-500 opacity-60"
                          : selectedToPay.includes(i)
                          ? "bg-indigo-100 border-indigo-600 text-slate-900 cursor-pointer shadow-[6px_6px_0px_#4f46e5]"
                          : "bg-white text-slate-900 cursor-pointer shadow-[6px_6px_0px_#0f172a] hover:translate-x-[1px] hover:translate-y-[1px]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {item.paid ? (
                          <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                        ) : selectedToPay.includes(i) ? (
                          <CheckSquare className="w-7 h-7 text-indigo-600" />
                        ) : (
                          <Square className="w-7 h-7 text-slate-400" />
                        )}
                        <span className="font-black text-xl uppercase">
                          {item.quantity}x {item.name}
                        </span>
                      </div>
                      <span className="font-black text-xl">
                        €{(Number(item.price) * Number(item.quantity)).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <div className="flex justify-between mb-3">
                    <span className="font-black text-xl text-amber-400">
                      RESTANTE: €{(Number(selected.total) - paidAmount).toFixed(2)}
                    </span>
                    <span className="font-black text-xl">
                      TOTALE: €{Number(selected.total).toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {selectedToPay.length > 0 && (
                      <button
                        onClick={handlePaySelected}
                        disabled={isActionLoading}
                        className="py-5 rounded-2xl bg-indigo-500 text-white font-black text-2xl uppercase active:scale-95"
                      >
                        INCASSA SELEZIONE ({selectedToPay.length})
                      </button>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handlePayAll}
                        disabled={isActionLoading || selected.paid}
                        className="py-5 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xl uppercase active:scale-95 disabled:opacity-50"
                      >
                        INCASSA TUTTO
                      </button>
                      <button
                        onClick={handleClose}
                        disabled={isActionLoading}
                        className="py-5 rounded-2xl bg-slate-700 text-white font-black text-xl uppercase active:scale-95"
                      >
                        CHIUDI CONTO
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-32 text-slate-500 font-black text-2xl">
                SELEZIONA UN ORDINE
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALE EXTRA */}
      {extraModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setExtraModal(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
              <Plus className="w-6 h-6" /> AGGIUNGI EXTRA
            </h2>
            <input
              type="text"
              placeholder="Nome (es. Coca-Cola)"
              value={extraName}
              onChange={(e) => setExtraName(e.target.value)}
              className="w-full p-3 border-2 border-slate-300 rounded-xl font-bold mb-3"
              autoFocus
            />
            <input
              type="number"
              step="0.10"
              placeholder="Prezzo €"
              value={extraPrice}
              onChange={(e) => setExtraPrice(e.target.value)}
              className="w-full p-3 border-2 border-slate-300 rounded-xl font-bold mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setExtraModal(null)}
                className="flex-1 py-3 bg-slate-200 rounded-xl font-black"
              >
                ANNULLA
              </button>
              <button
                onClick={submitExtra}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black"
              >
                AGGIUNGI
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CassaView;
