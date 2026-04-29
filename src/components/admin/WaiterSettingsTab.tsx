import { useEffect, useState } from "react";
import { Info, Save } from "lucide-react";
import { saveFeatureFlags, useFeatureFlags } from "@/hooks/useFeatureFlags";
import { DEFAULT_FLAGS, type FeatureFlags } from "@/lib/defaultFlags";
import type { Department } from "@/lib/constants";

const inputClass = "w-full p-4 rounded-xl bg-slate-100 border-2 border-slate-200 focus:border-indigo-500 focus:bg-white outline-none transition-all text-slate-900 font-bold placeholder:text-slate-400";
const labelClass = "text-xs font-black text-slate-500 mb-1 ml-1 uppercase tracking-widest";

type WaiterFlags = FeatureFlags["waiter"];

export default function WaiterSettingsTab({ departments }: { departments: Department[] }) {
  const { flags } = useFeatureFlags();
  const [draft, setDraft] = useState<WaiterFlags>(flags.waiter || DEFAULT_FLAGS.waiter);
  const [moduleEnabled, setModuleEnabled] = useState<boolean>(flags.modules.cameriere);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDraft(flags.waiter || DEFAULT_FLAGS.waiter);
    setModuleEnabled(flags.modules.cameriere);
  }, [flags]);

  const patch = (p: Partial<WaiterFlags>) => setDraft((prev) => ({ ...prev, ...p }));

  const toggleDept = (id: string) => {
    const current = new Set(draft.visibleDepartmentIds || []);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    patch({ visibleDepartmentIds: Array.from(current) });
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    await saveFeatureFlags({ modules: { ...flags.modules, cameriere: moduleEnabled }, waiter: draft });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <div className="space-y-8">
      <div className="rounded-[2rem] border border-blue-200 bg-blue-50 p-5 flex gap-3 text-blue-900 normal-case">
        <Info size={20} className="shrink-0 mt-0.5" />
        <div className="text-sm font-bold">
          Il modulo cameriere è pensato per tablet/smartphone: selezione tavolo, catalogo, carrello e invio ordine al reparto. È spento di default e va attivato da qui.
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <ToggleCard title="Funzione cameriere" description="Abilita la rotta /cameriere e la voce Hub." value={moduleEnabled} onChange={setModuleEnabled} />
        <ToggleCard title="Richiedi PIN cameriere" description="Se spento, la pagina cameriere apre direttamente." value={draft.requirePin} onChange={(v) => patch({ requirePin: v })} />
        <ToggleCard title="Crea ordini da tavolo" description="Permette al cameriere di creare ordini associati al tavolo." value={draft.canCreateOrders} onChange={(v) => patch({ canCreateOrders: v })} />
        <ToggleCard title="Segna servito/consegnato" description="Permette la chiusura degli ordini tavolo." value={draft.canMarkServed} onChange={(v) => patch({ canMarkServed: v })} />
        <ToggleCard title="Richiedi conto" description="Mostra il pulsante conto nella vista cameriere." value={draft.canRequestBill} onChange={(v) => patch({ canRequestBill: v })} />
        <ToggleCard title="Ristampa conto/comanda" description="Mostra i comandi di ristampa se le stampanti sono configurate." value={draft.canReprint} onChange={(v) => patch({ canReprint: v })} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label className={labelClass}>PIN cameriere</label>
          <input value={draft.pin} onChange={(e) => patch({ pin: e.target.value.replace(/\D/g, "").slice(0, 8) })} className={inputClass + " text-center tracking-[0.4em]"} type="password" placeholder="1234" />
        </div>
        <div>
          <label className={labelClass}>Tavoli / postazioni</label>
          <input value={(draft.tables || []).join(", ")} onChange={(e) => patch({ tables: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} className={inputClass} placeholder="1, 2, 3, Terrazza" />
        </div>
      </div>

      <div className="rounded-[2rem] bg-slate-50 border border-slate-200 p-6 space-y-4">
        <h3 className="text-xl font-black text-slate-900 uppercase italic">Reparti visibili al cameriere</h3>
        <p className="text-xs font-bold text-slate-500 uppercase">Se non selezioni nulla, il cameriere vede tutti i reparti.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {departments.map((dept) => {
            const selected = (draft.visibleDepartmentIds || []).includes(dept.id);
            return (
              <button key={dept.id} onClick={() => toggleDept(dept.id)} className={`p-4 rounded-2xl border-b-4 font-black uppercase active:scale-95 ${selected ? "bg-indigo-600 text-white border-indigo-800" : "bg-white text-slate-500 border-slate-200"}`}>
                {dept.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        {saved && <span className="self-center text-sm font-black text-emerald-600 uppercase">Salvato</span>}
        <button onClick={save} disabled={saving} className="px-8 py-5 rounded-2xl bg-slate-900 text-white font-black uppercase flex items-center gap-2 disabled:opacity-50"><Save size={20} /> Salva cameriere</button>
      </div>
    </div>
  );
}

function ToggleCard({ title, description, value, onChange }: { title: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="p-5 rounded-[2rem] bg-white border border-slate-200 flex items-center justify-between gap-4">
      <div>
        <h3 className="text-lg font-black text-slate-900 uppercase">{title}</h3>
        <p className="text-xs font-bold text-slate-500 uppercase">{description}</p>
      </div>
      <button onClick={() => onChange(!value)} className={`w-20 h-10 rounded-full p-1 transition ${value ? "bg-emerald-500" : "bg-slate-300"}`}>
        <span className={`block w-8 h-8 rounded-full bg-white shadow transition ${value ? "translate-x-10" : "translate-x-0"}`} />
      </button>
    </div>
  );
}
