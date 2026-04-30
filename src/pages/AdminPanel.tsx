import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Save,
  ToggleLeft,
  ToggleRight,
  Eye,
  EyeOff,
  Download,
  Gamepad2,
  Search,
  CreditCard,
  History,
  BarChart3,
  X,
  Zap,
} from "lucide-react";
import { collection, doc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, waitForPendingWrites } from "firebase/firestore";
import { db, APP_ID } from "@/lib/firebase";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useFirestoreData } from "@/hooks/useFirestoreData";
import { useActiveOrders } from "@/hooks/useActiveOrders";
import { useArchiveCollections } from "@/hooks/useArchiveCollections";
import { ICON_MAP } from "@/lib/constants";
import { resolveBackendUrl } from "@/lib/constants";
import type { Department, MenuItem, Ingredient } from "@/lib/constants";
import ImageUploadField from "@/components/admin/ImageUploadField";
import BusinessSettingsTab from "@/components/admin/BusinessSettingsTab";
import ModulesTab from "@/components/admin/ModulesTab";
import PrinterSettingsTab from "@/components/admin/PrinterSettingsTab";
import WaiterSettingsTab from "@/components/admin/WaiterSettingsTab";
import { useFeatureFlags, saveFeatureFlags } from "@/hooks/useFeatureFlags";
import { createBeeperStatusForRange } from "@/lib/beeperConfig";

const COLORS_LIST = [
  "bg-amber-500",
  "bg-red-600",
  "bg-orange-600",
  "bg-blue-600",
  "bg-red-800",
  "bg-pink-600",
  "bg-emerald-600",
  "bg-purple-600",
  "bg-indigo-600",
  "bg-teal-600",
  "bg-slate-800",
] as const;

const ICON_NAMES = Object.keys(ICON_MAP);

const col = (name: string) => collection(db, "artifacts", APP_ID, "public", "data", name);
const dataDoc = (collectionName: string, id: string) =>
  doc(db, "artifacts", APP_ID, "public", "data", collectionName, id);
const settingsDoc = (id: string) => doc(db, "artifacts", APP_ID, "public", "data", "settings", id);

type AdminTab =
  | "moduli"
  | "menu"
  | "reparti"
  | "ingredienti"
  | "promo"
  | "beeper"
  | "pagamenti"
  | "sicurezza"
  | "stampante"
  | "cameriere"
  | "ruota"
  | "scatola_nera"
  | "marketing"
  | "brand";

type PromoConfig = { active?: boolean; productId?: string; price?: number; message?: string };
type PaymentSettings = { sumupActive?: boolean; backendUrl?: string };
type WheelPrize = { name: string; weight: number; stock?: number };
type WheelSettings = { active?: boolean; gameType?: string; prizes?: WheelPrize[] };

const toDateValue = (value: unknown): Date => {
  if (!value) return new Date();
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return new Date(value as string | number | Date);
};

// ============================================================
// 🆕 SCATOLA NERA — Card record con diagnostica SumUp v1
// ============================================================
const phaseColor = (phase?: string): string => {
  switch (String(phase || '').toLowerCase()) {
    case 'create': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    case 'link_reader': return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'poll': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    case 'reader_check': return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
    case 'parse': return 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30';
    case 'exception': return 'bg-red-500/20 text-red-300 border-red-500/30';
    default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
  }
};

const RawBlock: React.FC<{ label: string; value: any }> = ({ label, value }) => {
  if (value === undefined || value === null) return null;
  const truncated = typeof value === 'object' && value && (value as any)._truncated === true;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">{label}</span>
        {truncated && (
          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-black tracking-widest">
            TRUNCATED · {(value as any)._size ?? '?'}b
          </span>
        )}
      </div>
      <pre className="bg-slate-950 text-slate-300 text-[10px] font-mono p-3 rounded-xl overflow-x-auto max-h-64 border border-slate-800">
        {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
};

const PosRecordCard: React.FC<{ record: any }> = ({ record }) => {
  const [showRaw, setShowRaw] = useState(false);
  const isOk = ["SUCCESSFUL", "PAID", "SUCCESS"].includes(String(record.status).toUpperCase());
  const hasDiag = !!(record.phase || record.failure_reason || record.checkoutId || record.attemptId);
  const phases: any[] = Array.isArray(record.phases) ? record.phases : [];

  return (
    <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
      {/* === BLOCCO ESISTENTE (invariato) === */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <span className="text-3xl font-black text-white">
            €{Number(record.amount || 0).toFixed(2)}
          </span>
          <span
            className={`px-4 py-1 rounded-full text-[10px] font-black tracking-widest ${isOk ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}
          >
            {String(record.status || "").toUpperCase()}
          </span>
        </div>
        <span className="text-xs font-bold text-slate-500">
          {(() => {
            const v = record.orazio_timestamp;
            const d = !v ? new Date() : (typeof v === 'object' && v && 'toDate' in v && typeof (v as any).toDate === 'function')
              ? (v as any).toDate()
              : new Date(v as any);
            return d.toLocaleString();
          })()}
        </span>
      </div>
      <p className="text-slate-500 text-[10px] font-mono uppercase">
        TX ID: {record.transaction_id || record.id} | ORDINE REF: {record.orderDocId || "N/A"}
      </p>

      {/* === SEZIONE DIAGNOSTICA SUMUP === */}
      {hasDiag && (
        <div className="mt-5 pt-5 border-t border-slate-700/60 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">
              Diagnostica SumUp
            </span>
            {record.phase && (
              <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${phaseColor(record.phase)}`}>
                {String(record.phase).toUpperCase()}
              </span>
            )}
          </div>

          {/* Timeline phases[] */}
          {phases.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-black tracking-widest uppercase text-slate-400">Timeline</div>
              <div className="flex flex-wrap gap-1.5">
                {phases.map((p, i) => (
                  <div
                    key={i}
                    className={`px-2 py-1 rounded-lg text-[9px] font-mono border ${phaseColor(p.phase)}`}
                    title={p.timestamp ? new Date(p.timestamp).toLocaleString() : ''}
                  >
                    {String(p.phase || '?').toUpperCase()} · HTTP {p.http_status ?? '?'} · {String(p.status || '?')}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grid campi compatti */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-mono text-slate-300">
            {record.checkoutId && <div><span className="text-slate-500">CHECKOUT ID:</span> {record.checkoutId}</div>}
            {record.attemptId && <div><span className="text-slate-500">ATTEMPT ID:</span> {record.attemptId}</div>}
            {record.solo_id && <div><span className="text-slate-500">SOLO ID:</span> {record.solo_id}</div>}
            {record.reader_status && <div><span className="text-slate-500">READER:</span> {record.reader_status}</div>}
            {record.failure_reason && <div className="col-span-2 text-red-300"><span className="text-slate-500">FAIL REASON:</span> {record.failure_reason}</div>}
            {record.failure_error_code && <div><span className="text-slate-500">ERROR CODE:</span> {record.failure_error_code}</div>}
            {record.failure_detail && <div className="col-span-2"><span className="text-slate-500">DETAIL:</span> {String(record.failure_detail)}</div>}
            {record.transaction_code && <div><span className="text-slate-500">TX CODE:</span> {record.transaction_code}</div>}
            <div className="col-span-2 flex flex-wrap gap-3 mt-1 text-slate-400">
              {record.create_http_status != null && <span>create: <span className="text-slate-200">{record.create_http_status}</span></span>}
              {record.link_http_status != null && <span>link: <span className="text-slate-200">{record.link_http_status}</span></span>}
              {record.poll_http_status != null && <span>poll: <span className="text-slate-200">{record.poll_http_status}</span></span>}
              {record.reader_http_status != null && <span>reader: <span className="text-slate-200">{record.reader_http_status}</span></span>}
            </div>
          </div>

          {/* Toggle raw */}
          <div>
            <button
              type="button"
              onClick={() => setShowRaw(v => !v)}
              className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-[10px] font-black tracking-widest uppercase"
            >
              {showRaw ? 'Nascondi payload raw' : 'Mostra payload raw'}
            </button>
          </div>

          {showRaw && (
            <div className="space-y-3">
              <RawBlock label="create_payload" value={record.create_payload} />
              <RawBlock label="link_request" value={record.link_request} />
              <RawBlock label="link_payload" value={record.link_payload} />
              <RawBlock label="poll_payload" value={record.poll_payload} />
              <RawBlock label="reader_payload" value={record.reader_payload} />
              <RawBlock label="exception_message" value={record.exception_message} />
              <RawBlock label="exception_stack" value={record.exception_stack} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const AdminPanel: React.FC = () => {
  const { user, loading: authLoading } = useFirebaseAuth();
  const baseData = useFirestoreData(user);
  // 🔥 Listener mirati: ordini attivi + collections archivio (solo admin).
  const activeOrders = useActiveOrders(user);
  const { leads, posRecords } = useArchiveCollections(user);
  const data = baseData ? { ...baseData, orders: activeOrders, leads, posRecords } : baseData;
  const { flags } = useFeatureFlags();

  const [tab, setTab] = useState<AdminTab>("menu");
  const [editingDept, setEditingDept] = useState<Partial<Department> | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<MenuItem> | null>(null);
  const [editingIng, setEditingIng] = useState<Partial<Ingredient> | null>(null);

  const [searchProd, setSearchProd] = useState("");
  const [filterDept, setFilterDept] = useState("ALL");
  const [searchIng, setSearchIng] = useState("");
  const [filterCatIng, setFilterCatIng] = useState("ALL");
  const [newPin, setNewPin] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [promoDraft, setPromoDraft] = useState<PromoConfig>({});
  const [paymentDraft, setPaymentDraft] = useState<PaymentSettings>({});
  const [wheelDraft, setWheelDraft] = useState<WheelSettings>({});

  useEffect(() => {
    setPromoDraft(data.promoConfig || {});
  }, [data.promoConfig]);
  useEffect(() => {
    setPaymentDraft(data.paymentSettings || {});
  }, [data.paymentSettings]);
  useEffect(() => {
    setWheelDraft(data.wheelSettings || {});
  }, [data.wheelSettings]);

  const waitForFirebaseSync = async () => {
    await Promise.race([
      waitForPendingWrites(db),
      new Promise((_, reject) =>
        window.setTimeout(
          () => reject(new Error("Firebase non ha confermato la sincronizzazione entro 5 secondi.")),
          5000,
        ),
      ),
    ]);
  };

  const runFirebaseWrite = async (write: () => Promise<unknown>, successMessage?: string) => {
    if (authLoading) {
      alert("Attendi un secondo: Firebase sta completando l'accesso anonimo.");
      return false;
    }
    if (!user) {
      alert("Firebase non è autenticato: impossibile salvare. Controlla che l'accesso anonimo sia attivo nel progetto Firebase.");
      return false;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      alert("Sei offline: non posso sincronizzare con Firebase adesso.");
      return false;
    }

    try {
      await write();
      await waitForFirebaseSync();
      if (successMessage) alert(successMessage);
      return true;
    } catch (error: any) {
      console.error("[Admin Firebase write failed]", error);
      const code = error?.code ? ` (${error.code})` : "";
      const message = error?.message ? `\n\n${error.message}` : "";
      alert(`Errore durante il salvataggio su Firebase${code}.${message}`);
      return false;
    }
  };

  // === SALVATAGGI ===
  const saveDept = async () => {
    if (!editingDept?.name?.trim()) {
      alert("Inserisci un nome per il reparto.");
      return;
    }
    setIsSaving(true);
    try {
      const deptData = {
        name: editingDept.name.trim(),
        iconName: editingDept.iconName || "Utensils",
        color: editingDept.color || "bg-amber-500",
        imageUrl: editingDept.imageUrl || "",
        sortOrder: Number(editingDept.sortOrder) || 0,
        available: editingDept.available !== false,
        updatedAt: serverTimestamp(),
      };
      const ok = await runFirebaseWrite(async () => {
        if (editingDept.id) await updateDoc(dataDoc("departments", editingDept.id), deptData);
        else await addDoc(col("departments"), { ...deptData, createdAt: serverTimestamp() });
      }, "Reparto salvato e sincronizzato con Firebase!");
      if (ok) setEditingDept(null);
    } catch (error) {
      console.error(error);
      alert("Errore durante il salvataggio.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDept = async (id: string) => {
    if (!window.confirm("Eliminare definitivamente questo reparto?")) return;
    try {
      await runFirebaseWrite(() => deleteDoc(dataDoc("departments", id)), "Reparto eliminato e Firebase sincronizzato.");
    } catch (error) {
      console.error(error);
      alert("Errore durante l'eliminazione.");
    }
  };

  const saveItem = async () => {
    if (!editingItem?.name?.trim()) {
      alert("Inserisci un nome per il prodotto.");
      return;
    }
    setIsSaving(true);
    try {
      const itemData = {
        name: editingItem.name.trim(),
        price: Number(editingItem.price) || 0,
        departmentId: editingItem.departmentId || "",
        department: editingItem.departmentId || "",
        imageUrl: editingItem.imageUrl || "",
        description: editingItem.description || "",
        defaultIngredients: editingItem.defaultIngredients || [],
        available: editingItem.available !== false,
        sortOrder: Number(editingItem.sortOrder) || 0,
        formats: editingItem.formats || [],
        contpiattoDeptId: (editingItem as MenuItem & { contpiattoDeptId?: string }).contpiattoDeptId || "",
        isBaseProduct: editingItem.isBaseProduct || false,
        isSpecial: editingItem.isSpecial || false,
        requiresCottura: (editingItem as MenuItem & { requiresCottura?: boolean }).requiresCottura || false,
        updatedAt: serverTimestamp(),
      };
      const ok = await runFirebaseWrite(async () => {
        if (editingItem.id) await updateDoc(dataDoc("menu_items", editingItem.id), itemData);
        else await addDoc(col("menu_items"), { ...itemData, createdAt: serverTimestamp() });
      }, "Prodotto salvato e sincronizzato con Firebase!");
      if (ok) setEditingItem(null);
    } catch (error) {
      console.error(error);
      alert("Errore durante il salvataggio.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteItem = async (id: string) => {
    if (!window.confirm("Eliminare questo prodotto?")) return;
    try {
      await runFirebaseWrite(() => deleteDoc(dataDoc("menu_items", id)), "Prodotto eliminato e Firebase sincronizzato.");
    } catch (error) {
      console.error(error);
      alert("Errore durante l'eliminazione.");
    }
  };

  const saveIng = async () => {
    if (!editingIng?.name?.trim()) {
      alert("Inserisci un nome per l'ingrediente.");
      return;
    }
    setIsSaving(true);
    try {
      const ingData = {
        name: editingIng.name.trim(),
        category: editingIng.category || "",
        extraPrice: Number(editingIng.extraPrice) || 0,
        imageUrl: editingIng.imageUrl || "",
        sortOrder: Number(editingIng.sortOrder) || 0,
        available: (editingIng as Ingredient & { available?: boolean }).available !== false,
        updatedAt: serverTimestamp(),
      };
      const ok = await runFirebaseWrite(async () => {
        if (editingIng.id) await updateDoc(dataDoc("ingredients", editingIng.id), ingData);
        else await addDoc(col("ingredients"), { ...ingData, createdAt: serverTimestamp() });
      }, "Ingrediente salvato e sincronizzato con Firebase!");
      if (ok) setEditingIng(null);
    } catch (error) {
      console.error(error);
      alert("Errore durante il salvataggio.");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteIng = async (id: string) => {
    if (!window.confirm("Eliminare ingrediente?")) return;
    try {
      await runFirebaseWrite(() => deleteDoc(dataDoc("ingredients", id)), "Ingrediente eliminato e Firebase sincronizzato.");
    } catch (error) {
      console.error(error);
      alert("Errore durante l'eliminazione.");
    }
  };

  // === SETTINGS ===
  const updateBeeperFlags = async (patch: Partial<typeof flags.beepers>) => {
    try {
      await runFirebaseWrite(() => saveFeatureFlags({ beepers: { ...flags.beepers, ...patch } }));
    } catch (error) {
      console.error(error);
      alert("Errore salvataggio configurazione beeper.");
    }
  };

  const saveBeeperRange = async (rangeMinRaw: number, rangeMaxRaw: number) => {
    const rangeMin = Math.max(1, Math.trunc(Number(rangeMinRaw) || 1));
    const rangeMax = Math.max(rangeMin, Math.trunc(Number(rangeMaxRaw) || rangeMin));
    const status = createBeeperStatusForRange(
      rangeMin,
      rangeMax,
      Array.isArray(data?.beeperSettings) ? data.beeperSettings : [],
      flags.beepers.rangeMin,
    );
    try {
      await runFirebaseWrite(() => Promise.all([
        saveFeatureFlags({ beepers: { ...flags.beepers, rangeMin, rangeMax } }),
        setDoc(settingsDoc("beepers"), { status, updatedAt: serverTimestamp() }, { merge: true }),
      ]));
    } catch (error) {
      console.error(error);
      alert("Errore salvataggio range beeper.");
    }
  };

  const toggleBeeperNumber = async (num: number) => {
    try {
      const rangeMin = flags.beepers.rangeMin;
      const rangeMax = flags.beepers.rangeMax;
      const current = createBeeperStatusForRange(
        rangeMin,
        rangeMax,
        Array.isArray(data?.beeperSettings) ? data.beeperSettings : [],
        rangeMin,
      );
      const idx = num - rangeMin;
      if (idx < 0 || idx >= current.length) return;
      current[idx] = !current[idx];
      await runFirebaseWrite(() => setDoc(settingsDoc("beepers"), { status: current, updatedAt: serverTimestamp() }, { merge: true }));
    } catch (error) {
      console.error(error);
      alert("Errore beeper.");
    }
  };
  const savePromo = async () => {
    try {
      await runFirebaseWrite(
        () => setDoc(settingsDoc("promo"), { ...promoDraft, updatedAt: serverTimestamp() }, { merge: true }),
        "Promo salvata e sincronizzata con Firebase!",
      );
    } catch (error) {
      console.error(error);
      alert("Errore promo.");
    }
  };
  const savePayment = async () => {
    try {
      await runFirebaseWrite(
        () => setDoc(settingsDoc("payment"), {
          ...paymentDraft,
          backendUrl: resolveBackendUrl(paymentDraft.backendUrl, window.location.origin),
          updatedAt: serverTimestamp(),
        }, { merge: true }),
        "Impostazioni POS salvate e sincronizzate con Firebase!",
      );
    } catch (error) {
      console.error(error);
      alert("Errore pagamenti.");
    }
  };
  const saveSecurity = async (settings: { pin?: string; productionMode?: boolean }) => {
    try {
      const pin = typeof settings.pin === "string" ? settings.pin.replace(/\D/g, "") : data.adminPin;
      await runFirebaseWrite(
        () => setDoc(
          settingsDoc("admin"),
          { pin, productionMode: settings.productionMode ?? data.securitySettings.productionMode, updatedAt: serverTimestamp() },
          { merge: true },
        ),
        "Impostazioni sicurezza salvate e sincronizzate con Firebase!",
      );
    } catch (error) {
      console.error(error);
      alert("Errore sicurezza.");
    }
  };
  const savePrinter = async (active: boolean) => {
    try {
      await runFirebaseWrite(() => setDoc(settingsDoc("printer"), { active, updatedAt: serverTimestamp() }, { merge: true }));
    } catch (error) {
      console.error(error);
      alert("Errore stampante.");
    }
  };
  const saveWheel = async () => {
    try {
      await runFirebaseWrite(
        () => setDoc(settingsDoc("wheel"), { ...wheelDraft, updatedAt: serverTimestamp() }, { merge: true }),
        "Impostazioni Ruota salvate e sincronizzate con Firebase!",
      );
    } catch (error) {
      console.error(error);
      alert("Errore ruota.");
    }
  };

  const handleExportCSV = () => {
    const headers = "NOME,CONTATTO,PREMIO,CODICE,DATA,RISCATTATO\n";
    const rows = (data.leads || [])
      .map(
        (l: any) =>
          `"${l.name || ""}","${l.phone || ""}","${l.prize || ""}","${l.code || ""}","${toDateValue(l.timestamp).toLocaleString()}","${l.redeemed ? "SI" : "NO"}"`,
      )
      .join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "Vincite_Orazio.csv";
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const filteredItems = useMemo(() => {
    return (data.menuItems || []).filter((item) => {
      if (filterDept !== "ALL" && item.departmentId !== filterDept) return false;
      if (searchProd && !item.name.toLowerCase().includes(searchProd.toLowerCase())) return false;
      return true;
    });
  }, [data.menuItems, filterDept, searchProd]);

  const tabs: { id: AdminTab; label: string }[] = [
    { id: "moduli", label: "MODULI" },
    { id: "brand", label: "BRAND & TESTI" },
    { id: "menu", label: "MENU" },
    { id: "reparti", label: "REPARTI" },
    { id: "ingredienti", label: "INGREDIENTI" },
    { id: "promo", label: "PROMO" },
    { id: "pagamenti", label: "PAGAMENTI" },
    { id: "scatola_nera", label: "SCATOLA NERA" },
    { id: "ruota", label: "RUOTA" },
    { id: "marketing", label: "MARKETING" },
    { id: "beeper", label: "BEEPER" },
    { id: "sicurezza", label: "SICUREZZA" },
    { id: "stampante", label: "STAMPANTE" },
    { id: "cameriere", label: "CAMERIERE" },
  ];

  const inputClass =
    "w-full p-4 rounded-xl bg-slate-100 border-2 border-slate-200 focus:border-indigo-500 focus:bg-white outline-none transition-all text-slate-900 font-bold placeholder:text-slate-400";
  const labelClass = "text-xs font-black text-slate-500 mb-1 ml-1 uppercase tracking-widest";

  return (
    <div className="h-[100dvh] min-h-0 bg-slate-50 flex flex-col overflow-hidden font-sans text-slate-900 uppercase">
      {/* HEADER E TABS */}
      <div className="shrink-0 bg-white border-b border-slate-200 px-4 md:px-6 py-4 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.history.back()}
            className="text-slate-400 hover:text-indigo-600 transition-colors p-2 rounded-full hover:bg-slate-100"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-black tracking-tighter text-slate-800">
            DASHBOARD <span className="text-indigo-600">ADMIN</span>
          </h1>
        </div>
      </div>

      <div className="flex gap-2 px-6 py-3 overflow-x-auto bg-white border-b border-slate-200 shadow-inner scrollbar-hide shrink-0">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 rounded-xl font-black text-xs whitespace-nowrap transition-all shadow-sm ${tab === t.id ? "bg-slate-900 text-white shadow-lg scale-105" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 md:p-8 bg-[#f8fafc] kiosk-scrollbar">
        {/* === TAB MODULI (Fase A.2.1) === */}
        {tab === "moduli" && (
          <div className="max-w-6xl mx-auto normal-case">
            <ModulesTab />
          </div>
        )}

        {/* === TAB BRAND & TESTI === */}
        {tab === "brand" && (
          <div className="max-w-6xl mx-auto">
            <BusinessSettingsTab />
          </div>
        )}

        {/* === TAB MENU === */}
        {tab === "menu" && (
          <div className="space-y-6 max-w-6xl mx-auto">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  value={searchProd}
                  onChange={(e) => setSearchProd(e.target.value)}
                  placeholder="CERCA PRODOTTO..."
                  className="w-full pl-12 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold outline-none focus:bg-white focus:border-indigo-500"
                />
              </div>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-bold outline-none focus:border-indigo-500"
              >
                <option value="ALL">TUTTI I REPARTI</option>
                {(data.departments || []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                onClick={() =>
                  setEditingItem({
                    name: "",
                    price: 0,
                    departmentId: data.departments?.[0]?.id || "",
                    available: true,
                    sortOrder: 0,
                    defaultIngredients: [],
                    isBaseProduct: false,
                    isSpecial: false,
                    formats: [],
                  })
                }
                className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
              >
                <Plus size={20} /> NUOVO PRODOTTO
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {filteredItems
                .slice()
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                .map((item) => (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm border border-slate-200 transition-all hover:shadow-md ${item.available === false ? "opacity-60 grayscale bg-slate-50" : ""} ${item.isSpecial ? "ring-2 ring-amber-400 ring-offset-2" : ""}`}
                  >
                    <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 border border-slate-100 shadow-inner">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl">🍽️</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-800 text-sm leading-tight truncate">{item.name}</p>
                      <p className="text-indigo-600 font-black text-sm mt-0.5">€{Number(item.price).toFixed(2)}</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setEditingItem(item)}
                        className="p-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={async () => {
                          await runFirebaseWrite(() => updateDoc(dataDoc("menu_items", item.id), { available: !(item.available !== false), updatedAt: serverTimestamp() }));
                        }}
                        className={`p-2 rounded-lg transition-colors ${item.available !== false ? "bg-slate-100 text-slate-400 hover:bg-slate-200" : "bg-red-50 text-red-600"}`}
                      >
                        {item.available !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* === TAB REPARTI === */}
        {tab === "reparti" && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <button
              onClick={() =>
                setEditingDept({ name: "", iconName: "Utensils", color: "bg-amber-500", sortOrder: 0, available: true })
              }
              className="w-full py-5 rounded-2xl border-2 border-dashed border-slate-300 bg-white text-slate-400 font-black flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 transition-all"
            >
              <Plus size={24} /> NUOVO REPARTO
            </button>
            {(data.departments || [])
              .slice()
              .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
              .map((dept) => (
                <div
                  key={dept.id}
                  className={`bg-white rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm border border-slate-200 transition-all ${dept.available === false ? "opacity-60 grayscale" : ""}`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-14 h-14 rounded-2xl ${dept.color} flex items-center justify-center text-white shadow-lg`}
                    >
                      {React.createElement(ICON_MAP[dept.iconName] || ICON_MAP.Utensils, { size: 30 })}
                    </div>
                    <p className="font-black text-xl text-slate-800">{dept.name}</p>
                  </div>
                  <div className="flex gap-2 self-end sm:self-auto">
                    <button
                      onClick={async () => {
                        await runFirebaseWrite(() => updateDoc(dataDoc("departments", dept.id), { available: !(dept.available !== false), updatedAt: serverTimestamp() }));
                      }}
                      className="p-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all active:scale-90 shadow-sm"
                    >
                      {dept.available !== false ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                    <button
                      onClick={() => setEditingDept(dept)}
                      className="p-3 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 shadow-sm active:scale-90 transition-all"
                    >
                      <Edit3 size={20} />
                    </button>
                    <button
                      onClick={() => deleteDept(dept.id)}
                      className="p-3 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 shadow-sm active:scale-90 transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* === TAB INGREDIENTI === */}
        {tab === "ingredienti" && (
          <div className="space-y-6 max-w-6xl mx-auto">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col gap-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  value={searchIng}
                  onChange={(e) => setSearchIng(e.target.value)}
                  placeholder="CERCA INGREDIENTE..."
                  className="w-full pl-12 pr-4 py-4 rounded-xl bg-slate-100 border-2 border-transparent text-slate-900 font-black outline-none focus:bg-white focus:border-indigo-500 transition-all"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {[
                  { id: "ALL", label: "TUTTI" },
                  { id: "CARNI", label: "🥩 CARNI" },
                  { id: "CONDIMENTI", label: "🧀 CONDIMENTI" },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setFilterCatIng(option.id)}
                    className={`px-6 py-2.5 rounded-full text-xs font-black transition-all ${filterCatIng === option.id ? "bg-indigo-600 text-white shadow-lg" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setEditingIng({ name: "", category: "", extraPrice: 0, sortOrder: 0 })}
              className="w-full py-4 rounded-2xl bg-white border-2 border-dashed border-indigo-200 text-indigo-400 font-black hover:bg-indigo-50 shadow-sm transition-all"
            >
              <Plus size={24} className="inline mr-2" /> NUOVO INGREDIENTE
            </button>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {(data.ingredientsPool || [])
                .filter((ing) => filterCatIng === "ALL" || (ing.category || "").toUpperCase() === filterCatIng)
                .filter((ing) => !searchIng || ing.name.toLowerCase().includes(searchIng.toLowerCase()))
                .slice()
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                .map((ing) => (
                  <div
                    key={ing.id}
                    className={`bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-all ${(ing as Ingredient & { available?: boolean }).available === false ? "opacity-60 grayscale bg-slate-50" : ""}`}
                  >
                    <div className="w-full aspect-square rounded-xl bg-slate-50 overflow-hidden mb-3 border border-slate-100 flex items-center justify-center text-4xl">
                      {ing.imageUrl ? (
                        <img src={ing.imageUrl} alt={ing.name} className="w-full h-full object-cover" />
                      ) : (
                        "🧂"
                      )}
                    </div>
                    <p className="font-black text-slate-800 text-center uppercase truncate text-xs">{ing.name}</p>
                    <p className="text-center font-bold text-red-500 text-[10px] mt-1">
                      {Number(ing.extraPrice) > 0 ? `+€${Number(ing.extraPrice).toFixed(2)}` : "GRATIS"}
                    </p>
                    <div className="flex gap-1 mt-3">
                      <button
                        onClick={() => setEditingIng(ing)}
                        className="flex-1 p-2 rounded-lg bg-indigo-50 text-indigo-600 flex justify-center hover:bg-indigo-100 transition-colors"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={async () => {
                          await runFirebaseWrite(() => updateDoc(dataDoc("ingredients", ing.id), {
                            available: !((ing as Ingredient & { available?: boolean }).available !== false),
                            updatedAt: serverTimestamp(),
                          }));
                        }}
                        className={`flex-1 p-2 rounded-lg flex justify-center transition-colors ${(ing as Ingredient & { available?: boolean }).available !== false ? "bg-slate-100 text-slate-400 hover:bg-slate-200" : "bg-red-50 text-red-600 hover:bg-red-100"}`}
                      >
                        {(ing as Ingredient & { available?: boolean }).available !== false ? (
                          <Eye size={14} />
                        ) : (
                          <EyeOff size={14} />
                        )}
                      </button>
                      <button
                        onClick={() => deleteIng(ing.id)}
                        className="flex-1 p-2 rounded-lg bg-red-50 text-red-600 flex justify-center hover:bg-red-100 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* === TAB PROMO === */}
        {tab === "promo" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200">
              <div className="flex items-center justify-between bg-amber-50 p-8 rounded-3xl border-2 border-amber-200 mb-10">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-amber-500 rounded-2xl text-white shadow-lg">
                    <Zap size={32} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-amber-900 tracking-tight">PROMOZIONE UPSELL</h3>
                    <p className="text-sm font-bold text-amber-700">SPINGI UN PRODOTTO AL PAGAMENTO</p>
                  </div>
                </div>
                <button
                  onClick={() => setPromoDraft((prev) => ({ ...prev, active: !prev.active }))}
                  className="active:scale-95 transition-all"
                >
                  {promoDraft.active ? (
                    <ToggleRight size={60} className="text-amber-500" />
                  ) : (
                    <ToggleLeft size={60} className="text-slate-300" />
                  )}
                </button>
              </div>

              <div
                className={`space-y-8 transition-all ${promoDraft.active ? "opacity-100" : "opacity-40 pointer-events-none grayscale"}`}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className={labelClass}>PRODOTTO DA OFFRIRE</label>
                    <select
                      value={promoDraft.productId || ""}
                      onChange={(e) => setPromoDraft((prev) => ({ ...prev, productId: e.target.value }))}
                      className={inputClass}
                    >
                      <option value="">-- SELEZIONA DALLA LISTA --</option>
                      {(data.menuItems || []).map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>PREZZO SPECIALE PROMO (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={promoDraft.price ?? ""}
                      onChange={(e) => setPromoDraft((prev) => ({ ...prev, price: Number(e.target.value) }))}
                      className={inputClass + " text-red-600 text-2xl"}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>MESSAGGIO PER IL CLIENTE</label>
                  <input
                    value={promoDraft.message || ""}
                    onChange={(e) => setPromoDraft((prev) => ({ ...prev, message: e.target.value }))}
                    placeholder="VUOI AGGIUNGERE UN DOLCE A SOLO 1 EURO?"
                    className={inputClass}
                  />
                </div>
                <button
                  onClick={savePromo}
                  className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl hover:bg-indigo-700 transition-all active:scale-95"
                >
                  SALVA PROMO
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === TAB PAGAMENTI === */}
        {tab === "pagamenti" && (
          <div className="max-w-4xl mx-auto bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200">
            <div className="flex items-center gap-4 mb-10 border-b border-slate-100 pb-6">
              <div className="p-4 bg-blue-600 rounded-3xl text-white shadow-xl shadow-blue-100">
                <CreditCard size={36} />
              </div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic">
                Configurazione <span className="text-blue-600">POS SUMUP</span>
              </h2>
            </div>
            <div className="space-y-8">
              <div className="flex items-center justify-between bg-slate-50 p-8 rounded-3xl border border-slate-100 shadow-inner">
                <div>
                  <h3 className="text-xl font-black text-slate-900 uppercase">SUMUP CLOUD ATTIVO</h3>
                  <p className="text-sm font-bold text-slate-500 mt-1">INVIA L'IMPORTO AL LETTORE AUTOMATICAMENTE</p>
                </div>
                <button onClick={() => setPaymentDraft((prev) => ({ ...prev, sumupActive: !prev.sumupActive }))}>
                  {paymentDraft.sumupActive ? (
                    <ToggleRight size={56} className="text-blue-600" />
                  ) : (
                    <ToggleLeft size={56} className="text-slate-300" />
                  )}
                </button>
              </div>
              <div
                className={`space-y-4 transition-all ${paymentDraft.sumupActive ? "opacity-100" : "opacity-40 pointer-events-none"}`}
              >
                <label className={labelClass}>INDIRIZZO SERVER LOCALE (LOCAL CLOUD)</label>
                <input
                  value={paymentDraft.backendUrl || ""}
                  onChange={(e) => setPaymentDraft((prev) => ({ ...prev, backendUrl: e.target.value }))}
                  className={inputClass}
                  placeholder="ES: HTTP://192.168.1.100:3000/API/SUMUP"
                />
              </div>
              <button
                onClick={savePayment}
                className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl hover:bg-indigo-700 transition-all active:scale-95"
              >
                SALVA PAGAMENTI
              </button>
            </div>
          </div>
        )}

        {/* === TAB SCATOLA NERA === */}
        {tab === "scatola_nera" && (
          <div className="max-w-5xl mx-auto space-y-6">
            <div className="bg-slate-900 p-8 rounded-[2rem] shadow-2xl border-b-8 border-indigo-600">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-indigo-600 rounded-2xl text-white">
                  <History size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white">SCATOLA NERA</h3>
                  <p className="text-indigo-400 font-bold text-sm tracking-widest uppercase italic">
                    REGISTRO TRANSAZIONI POS INVIOLABILE
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                {(data.posRecords || [])
                  .slice()
                  .sort(
                    (a: any, b: any) =>
                      toDateValue(b.orazio_timestamp).getTime() - toDateValue(a.orazio_timestamp).getTime(),
                  )
                  .map((record: any) => (
                    <PosRecordCard key={record.id} record={record} />
                  ))}
                {(data.posRecords || []).length === 0 && (
                  <p className="text-center py-20 font-black text-slate-700 text-3xl opacity-20 uppercase">
                    NESSUN DATO REGISTRATO
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* === TAB RUOTA E MARKETING === */}
        {tab === "ruota" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-8">
              <div className="flex items-center justify-between bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                <h3 className="text-xl font-black text-indigo-900 flex items-center gap-2 uppercase italic">
                  <Gamepad2 size={24} /> STATO GIOCHI FIDELITY
                </h3>
                <button onClick={() => setWheelDraft((prev) => ({ ...prev, active: !prev.active }))}>
                  {wheelDraft.active ? (
                    <ToggleRight size={56} className="text-indigo-600" />
                  ) : (
                    <ToggleLeft size={56} className="text-slate-300" />
                  )}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {["slot", "scratch", "box"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setWheelDraft((prev) => ({ ...prev, gameType: type }))}
                    className={`p-5 rounded-2xl font-black border-2 transition-all uppercase text-sm ${wheelDraft.gameType === type ? "bg-slate-900 text-white border-slate-900 shadow-xl scale-105" : "bg-slate-50 text-slate-400 border-slate-200"}`}
                  >
                    {type === "slot" ? "🎰 Slot" : type === "scratch" ? "🟡 Gratta" : "🎁 Pacchi"}
                  </button>
                ))}
              </div>
              <div className="bg-slate-50 p-6 rounded-3xl space-y-4">
                <h3 className="font-black text-slate-800 text-lg uppercase italic border-b border-slate-200 pb-2">
                  PREMI E PROBABILITÀ
                </h3>
                {(wheelDraft.prizes || []).map((prize: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200"
                  >
                    <input
                      value={prize.name}
                      onChange={(e) => {
                        const next = [...(wheelDraft.prizes || [])];
                        next[idx] = { ...next[idx], name: e.target.value };
                        setWheelDraft((prev) => ({ ...prev, prizes: next }));
                      }}
                      className="flex-1 p-2 bg-slate-100 rounded-lg text-slate-900 font-bold outline-none focus:bg-white focus:border-indigo-500 border-2 border-transparent transition-all"
                    />
                    <div className="w-24">
                      <label className="text-[9px] font-black text-slate-400 block text-center uppercase tracking-tighter">
                        PESO VINCENTE
                      </label>
                      <input
                        type="number"
                        value={prize.weight}
                        onChange={(e) => {
                          const next = [...(wheelDraft.prizes || [])];
                          next[idx] = { ...next[idx], weight: Number(e.target.value) };
                          setWheelDraft((prev) => ({ ...prev, prizes: next }));
                        }}
                        className="w-full p-2 bg-slate-100 rounded-lg text-center font-black text-indigo-600 outline-none focus:bg-white focus:border-indigo-500 border-2 border-transparent transition-all"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const next = (wheelDraft.prizes || []).filter((_, i) => i !== idx);
                        setWheelDraft((prev) => ({ ...prev, prizes: next }));
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 transition-colors rounded-lg"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setWheelDraft((prev) => ({
                      ...prev,
                      prizes: [...(prev.prizes || []), { name: "", weight: 1, stock: 0 }],
                    }))
                  }
                  className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 font-black hover:bg-white transition-all"
                >
                  <Plus size={20} className="inline mr-1" /> NUOVO PREMIO
                </button>
                <button
                  onClick={saveWheel}
                  className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-black shadow-xl hover:bg-indigo-700 transition-all active:scale-95 mt-4"
                >
                  SALVA RUOTA
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "marketing" && (
          <div className="max-w-5xl mx-auto bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-8 border-b border-slate-100 pb-4">
              <h3 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                <BarChart3 size={28} className="text-indigo-600" /> LISTA VINCITORI
              </h3>
              <button
                onClick={handleExportCSV}
                className="bg-green-600 text-white px-6 py-2.5 rounded-xl font-black flex items-center gap-2 hover:bg-green-700 transition-all active:scale-95 shadow-lg"
              >
                <Download size={20} /> SCARICA CSV
              </button>
            </div>
            <div className="space-y-3">
              {(data.leads || [])
                .slice()
                .sort((a: any, b: any) => toDateValue(b.timestamp).getTime() - toDateValue(a.timestamp).getTime())
                .map((lead: any) => (
                  <div
                    key={lead.id}
                    className={`flex items-center justify-between p-5 rounded-2xl border ${lead.redeemed ? "bg-slate-50 border-slate-100 opacity-60" : "bg-white border-slate-200 shadow-sm"}`}
                  >
                    <div className="flex-1">
                      <p className="font-black text-lg text-slate-800 uppercase leading-none">{lead.name}</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-black uppercase">
                          {lead.prize}
                        </span>
                        <span className="px-3 py-1 bg-slate-100 text-slate-500 rounded-lg text-xs font-mono font-bold">
                          COD: {lead.code}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold ml-2 uppercase">
                          DATA: {toDateValue(lead.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => runFirebaseWrite(() => updateDoc(dataDoc("leads", lead.id), { redeemed: !lead.redeemed, updatedAt: serverTimestamp() }))}
                      className={`px-6 py-3 rounded-xl font-black text-xs transition-all uppercase ${lead.redeemed ? "bg-slate-200 text-slate-500" : "bg-indigo-600 text-white shadow-lg"}`}
                    >
                      {lead.redeemed ? "RITIRATO ✅" : "CONSEGNA PREMIO"}
                    </button>
                    <button
                      onClick={() => runFirebaseWrite(() => deleteDoc(dataDoc("leads", lead.id)))}
                      className="p-3 text-red-500 ml-2 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* === ALTRE TAB RIASSUNTE (BEEPER, SICUREZZA, STAMPANTE, CAMERIERE) === */}
        {["beeper", "sicurezza", "stampante", "cameriere"].includes(tab) && (
          <div className="max-w-4xl mx-auto bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-200">
            <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase italic mb-10 border-b border-slate-50 pb-6">
              {tab.toUpperCase()}
            </h2>

            {tab === "beeper" && (() => {
              const rangeMin = flags.beepers.rangeMin;
              const rangeMax = flags.beepers.rangeMax;
              const status = createBeeperStatusForRange(
                rangeMin,
                rangeMax,
                Array.isArray(data?.beeperSettings) ? data.beeperSettings : [],
                rangeMin,
              );
              const numbers = Array.from({ length: Math.max(0, rangeMax - rangeMin + 1) }, (_, idx) => rangeMin + idx);
              return (
                <div className="space-y-8">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black uppercase text-slate-900">Usa beeper</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase">Se spento, il cliente vede solo il numero ordine.</p>
                      </div>
                      <button onClick={() => updateBeeperFlags({ enabled: !flags.beepers.enabled })}>
                        {flags.beepers.enabled ? <ToggleRight size={56} className="text-indigo-600" /> : <ToggleLeft size={56} className="text-slate-300" />}
                      </button>
                    </div>

                    <div className="p-6 rounded-[2rem] bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-black uppercase text-slate-900">Assegnazione automatica</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase">Se off, usa solo contatore ordine sequenziale.</p>
                      </div>
                      <button onClick={() => updateBeeperFlags({ autoAssign: !flags.beepers.autoAssign })} disabled={!flags.beepers.enabled} className={!flags.beepers.enabled ? "opacity-40" : ""}>
                        {flags.beepers.autoAssign ? <ToggleRight size={56} className="text-indigo-600" /> : <ToggleLeft size={56} className="text-slate-300" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-4 gap-4">
                    <div>
                      <label className={labelClass}>Range minimo</label>
                      <input
                        type="number"
                        min={1}
                        value={rangeMin}
                        onChange={(e) => saveBeeperRange(Number(e.target.value), rangeMax)}
                        className={inputClass + " text-center"}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Range massimo</label>
                      <input
                        type="number"
                        min={rangeMin}
                        value={rangeMax}
                        onChange={(e) => saveBeeperRange(rangeMin, Number(e.target.value))}
                        className={inputClass + " text-center"}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Rilascio beeper</label>
                      <select
                        value={flags.beepers.releaseOn}
                        onChange={(e) => updateBeeperFlags({ releaseOn: e.target.value === "ready" ? "ready" : "delivered" })}
                        className={inputClass}
                      >
                        <option value="ready">Quando è pronto</option>
                        <option value="delivered">Alla consegna</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => updateBeeperFlags({ takeawayMode: !flags.beepers.takeawayMode })}
                        className={`w-full h-[58px] rounded-2xl font-black uppercase border-b-4 active:scale-95 ${flags.beepers.takeawayMode ? "bg-emerald-600 text-white border-emerald-800" : "bg-slate-100 text-slate-500 border-slate-300"}`}
                      >
                        Fallback 17–99 {flags.beepers.takeawayMode ? "ON" : "OFF"}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Testo quando i beeper sono spenti / numero su monitor</label>
                    <textarea
                      value={flags.beepers.fallbackText}
                      onChange={(e) => updateBeeperFlags({ fallbackText: e.target.value })}
                      className={inputClass + " h-24 resize-none"}
                      placeholder="Attendi il tuo numero d'ordine sul monitor"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-black text-slate-900 uppercase italic">Beeper fisici attivi</h3>
                        <p className="text-xs font-bold text-slate-500 uppercase">Tocca un numero per abilitarlo/disabilitarlo nel range configurato.</p>
                      </div>
                      <span className="text-xs font-black px-3 py-2 rounded-full bg-indigo-50 text-indigo-700 uppercase">
                        Range {rangeMin}–{rangeMax}
                      </span>
                    </div>
                    <div className="grid grid-cols-4 md:grid-cols-8 gap-6">
                      {numbers.map((num, idx) => {
                        const active = status[idx] !== false;
                        return (
                          <button
                            key={num}
                            onClick={() => toggleBeeperNumber(num)}
                            disabled={!flags.beepers.enabled || !flags.beepers.autoAssign}
                            className={`aspect-square rounded-[2rem] font-black text-3xl transition-all shadow-lg active:scale-95 flex items-center justify-center border-b-8 ${active ? "bg-indigo-600 text-white border-indigo-800" : "bg-slate-100 text-slate-300 border-slate-300 grayscale"} ${(!flags.beepers.enabled || !flags.beepers.autoAssign) ? "opacity-40" : ""}`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {tab === "sicurezza" && (
              <div className="space-y-10">
                <div>
                  <label className={labelClass}>NUOVO PIN AMMINISTRATORE (SOLO NUMERI)</label>
                  <div className="flex gap-4">
                    <input
                      value={newPin}
                      type="password"
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                      className={inputClass + " text-center text-3xl tracking-[0.6em]"}
                      placeholder="****"
                    />
                    <button
                      onClick={() => {
                        const normalized = newPin.replace(/\D/g, "");
                        if (normalized.length < 4) return alert("MINIMO 4 CIFRE!");
                        saveSecurity({ pin: normalized });
                        setNewPin("");
                      }}
                      className="bg-slate-900 text-white px-10 rounded-2xl font-black hover:bg-black transition-all"
                    >
                      SALVA PIN
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between p-8 bg-red-50 border border-red-100 rounded-[2rem]">
                  <div>
                    <h3 className="text-xl font-black text-red-900 uppercase">MODALITÀ PRODUZIONE</h3>
                    <p className="text-sm font-bold text-red-600">NASCONDE L'ACCESSO ADMIN DALLA HOME PUBBLICA</p>
                  </div>
                  <button onClick={() => saveSecurity({ productionMode: !data.securitySettings.productionMode })}>
                    {data.securitySettings.productionMode ? (
                      <ToggleRight size={56} className="text-red-600" />
                    ) : (
                      <ToggleLeft size={56} className="text-slate-300" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {tab === "stampante" && (
              <PrinterSettingsTab departments={data.departments || []} />
            )}

            {tab === "cameriere" && (
              <WaiterSettingsTab departments={data.departments || []} />
            )}
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODALI A SCHERMO INTERO CHIRURGICI E COMPLETI              */}
      {/* ======================================================== */}

      {/* MODAL MODIFICA PRODOTTO */}
      {editingItem && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto uppercase">
          <div className="bg-white rounded-[3rem] p-10 w-full max-w-4xl shadow-2xl border-4 border-white animate-in zoom-in-95 my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-3xl font-black text-slate-800 italic uppercase">
                MODIFICA <span className="text-indigo-600">PRODOTTO</span>
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-3 rounded-full bg-slate-100 text-slate-400 hover:text-red-500 transition-all"
              >
                <X size={32} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 max-h-[75vh] overflow-y-auto pr-4 custom-scrollbar">
              {/* COLONNA SINISTRA: INFO BASE */}
              <div className="space-y-6">
                <div>
                  <label className={labelClass}>NOME ARTICOLO</label>
                  <input
                    value={editingItem.name || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>PREZZO BASE €</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editingItem.price ?? ""}
                      onChange={(e) => setEditingItem({ ...editingItem, price: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>ORDINE VISUALIZZ.</label>
                    <input
                      type="number"
                      value={editingItem.sortOrder ?? 0}
                      onChange={(e) => setEditingItem({ ...editingItem, sortOrder: Number(e.target.value) })}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>REPARTO APPARTENENZA</label>
                  <select
                    value={editingItem.departmentId || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, departmentId: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">-- SELEZIONA --</option>
                    {(data.departments || []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <ImageUploadField
                    label="FOTO PRODOTTO"
                    folder="products"
                    value={editingItem.imageUrl || ""}
                    onChange={(url) => setEditingItem({ ...editingItem, imageUrl: url })}
                  />
                </div>
                <div>
                  <label className={labelClass}>DESCRIZIONE (INFO TOTEM)</label>
                  <textarea
                    value={editingItem.description || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                    className={inputClass + " h-24 resize-none"}
                  />
                </div>

                <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 space-y-4 shadow-inner">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-base font-black text-amber-600">⭐ CONSIGLIATO (STELLINA)</span>
                    <input
                      type="checkbox"
                      checked={editingItem.isSpecial || false}
                      onChange={(e) => setEditingItem({ ...editingItem, isSpecial: e.target.checked })}
                      className="w-8 h-8 accent-amber-500"
                    />
                  </label>
                  <div className="h-px bg-slate-200" />
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-base font-black text-indigo-600">🛠️ COMPONIBILE DA ZERO</span>
                    <input
                      type="checkbox"
                      checked={editingItem.isBaseProduct || false}
                      onChange={(e) =>
                        setEditingItem({ ...editingItem, isBaseProduct: e.target.checked, defaultIngredients: [] })
                      }
                      className="w-8 h-8 accent-indigo-500"
                    />
                  </label>
                  <div className="h-px bg-slate-200" />
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-base font-black text-red-600">🔥 RICHIESTA COTTURA CARNE</span>
                    <input
                      type="checkbox"
                      checked={(editingItem as any).requiresCottura || false}
                      onChange={(e) => setEditingItem({ ...editingItem, requiresCottura: e.target.checked } as any)}
                      className="w-8 h-8 accent-red-600"
                    />
                  </label>
                </div>
              </div>

              {/* COLONNA DESTRA: FORMATI, CONTORNI E INGREDIENTI */}
              <div className="space-y-8">
                {/* FORMATI */}
                <div className="bg-white p-6 rounded-[2rem] border-2 border-indigo-100 shadow-sm">
                  <label className={labelClass + " text-indigo-600"}>FORMATI MULTIPLI (ES: PICCOLO/GRANDE)</label>
                  <div className="space-y-2 mt-4">
                    {(editingItem.formats || []).map((fmt, idx) => (
                      <div
                        key={idx}
                        className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200"
                      >
                        <input
                          value={fmt.name}
                          onChange={(e) => {
                            const nf = [...(editingItem.formats || [])];
                            nf[idx] = { ...nf[idx], name: e.target.value };
                            setEditingItem({ ...editingItem, formats: nf });
                          }}
                          className="flex-1 p-2 rounded-lg bg-white border font-bold text-xs outline-none focus:border-indigo-500"
                          placeholder="NOME"
                        />
                        <input
                          type="number"
                          step="0.01"
                          value={fmt.price ?? ""}
                          onChange={(e) => {
                            const nf = [...(editingItem.formats || [])];
                            nf[idx] = { ...nf[idx], price: Number(e.target.value) };
                            setEditingItem({ ...editingItem, formats: nf });
                          }}
                          className="w-20 p-2 rounded-lg bg-white border font-black text-xs text-center outline-none focus:border-indigo-500"
                          placeholder="€"
                        />
                        <button
                          onClick={() => {
                            const nf = editingItem.formats!.filter((_, i) => i !== idx);
                            setEditingItem({ ...editingItem, formats: nf });
                          }}
                          className="p-2 text-red-500 hover:bg-red-100 rounded-lg"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        setEditingItem({
                          ...editingItem,
                          formats: [...(editingItem.formats || []), { name: "", price: 0 }],
                        })
                      }
                      className="w-full py-3 mt-2 bg-indigo-50 text-indigo-600 font-black rounded-xl text-xs uppercase border-2 border-dashed border-indigo-200 hover:bg-indigo-100 transition-all"
                    >
                      + AGGIUNGI FORMATO
                    </button>
                  </div>
                </div>

                {/* CONTORNI */}
                <div className="bg-white p-6 rounded-[2rem] border-2 border-emerald-100 shadow-sm">
                  <label className={labelClass + " text-emerald-600"}>ABBINAMENTO CONTORNI (DA QUALE REPARTO?)</label>
                  <select
                    value={editingItem.contpiattoDeptId || ""}
                    onChange={(e) => setEditingItem({ ...editingItem, contpiattoDeptId: e.target.value })}
                    className={inputClass + " mt-4"}
                  >
                    <option value="">-- NESSUN CONTORNO --</option>
                    {(data.departments || []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* INGREDIENTI DEFAULT */}
                {!editingItem.isBaseProduct && (
                  <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-200 shadow-sm">
                    <label className={labelClass}>RICETTA BASE (COSA C'È DENTRO?)</label>
                    <div className="grid grid-cols-2 gap-2 mt-4 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                      {(data.ingredientsPool || []).map((ing) => {
                        const isSelected = (editingItem.defaultIngredients || []).includes(ing.name);
                        return (
                          <button
                            key={ing.id}
                            onClick={() => {
                              const current = editingItem.defaultIngredients || [];
                              const next = isSelected ? current.filter((n) => n !== ing.name) : [...current, ing.name];
                              setEditingItem({ ...editingItem, defaultIngredients: next });
                            }}
                            className={`p-3 rounded-lg text-xs font-black border-2 transition-all ${isSelected ? "bg-indigo-600 text-white border-indigo-700 shadow-md" : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"}`}
                          >
                            {ing.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-6 mt-10 pt-8 border-t-4 border-slate-50">
              <button
                onClick={() => setEditingItem(null)}
                className="flex-1 py-5 rounded-3xl bg-slate-100 text-slate-500 font-black text-xl hover:bg-slate-200 transition-all uppercase"
              >
                ANNULLA
              </button>
              <button
                onClick={saveItem}
                disabled={isSaving}
                className="flex-[2] py-5 rounded-3xl bg-indigo-600 text-white font-black text-2xl shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-4 uppercase disabled:opacity-50"
              >
                <Save size={32} /> SALVA PRODOTTO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MODIFICA REPARTO */}
      {editingDept && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-start md:items-center justify-center p-3 md:p-4 overflow-y-auto uppercase">
          <div className="bg-white rounded-[2rem] md:rounded-[3rem] p-5 md:p-10 my-6 w-full max-w-md max-h-[calc(100dvh-3rem)] overflow-y-auto shadow-2xl border-4 border-white animate-in zoom-in-95 kiosk-scrollbar">
            <h3 className="text-3xl font-black text-slate-800 mb-8 italic uppercase">REPARTO</h3>
            <div className="space-y-6">
              <div>
                <label className={labelClass}>Nome Reparto</label>
                <input
                  value={editingDept.name || ""}
                  onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                  placeholder="NOME REPARTO"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Ordine Visualizzazione</label>
                <input
                  type="number"
                  value={editingDept.sortOrder ?? 0}
                  onChange={(e) => setEditingDept({ ...editingDept, sortOrder: Number(e.target.value) })}
                  placeholder="ORDINE"
                  className={inputClass}
                />
              </div>
              <div>
                <ImageUploadField
                  label="FOTO REPARTO (OPZIONALE)"
                  folder="departments"
                  value={editingDept.imageUrl || ""}
                  onChange={(url) => setEditingDept({ ...editingDept, imageUrl: url })}
                />
              </div>
              <div>
                <label className={labelClass}>Colore Identificativo</label>
                <div className="flex flex-wrap gap-3 p-5 bg-slate-50 rounded-2xl border border-slate-200">
                  {COLORS_LIST.map((c) => (
                    <button
                      key={c}
                      onClick={() => setEditingDept({ ...editingDept, color: c })}
                      className={`w-10 h-10 rounded-full transition-all border-4 ${c} ${editingDept.color === c ? "border-slate-900 scale-110 shadow-lg" : "border-transparent opacity-80 hover:opacity-100"}`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className={labelClass}>Seleziona Icona</label>
                <div className="flex flex-wrap gap-2 p-5 bg-slate-50 rounded-2xl border border-slate-200 max-h-48 overflow-y-auto">
                  {ICON_NAMES.map((name) => (
                    <button
                      key={name}
                      onClick={() => setEditingDept({ ...editingDept, iconName: name })}
                      className={`p-4 rounded-xl transition-all ${editingDept.iconName === name ? "bg-slate-900 text-white scale-110 shadow-lg" : "bg-white text-slate-400 hover:bg-slate-100"}`}
                    >
                      {React.createElement(ICON_MAP[name], { size: 24 })}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button
                  onClick={() => setEditingDept(null)}
                  className="flex-1 py-5 rounded-2xl bg-slate-100 text-slate-500 font-black uppercase transition-all hover:bg-slate-200"
                >
                  ANNULLA
                </button>
                <button
                  onClick={saveDept}
                  disabled={isSaving}
                  className="flex-1 py-5 rounded-2xl bg-indigo-600 text-white font-black uppercase transition-all hover:bg-indigo-700 shadow-lg disabled:opacity-50"
                >
                  SALVA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MODIFICA INGREDIENTE */}
      {editingIng && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-start md:items-center justify-center p-3 md:p-4 overflow-y-auto uppercase">
          <div className="bg-white rounded-[2rem] md:rounded-[3rem] p-5 md:p-10 my-6 w-full max-w-md max-h-[calc(100dvh-3rem)] overflow-y-auto shadow-2xl border-4 border-white animate-in zoom-in-95 kiosk-scrollbar">
            <h3 className="text-3xl font-black text-slate-800 mb-8 italic uppercase">INGREDIENTE</h3>
            <div className="space-y-6">
              <div>
                <label className={labelClass}>Nome</label>
                <input
                  value={editingIng.name || ""}
                  onChange={(e) => setEditingIng({ ...editingIng, name: e.target.value })}
                  placeholder="NOME INGREDIENTE"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Categoria</label>
                <select
                  value={editingIng.category || ""}
                  onChange={(e) => setEditingIng({ ...editingIng, category: e.target.value })}
                  className={inputClass}
                >
                  <option value="">SELEZIONA CATEGORIA</option>
                  <option value="CARNI">CARNI</option>
                  <option value="CONDIMENTI">CONDIMENTI</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Sovrapprezzo € (Lascia 0 se gratis)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingIng.extraPrice ?? ""}
                  onChange={(e) => setEditingIng({ ...editingIng, extraPrice: Number(e.target.value) })}
                  placeholder="PREZZO EXTRA"
                  className={inputClass}
                />
              </div>
              <div>
                <ImageUploadField
                  label="FOTO INGREDIENTE (OPZIONALE)"
                  folder="ingredients"
                  value={editingIng.imageUrl || ""}
                  onChange={(url) => setEditingIng({ ...editingIng, imageUrl: url })}
                />
              </div>
              <div>
                <label className={labelClass}>Ordine di visualizzazione</label>
                <input
                  type="number"
                  value={editingIng.sortOrder ?? 0}
                  onChange={(e) => setEditingIng({ ...editingIng, sortOrder: Number(e.target.value) })}
                  placeholder="0"
                  className={inputClass}
                />
              </div>
              <div className="flex gap-4 pt-6">
                <button
                  onClick={() => setEditingIng(null)}
                  className="flex-1 py-5 rounded-2xl bg-slate-100 text-slate-500 font-black uppercase transition-all hover:bg-slate-200"
                >
                  ANNULLA
                </button>
                <button
                  onClick={saveIng}
                  disabled={isSaving}
                  className="flex-1 py-5 rounded-2xl bg-indigo-600 text-white font-black uppercase transition-all hover:bg-indigo-700 shadow-lg disabled:opacity-50"
                >
                  SALVA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
