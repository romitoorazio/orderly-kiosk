import React, { useState, useEffect, useRef } from "react";
import { CheckCircle2, Volume2 } from "lucide-react";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useActiveOrders } from "@/hooks/useActiveOrders";
import { playReadySound, unlockReadySound } from "@/lib/readySound";
import { LOGO_URL } from "@/lib/constants";
import { BUSINESS } from "@/config/business";
import { getOrderNumber } from "@/lib/orderDisplay";

// Safe date parser
const toDate = (v: any) => {
  if (!v) return new Date();
  if (v.seconds) return new Date(v.seconds * 1000);
  if (typeof v.toDate === 'function') return v.toDate();
  if (typeof v === 'number' || typeof v === 'string') {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
};

type Preset = '0.75' | '0.85' | '1' | 'tv';

// Pre-tabulated font sizes per preset (no calc * clamp — Silk-safe)
const FONT_PRESETS: Record<Preset, {
  ready: string; prep: string; colTitle: string;
  header: string; clock: string; cardPad: string;
  weight: number;
}> = {
  '1':    { ready:'clamp(2rem,5.5vw,4.5rem)',   prep:'clamp(1.75rem,4.5vw,3.75rem)', colTitle:'clamp(1.1rem,2.5vw,1.875rem)', header:'clamp(1.25rem,2.8vw,2.25rem)', clock:'clamp(0.85rem,1.8vw,1.5rem)',   cardPad:'1rem',    weight:900 },
  '0.85': { ready:'clamp(1.7rem,4.7vw,3.8rem)', prep:'clamp(1.5rem,3.8vw,3.2rem)',   colTitle:'clamp(0.95rem,2.1vw,1.6rem)',  header:'clamp(1.05rem,2.4vw,1.9rem)',  clock:'clamp(0.75rem,1.5vw,1.3rem)',   cardPad:'0.85rem', weight:900 },
  '0.75': { ready:'clamp(1.5rem,4.1vw,3.4rem)', prep:'clamp(1.3rem,3.4vw,2.8rem)',   colTitle:'clamp(0.85rem,1.9vw,1.4rem)',  header:'clamp(0.95rem,2.1vw,1.7rem)',  clock:'clamp(0.65rem,1.35vw,1.15rem)', cardPad:'0.75rem', weight:900 },
  'tv':   { ready:'clamp(1.5rem,4.1vw,3.4rem)', prep:'clamp(1.3rem,3.4vw,2.8rem)',   colTitle:'clamp(0.85rem,1.9vw,1.4rem)',  header:'clamp(0.95rem,2.1vw,1.7rem)',  clock:'clamp(0.65rem,1.35vw,1.15rem)', cardPad:'0.75rem', weight:800 },
};

const PRESET_KEY = 'salaTv.preset';

const MonitorSala: React.FC = () => {
  const { user } = useFirebaseAuth();
  // 🔥 Solo ordini in lavorazione/pronti, max 50 — niente listener su intera collection.
  const orders = useActiveOrders(user, { statuses: ['in_preparation', 'ready'], limit: 50 });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [logoFailed, setLogoFailed] = useState(false);
  const [preset, setPreset] = useState<Preset>(() => {
    try {
      const v = localStorage.getItem(PRESET_KEY);
      if (v === '0.75' || v === '0.85' || v === '1' || v === 'tv') return v;
    } catch {}
    return '0.85';
  });

  const F = FONT_PRESETS[preset];

  const updatePreset = (p: Preset) => {
    setPreset(p);
    try { localStorage.setItem(PRESET_KEY, p); } catch {}
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 🔔 Audio overlay + anti-spam ready sound (SOLO Sala TV)
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const playedReadyIds = useRef<Set<string>>(new Set());
  const didMountRef = useRef(false);

  const handleUnlockAudio = async () => {
    await unlockReadySound();
    setAudioUnlocked(true);
  };

  useEffect(() => {
    const currentReadyIds = new Set(
      orders.filter((o: any) => o.status === "ready").map((o: any) => o.id as string)
    );

    if (!didMountRef.current) {
      // Primo snapshot: NON suonare, registra solo gli id già pronti
      currentReadyIds.forEach((id) => playedReadyIds.current.add(id));
      didMountRef.current = true;
      return;
    }

    // Cleanup: id non più tra gli active orders → rimuovi dal set
    playedReadyIds.current.forEach((id) => {
      if (!currentReadyIds.has(id)) playedReadyIds.current.delete(id);
    });

    // Suona per ogni transizione reale → ready
    currentReadyIds.forEach((id) => {
      if (!playedReadyIds.current.has(id)) {
        playedReadyIds.current.add(id);
        playReadySound();
      }
    });
  }, [orders]);

  const activeOrders = orders.filter((o) =>
    ["in_preparation", "ready"].includes(o.status)
  );

  const preparingOrders = activeOrders
    .filter((o) => o.status === "in_preparation")
    .sort((a, b) => toDate(a.timestamp).getTime() - toDate(b.timestamp).getTime());

  const readyOrders = activeOrders
    .filter((o) => o.status === "ready")
    .sort((a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime());

  const logoWrapperStyle: React.CSSProperties = {
    width: 'clamp(32px, 4vw, 60px)',
    height: 'clamp(32px, 4vw, 60px)',
    aspectRatio: '1 / 1',
  };

  const presetBtn = (p: Preset, label: string) => (
    <button
      key={p}
      onClick={() => updatePreset(p)}
      className={`px-2 py-1 rounded font-black text-[10px] uppercase border-2 ${
        preset === p
          ? 'bg-amber-500 text-black border-amber-300'
          : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="h-screen bg-slate-950 flex flex-col font-sans uppercase overflow-hidden text-white select-none box-border p-2 relative">

      {/* 🔔 Overlay sblocco audio (solo al primo accesso) */}
      {!audioUnlocked && (
        <button
          onClick={handleUnlockAudio}
          className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center gap-6 text-white"
        >
          <Volume2 className="w-32 h-32 text-amber-400 animate-pulse" />
          <div className="text-5xl font-black tracking-wider">TOCCA PER ATTIVARE AUDIO</div>
          <div className="text-xl text-slate-400 font-bold">Necessario per le notifiche degli ordini pronti</div>
        </button>
      )}

      {/* HEADER */}
      <div className="bg-black border-b-8 border-amber-500 p-6 flex items-center justify-between shrink-0 shadow-2xl z-10">
        <div className="flex items-center gap-4">
          <div
            style={logoWrapperStyle}
            className="shrink-0 flex items-center justify-center"
            aria-hidden="true"
          >
            {!logoFailed && (
              <img
                src={LOGO_URL}
                alt={`Logo ${BUSINESS.name}`}
                width={60}
                height={60}
                loading="eager"
                decoding="sync"
                onError={() => setLogoFailed(true)}
                className="w-full h-full object-contain rounded-full"
              />
            )}
          </div>
          <h1
            className="italic tracking-tighter text-white"
            style={{ fontSize: F.header, fontWeight: F.weight }}
          >
            STATO ORDINI
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {presetBtn('0.75', '0.75×')}
            {presetBtn('0.85', '0.85×')}
            {presetBtn('1', '1×')}
            {presetBtn('tv', 'TV')}
          </div>
          <div
            className="text-slate-400"
            style={{ fontSize: F.clock, fontWeight: F.weight }}
          >
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT - TWO COLUMNS */}
      <div className="flex-1 flex overflow-hidden">

        {/* COLUMN 1: IN PREPARATION */}
        <div className="flex-1 flex flex-col border-r-4 border-slate-800 bg-[#0f172a]">
          <div className="bg-slate-900 py-6 text-center border-b-4 border-slate-800 shadow-md z-10">
            <h2
              className="text-amber-500 italic tracking-widest"
              style={{ fontSize: F.colTitle, fontWeight: F.weight }}
            >
              IN PREPARAZIONE
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
              {preparingOrders.length === 0 ? (
                <div className="col-span-full text-center text-slate-600 font-black text-2xl mt-10 italic opacity-50">
                  NESSUN ORDINE IN CODA
                </div>
              ) : (
                preparingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-slate-800 rounded-[2rem] flex items-center justify-center border-4 border-slate-700 shadow-lg animate-in fade-in zoom-in duration-300"
                    style={{ padding: F.cardPad }}
                  >
                    <span
                      className="text-white italic tracking-tighter"
                      style={{ fontSize: F.prep, fontWeight: F.weight }}
                    >
                      #{getOrderNumber(order)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 2: READY */}
        <div className="flex-1 flex flex-col bg-slate-900">
          <div className="bg-emerald-900 py-6 text-center border-b-4 border-emerald-800 shadow-md z-10">
            <h2
              className="text-emerald-400 italic tracking-widest flex items-center justify-center gap-3"
              style={{ fontSize: F.colTitle, fontWeight: F.weight }}
            >
              <CheckCircle2 size={40} /> PRONTI AL RITIRO
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-8">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
              {readyOrders.length === 0 ? (
                <div className="col-span-full text-center text-slate-700 font-black text-2xl mt-10 italic opacity-50">
                  NESSUN ORDINE PRONTO
                </div>
              ) : (
                readyOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-emerald-500 rounded-[2rem] flex items-center justify-center border-[6px] border-emerald-300 shadow-[0_0_60px_rgba(16,185,129,0.7)] animate-bounce-ready"
                    style={{ padding: F.cardPad }}
                  >
                    <span
                      className="text-white italic tracking-tighter drop-shadow-lg"
                      style={{ fontSize: F.ready, fontWeight: F.weight }}
                    >
                      #{getOrderNumber(order)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {/* FOOTER TICKER */}
      <div className="bg-black py-3 px-6 text-center text-slate-500 font-bold tracking-widest text-sm border-t-2 border-slate-800">
        {BUSINESS.name.toUpperCase()} {BUSINESS.tagline.toUpperCase()} - SEGUI IL TUO NUMERO SULLO SCHERMO
      </div>

    </div>
  );
};

export default MonitorSala;