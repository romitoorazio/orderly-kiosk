import React, { useState, useRef, useEffect } from "react";
import { Plus, Edit3, X, Smartphone, CheckCircle2, Printer, StickyNote, Maximize2, Minimize2 } from "lucide-react";
import OfflineBanner from "@/components/totem/OfflineBanner";
import { doc, updateDoc } from "firebase/firestore";
import { db, APP_ID } from "@/lib/firebase";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useFirestoreData } from "@/hooks/useFirestoreData";
import { useActiveOrders } from "@/hooks/useActiveOrders";
import { releaseBeeper, reconcileBeeperPool } from "@/lib/beeperPool";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { getOrderNumber, getReleaseNumberForOrder } from "@/lib/orderDisplay";

const toDate = (v: any) => {
  if (!v) return new Date();
  if (v.seconds) return new Date(v.seconds * 1000);
  if (typeof v.toDate === "function") return v.toDate();
  if (typeof v === "number" || typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
};

const KitchenDisplay: React.FC = () => {
  const { user } = useFirebaseAuth();
  const data = useFirestoreData(user);
  const { flags } = useFeatureFlags();
  const fetchOrdersInRange = data?.fetchOrdersInRange;
  const [tab, setTab] = useState<"attive" | "archivio">("attive");

  // 🔥 Listener live SOLO su ordini attivi (status in [...] + limit 100)
  const activeOrders = useActiveOrders(user);

  // 🧹 Reconcile beeperPool al mount (pulisce fantasmi al primo accesso del personale)
  useEffect(() => {
    if (!user) return;
    reconcileBeeperPool(flags.beepers);
  }, [user, flags.beepers]);
  // 🗄️ Archivio: query on-demand limitata a oggi (no listener live)
  const [archiveOrders, setArchiveOrders] = useState<any[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(false);

  useEffect(() => {
    if (tab !== "archivio" || !fetchOrdersInRange) return;
    let cancelled = false;
    setLoadingArchive(true);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).getTime();
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    fetchOrdersInRange(start, end)
      .then((list) => { if (!cancelled) setArchiveOrders(list); })
      .catch(() => { if (!cancelled) setArchiveOrders([]); })
      .finally(() => { if (!cancelled) setLoadingArchive(false); });
    return () => { cancelled = true; };
  }, [tab, fetchOrdersInRange]);

  const orders = tab === "attive" ? activeOrders : archiveOrders;
  const [extraModal, setExtraModal] = useState<{ orderId: string } | null>(null);
  const [extraName, setExtraName] = useState("");
  const [extraPrice, setExtraPrice] = useState("");
  const [noteModal, setNoteModal] = useState<{ orderId: string; current: string } | null>(null);
  const [noteText, setNoteText] = useState("");
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const fsEl =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        null;
      setIsFullscreen(Boolean(fsEl));
    };
    document.addEventListener("fullscreenchange", onChange);
    document.addEventListener("webkitfullscreenchange", onChange as any);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      document.removeEventListener("webkitfullscreenchange", onChange as any);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      const fsEl =
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement;
      if (!fsEl) {
        const el: any = document.documentElement;
        if (el.requestFullscreen) await el.requestFullscreen();
        else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      } else {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen();
      }
    } catch (e) {
      console.warn("[Kitchen] fullscreen toggle failed", e);
    }
  };

  const displayOrders = (orders || []).filter((o: any) => {
    // 🛡️ Nascondi placeholder card pre-conferma (paymentStatus pending + number "...")
    if (o?.paymentStatus === "pending" && (!o?.number || o?.number === "...")) return false;
    return tab === "attive"
      ? ["pending", "unconfirmed", "in_preparation", "ready"].includes(o.status)
      : ["delivered", "closed", "cancelled"].includes(o.status);
  });

  const refOrder = (id: string) => doc(db, "artifacts", APP_ID, "public", "data", "orders", id);

  const changeStatus = async (id: string, status: string) => {
    await updateDoc(refOrder(id), { status });
    // 🔓 Rilascia beeper secondo config Admin (ready/delivered) o su cancellazione.
    const shouldRelease = status === "cancelled" || status === flags.beepers.releaseOn;
    if (shouldRelease) {
      const order = (orders || []).find((o: any) => o.id === id);
      const releaseNumber = getReleaseNumberForOrder(order, flags.beepers);
      if (releaseNumber !== null) await releaseBeeper(releaseNumber, flags.beepers);
    }
  };

  const reprint = async (id: string) => {
    try {
      await updateDoc(refOrder(id), { printSignal: Date.now() });
    } catch (e) {
      console.error("[Kitchen] reprint failed", e);
    }
  };

  const cancelOrder = (id: string) => {
    if (window.confirm("Cancellare definitivamente questo ordine?")) {
      changeStatus(id, "cancelled");
    }
  };

  const startLongPress = (id: string) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => cancelOrder(id), 1000);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const submitExtra = async () => {
    if (!extraModal) return;
    const order = orders.find((o: any) => o.id === extraModal.orderId);
    if (!order) return;
    const price = parseFloat(extraPrice);
    if (!extraName.trim() || isNaN(price)) return;
    const newItem = { name: extraName.trim(), price, quantity: 1, isExtra: true };
    const newItems = [...(order.items || []), newItem];
    const newTotal = newItems.reduce((s: number, i: any) => s + Number(i.price) * Number(i.quantity), 0);
    await updateDoc(refOrder(order.id), { items: newItems, total: newTotal });
    setExtraModal(null);
    setExtraName("");
    setExtraPrice("");
  };

  const submitNote = async () => {
    if (!noteModal) return;
    await updateDoc(refOrder(noteModal.orderId), { kitchenNote: noteText });
    setNoteModal(null);
    setNoteText("");
  };

  return (
    <div className="h-screen w-screen overflow-y-auto overflow-x-hidden bg-slate-100 text-slate-900 p-3">
      <OfflineBanner mode="banner" />

      <div className="sticky top-0 z-20 flex items-center justify-between bg-slate-900 text-white rounded-xl px-3 py-2 mb-3 shadow-md">
        <a href="/hub" className="px-2 py-1 bg-slate-700 text-white rounded-md font-black text-xs">
          ← HUB
        </a>
        <h1 className="text-xl font-black">🍳 ORDINI CUCINA</h1>
        <div className="flex gap-1.5 items-center">
          <button
            onClick={toggleFullscreen}
            className="px-3 py-1.5 rounded-lg font-black text-sm bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-1"
            title={isFullscreen ? "Esci da schermo intero" : "Schermo intero"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            <span className="hidden sm:inline">{isFullscreen ? "ESCI" : "FULL"}</span>
          </button>
          <button
            onClick={() => setTab("attive")}
            className={`px-4 py-1.5 rounded-lg font-black text-sm ${
              tab === "attive" ? "bg-white text-black" : "bg-slate-800 text-slate-500"
            }`}
          >
            ATTIVE
          </button>
          <button
            onClick={() => setTab("archivio")}
            className={`px-4 py-1.5 rounded-lg font-black text-sm ${
              tab === "archivio" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-500"
            }`}
          >
            STORICO
          </button>
        </div>
      </div>

      {displayOrders.length === 0 ? (
        <div className="text-center py-32 text-slate-400 font-black text-3xl">NESSUN ORDINE</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {displayOrders
            .sort((a: any, b: any) => Number(a.clientTimestamp || 0) - Number(b.clientTimestamp || 0))
            .map((order: any) => {
              const piPaid = order.items?.filter((i: any) => i.paid).length || 0;
              const piTotal = order.items?.length || 0;
              const isPart = !order.paid && piPaid > 0 && piPaid < piTotal;
              const isMobile = order.origine === "qr" || order.isMobile;
              const isArchive = ["delivered", "closed", "cancelled"].includes(order.status);

              const orderTime = toDate(order.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

              return (
                <div
                  key={order.id}
                  className={`relative rounded-xl shadow-md flex flex-col overflow-hidden ${
                    isMobile
                      ? "bg-fuchsia-100 border-[6px] border-fuchsia-600 text-slate-900 ring-4 ring-fuchsia-300"
                      : "bg-white border-2 border-slate-300 text-slate-900"
                  } ${!order.paid && !isArchive ? "ring-2 ring-red-500/60" : ""}`}
                >
                  {isMobile && (
                    <div className="px-3 py-2 bg-fuchsia-600 text-white flex items-center justify-center gap-2 font-black text-lg uppercase tracking-wider shadow-md">
                      <Smartphone className="w-6 h-6" /> 📱 ORDINE DA TAVOLO 📱
                    </div>
                  )}
                  <div className="p-3 flex flex-col gap-2 relative">
                  {!isArchive && (
                    <button
                      onMouseDown={() => startLongPress(order.id)}
                      onMouseUp={cancelLongPress}
                      onMouseLeave={cancelLongPress}
                      onTouchStart={() => startLongPress(order.id)}
                      onTouchEnd={cancelLongPress}
                      className="absolute top-2 right-2 w-7 h-7 rounded-md bg-red-100 hover:bg-red-200 text-red-700 flex items-center justify-center"
                      title="Tieni premuto 1s per cancellare"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}

                  {/* Header compatto */}
                  <div className="flex justify-between items-baseline pr-9">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-3xl font-black leading-none">#{getOrderNumber(order)}</span>
                      <span className="text-sm font-mono text-slate-500">{orderTime}</span>
                      {isMobile && (
                        <span className="bg-fuchsia-600 text-white px-1.5 py-0.5 rounded text-[10px] font-black">📱 MOBILE</span>
                      )}
                      {order.paid ? (
                        <span className="bg-emerald-500 text-white px-1.5 py-0.5 rounded text-[10px] font-black">✔ PAGATO</span>
                      ) : isPart ? (
                        <span className="bg-orange-500 text-white px-1.5 py-0.5 rounded text-[10px] font-black">
                          PARZ {piPaid}/{piTotal}
                        </span>
                      ) : order.paymentStatus === "pending" ? (
                        <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded text-[10px] font-black animate-pulse">⏳ POS</span>
                      ) : (
                        <span className="bg-amber-500 text-black px-1.5 py-0.5 rounded text-[10px] font-black">💶 CONT</span>
                      )}
                    </div>
                    <span className="text-xl font-black">€{Number(order.total || 0).toFixed(2)}</span>
                  </div>

                  {/* Lista scontrino */}
                  <div className="border-t border-dashed border-slate-400 pt-2 font-mono">
                    {order.items?.map((item: any, idx: number) => (
                      <div key={idx} className="text-base font-bold leading-snug">
                        <div className="flex justify-between gap-2">
                          <span className="flex-1 uppercase">
                            {item.quantity}  {item.name}
                            {item.paid && " ✓"}
                            {item.isExtra && " [EX]"}
                          </span>
                          <span>{(Number(item.price) * Number(item.quantity)).toFixed(2)}</span>
                        </div>
                        {item.customization?.length > 0 && (
                          <div className="pl-6">
                            {item.customization.map((c: string, ci: number) => (
                              <div key={ci} className="uppercase">+ {c}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {order.kitchenNote && (
                    <div className="bg-yellow-200 border border-yellow-500 px-2 py-1 rounded text-base font-mono font-bold text-slate-900 uppercase">
                      ** NOTA: {order.kitchenNote} **
                    </div>
                  )}

                  <div className="border-t border-dashed border-slate-400 pt-1 flex justify-between font-mono text-base font-black">
                    <span>TOTALE</span>
                    <span>€{Number(order.total || 0).toFixed(2)}</span>
                  </div>

                  {!isArchive && (
                    <>
                      <div className="grid grid-cols-3 gap-1">
                        <button
                          onClick={() => setExtraModal({ orderId: order.id })}
                          className="py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-black text-[11px] flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> EXTRA
                        </button>
                        <button
                          onClick={() => {
                            setNoteText(order.kitchenNote || "");
                            setNoteModal({ orderId: order.id, current: order.kitchenNote || "" });
                          }}
                          className="py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-black text-[11px] flex items-center justify-center gap-1"
                        >
                          <StickyNote className="w-3 h-3" /> NOTA
                        </button>
                        <button
                          onClick={() => reprint(order.id)}
                          className="py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-white font-black text-[11px] flex items-center justify-center gap-1"
                        >
                          <Printer className="w-3 h-3" /> STAMPA
                        </button>
                      </div>

                      {order.status === "unconfirmed" ? (
                        <button
                          onClick={() => changeStatus(order.id, "in_preparation")}
                          className="w-full py-3 rounded-xl font-black text-base bg-amber-500 hover:bg-amber-600 text-black uppercase active:scale-95"
                        >
                          CONFERMA E PREPARA
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            changeStatus(order.id, order.status === "ready" ? "delivered" : "ready")
                          }
                          className={`w-full py-3 rounded-xl font-black text-base text-white active:scale-95 uppercase ${
                            order.status === "ready"
                              ? "bg-blue-600 hover:bg-blue-700"
                              : "bg-emerald-500 hover:bg-emerald-600"
                          }`}
                        >
                          {order.status === "ready" ? "CONSEGNA" : "PRONTO ✓"}
                        </button>
                      )}
                    </>
                  )}

                  {isArchive && (
                    <div className="text-center py-2 bg-slate-200 text-slate-500 rounded-md font-black uppercase text-xs">
                      {order.status}
                    </div>
                  )}
                  </div>
                </div>
              );
            })}
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

      {/* MODALE NOTA */}
      {noteModal && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setNoteModal(null)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-md text-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-black mb-4 flex items-center gap-2">
              <StickyNote className="w-6 h-6" /> NOTA CUCINA
            </h2>
            <textarea
              placeholder="Es. Senza cipolla, ben cotta..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="w-full p-3 border-2 border-slate-300 rounded-xl font-bold mb-4 min-h-[120px]"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => setNoteModal(null)}
                className="flex-1 py-3 bg-slate-200 rounded-xl font-black"
              >
                ANNULLA
              </button>
              <button
                onClick={submitNote}
                className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-black"
              >
                SALVA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitchenDisplay;
