import { useMemo, useState } from "react";
import { CheckCircle2, Eye, Plus, Printer, Trash2, XCircle } from "lucide-react";
import { usePrinterProfiles, makeDefaultPrinterProfile } from "@/hooks/usePrinterProfiles";
import { buildTestPrintPayload, DRIVER_LABELS, DRIVER_STATUS, getPaperWidthMm, printWithProfile } from "@/lib/print/engine";
import type { Department } from "@/lib/constants";
import type { PaperWidth, PrinterDriverType, PrinterProfile, PrinterRole } from "@/lib/print/types";

const inputClass = "w-full p-4 rounded-xl bg-slate-100 border-2 border-slate-200 focus:border-indigo-500 focus:bg-white outline-none transition-all text-slate-900 font-bold placeholder:text-slate-400";
const labelClass = "text-xs font-black text-slate-500 mb-1 ml-1 uppercase tracking-widest";

const DRIVER_OPTIONS: PrinterDriverType[] = ["browser", "webusb", "webserial", "escpos-network", "bluetooth", "qz"];
const ROLE_OPTIONS: Array<{ value: PrinterRole; label: string }> = [
  { value: "receipt", label: "Ricevuta cliente" },
  { value: "cassa", label: "Cassa" },
  { value: "kitchen", label: "Cucina / reparto" },
  { value: "bar", label: "Bar" },
  { value: "lab", label: "Laboratorio" },
  { value: "counter", label: "Banco" },
  { value: "generic", label: "Generica" },
];

export default function PrinterSettingsTab({ departments }: { departments: Department[] }) {
  const { printers, loading, createPrinter, savePrinter, removePrinter, updateLastTest } = usePrinterProfiles();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<PrinterProfile | null>(null);
  const [preview, setPreview] = useState<PrinterProfile | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => [...printers].sort((a, b) => a.name.localeCompare(b.name)), [printers]);

  const handleTest = async (printer: PrinterProfile) => {
    setBusyId(printer.id);
    setError(null);
    const result = await printWithProfile(buildTestPrintPayload(printer), printer);
    try {
      await updateLastTest(printer.id, result.ok, result.error);
    } catch (e) {
      console.warn("[PrinterSettingsTab] lastTest update failed", e);
    }
    if (!result.ok) setError(result.error || "Test stampa fallito");
    setBusyId(null);
  };

  const handleCreate = async () => {
    const profile = makeDefaultPrinterProfile();
    const id = await createPrinter(profile);
    setEditing({ id, ...profile });
    setWizardOpen(true);
  };

  const handleSaveDraft = async (draft: PrinterProfile) => {
    const { id, ...patch } = draft;
    await savePrinter(id, patch);
    setEditing(null);
    setWizardOpen(false);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-indigo-100 bg-indigo-50 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-black text-slate-900 uppercase italic">Stampanti configurabili</h3>
          <p className="text-sm font-bold text-slate-600 max-w-2xl">
            Il cliente finale può aggiungere stampanti, scegliere formato carta, ruolo, reparto e fare una stampa test. Il driver Browser è attivo; gli altri sono visibili come beta/non disponibili.
          </p>
        </div>
        <button onClick={handleCreate} className="h-14 px-6 rounded-2xl bg-indigo-600 text-white font-black uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95">
          <Plus size={22} /> Nuova stampante
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 rounded-[2rem] bg-white border text-slate-500 font-bold">Caricamento stampanti...</div>
      ) : sorted.length === 0 ? (
        <div className="p-10 rounded-[2rem] bg-white border border-dashed border-slate-300 text-center space-y-3">
          <Printer className="mx-auto text-slate-300" size={54} />
          <h3 className="text-xl font-black text-slate-800 uppercase">Nessuna stampante configurata</h3>
          <p className="text-sm text-slate-500 font-bold">Aggiungi una stampante Browser per iniziare con una configurazione universale.</p>
          <button onClick={handleCreate} className="px-6 py-4 rounded-2xl bg-slate-900 text-white font-black uppercase">Aggiungi stampante</button>
        </div>
      ) : (
        <div className="grid gap-4">
          {sorted.map((printer) => {
            const driverStatus = DRIVER_STATUS[printer.connection?.driver || "browser"];
            return (
              <div key={printer.id} className="rounded-[2rem] bg-white border border-slate-200 p-5 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="flex items-start gap-4 min-w-0">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${printer.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>
                    <Printer size={28} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xl font-black text-slate-900 uppercase truncate">{printer.name}</h4>
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${printer.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{printer.enabled ? "attiva" : "spenta"}</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${driverStatus === "ready" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"}`}>{driverStatus === "ready" ? "funzionante" : "beta / non disponibile"}</span>
                    </div>
                    <p className="text-xs font-bold text-slate-500 uppercase mt-1">
                      {DRIVER_LABELS[printer.connection.driver]} · {getPaperWidthMm(printer)}mm · ruolo {printer.role} · reparto {printer.departmentId || "nessuno"} · copie {printer.copies || 1}
                    </p>
                    {printer.lastTest?.at && (
                      <p className={`text-xs font-black mt-2 flex items-center gap-1 ${printer.lastTest.ok ? "text-emerald-600" : "text-red-600"}`}>
                        {printer.lastTest.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />} Ultimo test: {printer.lastTest.ok ? "OK" : printer.lastTest.errorMessage || "fallito"}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <button onClick={() => handleTest(printer)} disabled={busyId === printer.id} className="px-4 py-3 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase disabled:opacity-50">Stampa test</button>
                  <button onClick={() => setPreview(printer)} className="px-4 py-3 rounded-xl bg-slate-100 text-slate-700 text-xs font-black uppercase flex items-center gap-1"><Eye size={15} /> Anteprima</button>
                  <button onClick={() => { setEditing(printer); setWizardOpen(true); }} className="px-4 py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase">Modifica</button>
                  <button onClick={() => confirm(`Eliminare ${printer.name}?`) && removePrinter(printer.id)} className="px-4 py-3 rounded-xl bg-red-50 text-red-600 text-xs font-black uppercase"><Trash2 size={15} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {wizardOpen && editing && (
        <PrinterWizard
          draft={editing}
          departments={departments}
          onChange={setEditing}
          onCancel={() => { setWizardOpen(false); setEditing(null); }}
          onSave={handleSaveDraft}
          onTest={handleTest}
        />
      )}

      {preview && <PrinterPreview printer={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

function PrinterWizard({ draft, departments, onChange, onCancel, onSave, onTest }: {
  draft: PrinterProfile;
  departments: Department[];
  onChange: (p: PrinterProfile) => void;
  onCancel: () => void;
  onSave: (p: PrinterProfile) => void;
  onTest: (p: PrinterProfile) => void;
}) {
  const set = (patch: Partial<PrinterProfile>) => onChange({ ...draft, ...patch });
  const setConnection = (patch: Partial<PrinterProfile["connection"]>) => set({ connection: { ...draft.connection, ...patch } });
  const setPaper = (patch: Partial<PrinterProfile["paper"]>) => set({ paper: { ...draft.paper, ...patch } });

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white rounded-[3rem] p-8 shadow-2xl space-y-7 uppercase">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-3xl font-black text-slate-900 italic">Wizard stampante</h3>
            <p className="text-xs font-bold text-slate-500">Configurazione guidata per cliente finale.</p>
          </div>
          <button onClick={onCancel} className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 font-black">×</button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className={labelClass}>Step 1 · Tipo connessione</label>
            <select value={draft.connection.driver} onChange={(e) => setConnection({ driver: e.target.value as PrinterDriverType })} className={inputClass}>
              {DRIVER_OPTIONS.map((driver) => (
                <option key={driver} value={driver}>{DRIVER_LABELS[driver]} {DRIVER_STATUS[driver] === "beta" ? "— beta/non disponibile" : ""}</option>
              ))}
            </select>
            {DRIVER_STATUS[draft.connection.driver] === "beta" && (
              <p className="mt-2 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 normal-case">
                Questo driver è predisposto ma non ancora operativo: richiede bridge/driver hardware in una fase successiva. Per ora usa Browser.
              </p>
            )}
          </div>
          <div>
            <label className={labelClass}>Step 2 · Nome stampante</label>
            <input value={draft.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} placeholder="Es. Cassa principale" />
          </div>
          <div>
            <label className={labelClass}>Step 3 · Larghezza carta</label>
            <select value={String(draft.paper.width)} onChange={(e) => setPaper({ width: e.target.value === "custom" ? "custom" : Number(e.target.value) as PaperWidth })} className={inputClass}>
              <option value="58">58mm</option>
              <option value="72">72mm</option>
              <option value="80">80mm</option>
              <option value="custom">Personalizzata</option>
            </select>
          </div>
          {draft.paper.width === "custom" && (
            <div>
              <label className={labelClass}>Millimetri personalizzati</label>
              <input type="number" min={40} max={120} value={draft.paper.customMm || 80} onChange={(e) => setPaper({ customMm: Number(e.target.value) })} className={inputClass} />
            </div>
          )}
          <div>
            <label className={labelClass}>Step 4 · Ruolo</label>
            <select value={draft.role} onChange={(e) => set({ role: e.target.value as PrinterRole })} className={inputClass}>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Reparto associato</label>
            <select value={draft.departmentId || ""} onChange={(e) => set({ departmentId: e.target.value || null })} className={inputClass}>
              <option value="">Nessun reparto / ricevuta generale</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Copie</label>
            <input type="number" min={1} max={5} value={draft.copies || 1} onChange={(e) => set({ copies: Math.max(1, Number(e.target.value) || 1) })} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => set({ enabled: !draft.enabled })} className={`rounded-2xl p-4 font-black uppercase border-b-4 ${draft.enabled ? "bg-emerald-600 text-white border-emerald-800" : "bg-slate-100 text-slate-500 border-slate-300"}`}>Abilitata {draft.enabled ? "ON" : "OFF"}</button>
            <button onClick={() => set({ autoPrint: !draft.autoPrint })} className={`rounded-2xl p-4 font-black uppercase border-b-4 ${draft.autoPrint ? "bg-indigo-600 text-white border-indigo-800" : "bg-slate-100 text-slate-500 border-slate-300"}`}>Auto {draft.autoPrint ? "ON" : "OFF"}</button>
          </div>
        </div>

        {draft.connection.driver === "escpos-network" && (
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className={labelClass}>Host/IP bridge</label><input value={draft.connection.host || ""} onChange={(e) => setConnection({ host: e.target.value })} className={inputClass} placeholder="192.168.1.50" /></div>
            <div><label className={labelClass}>Porta</label><input type="number" value={draft.connection.port || 9100} onChange={(e) => setConnection({ port: Number(e.target.value) })} className={inputClass} /></div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100">
          <button onClick={() => onTest(draft)} className="flex-1 py-5 rounded-2xl bg-indigo-50 text-indigo-700 font-black uppercase border border-indigo-100">Step 6 · Stampa test</button>
          <button onClick={onCancel} className="flex-1 py-5 rounded-2xl bg-slate-100 text-slate-500 font-black uppercase">Annulla</button>
          <button onClick={() => onSave(draft)} className="flex-[2] py-5 rounded-2xl bg-slate-900 text-white font-black uppercase">Step 7 · Salva</button>
        </div>
      </div>
    </div>
  );
}

function PrinterPreview({ printer, onClose }: { printer: PrinterProfile; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[130] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] p-8 w-full max-w-md shadow-2xl uppercase space-y-6">
        <div className="flex justify-between items-center">
          <h3 className="text-2xl font-black text-slate-900 italic">Anteprima ticket</h3>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-100">×</button>
        </div>
        <div className="mx-auto bg-slate-50 border border-slate-200 shadow-inner p-4 text-sm font-mono normal-case" style={{ width: `${Math.min(getPaperWidthMm(printer) * 3.5, 320)}px` }}>
          <div className="text-center font-black uppercase">TEST STAMPANTE</div>
          <div className="text-center text-xs mb-3">{printer.name}</div>
          <div className="border-t border-dashed border-slate-500 my-2" />
          <div className="flex justify-between"><span>Ruolo</span><strong>{printer.role}</strong></div>
          <div className="flex justify-between"><span>Reparto</span><strong>{printer.departmentId || "nessuno"}</strong></div>
          <div className="flex justify-between"><span>Carta</span><strong>{getPaperWidthMm(printer)}mm</strong></div>
          <div className="border-t border-dashed border-slate-500 my-2" />
          <div className="text-center text-xs">Anteprima layout browser</div>
        </div>
      </div>
    </div>
  );
}
