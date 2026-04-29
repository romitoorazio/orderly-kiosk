// ModulesTab — pannello Admin "MODULI" (Fase A.2.1).
//
// Centro di controllo: ogni funzione del software ha qui un toggle.
// Le modifiche sono salvate in realtime su `settings/features` e tutta l'app
// (route guard, Hub, totem, cassa, cucina) reagisce automaticamente.
//
// Vincolo parity: i default in `DEFAULT_FLAGS` riproducono il comportamento
// del vecchio Da Orazio Totem. Se il cliente non tocca nulla, niente cambia.

import { useEffect, useState } from "react";
import { Save, RotateCcw, Info } from "lucide-react";
import {
  useFeatureFlags,
  saveFeatureFlags,
} from "@/hooks/useFeatureFlags";
import { DEFAULT_FLAGS, type FeatureFlags } from "@/lib/defaultFlags";

type Section = keyof FeatureFlags;

type ToggleRow = {
  key: string;
  label: string;
  description?: string;
  badge?: string;
};

const MODULES_ROWS: ToggleRow[] = [
  { key: "totem", label: "Totem cliente", description: "Schermata self-service per il cliente in negozio." },
  { key: "cassa", label: "Cassa", description: "Vista cassa per operatore (PIN protetta)." },
  { key: "cucina", label: "Cucina / Reparti", description: "Display di preparazione ordini." },
  { key: "sala", label: "Sala TV", description: "Display ordini pronti per il cliente." },
  { key: "gioca", label: "Gioco / Promo", description: "Ruota della fortuna o gioco promozionale." },
  { key: "hub", label: "Hub navigazione", description: "Pannello centrale con accesso a tutti i moduli." },
  { key: "cameriere", label: "Cameriere (mobile)", description: "Modulo cameriere per tablet/smartphone.", badge: "Admin → Cameriere" },
];

const PAYMENTS_ROWS: ToggleRow[] = [
  { key: "cash", label: "Contanti", description: "Pagamento alla cassa in contanti." },
  { key: "card", label: "Carta (terminale fisico)", description: "Pagamento con terminale POS esterno." },
  { key: "sumup", label: "SumUp integrato", description: "Pagamento carta tramite lettore SumUp.", badge: "Configurazione richiesta" },
];

const ORDER_MODES_ROWS: ToggleRow[] = [
  { key: "takeaway", label: "Asporto", description: "Ordine da portare via." },
  { key: "table", label: "Al tavolo", description: "Ordine associato a un numero tavolo." },
  { key: "counter", label: "Al banco", description: "Ordine consumato sul posto al banco." },
  { key: "delivery", label: "Consegna", description: "Ordine in delivery (richiede dati cliente)." },
];

const CATALOG_ROWS: ToggleRow[] = [
  { key: "productNotes", label: "Note prodotto", description: "Il cliente può aggiungere note libere." },
  { key: "variants", label: "Varianti / Formati", description: "Più formati per uno stesso prodotto." },
  { key: "extras", label: "Extra / Aggiunte", description: "Ingredienti extra a pagamento." },
  { key: "allergens", label: "Allergeni", description: "Mostra simboli allergeni sui prodotti." },
  { key: "imageRequired", label: "Immagine obbligatoria", description: "I prodotti senza immagine non sono pubblicabili." },
];

const RECEIPT_ROWS: ToggleRow[] = [
  { key: "showLogo", label: "Logo sullo scontrino", description: "Stampa il logo dell'attività in alto." },
  { key: "showVat", label: "Mostra IVA", description: "Riga IVA visibile sullo scontrino." },
  { key: "showQr", label: "QR code sullo scontrino", description: "Aggiunge un QR (recensione, fidelity, sito)." },
];

function ToggleRowItem({
  row,
  value,
  onChange,
  disabled,
}: {
  row: ToggleRow;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border bg-white ${disabled ? "opacity-60" : ""}`}>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
          value ? "bg-emerald-500" : "bg-slate-300"
        } ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
            value ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-900">{row.label}</span>
          {row.badge && (
            <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              {row.badge}
            </span>
          )}
        </div>
        {row.description && (
          <p className="text-xs text-slate-500 mt-0.5">{row.description}</p>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
      <div>
        <h3 className="text-lg font-black text-slate-900">{title}</h3>
        {description && (
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">{children}</div>
    </div>
  );
}

export default function ModulesTab() {
  const { flags, loading } = useFeatureFlags();
  const [draft, setDraft] = useState<FeatureFlags>(flags);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // Sincronizza il draft quando arriva un nuovo snapshot da Firestore.
  useEffect(() => {
    if (!loading) setDraft(flags);
  }, [loading, flags]);

  const setSection = <S extends Section>(section: S, patch: Partial<FeatureFlags[S]>) => {
    setDraft((prev) => ({ ...prev, [section]: { ...prev[section], ...patch } }));
  };

  const handleSave = async () => {
    setSaving(true);
    setErr(null);
    try {
      await saveFeatureFlags(draft);
      setSavedAt(Date.now());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm("Ripristinare tutti i moduli ai valori predefiniti? I tuoi cambi non salvati verranno persi.")) return;
    setDraft(DEFAULT_FLAGS);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
        <Info size={18} className="text-blue-600 mt-0.5 shrink-0" />
        <div className="text-sm text-blue-900">
          <strong>Centro di controllo.</strong> Da qui attivi o disattivi ogni funzione del software senza modificare il codice. I cambiamenti diventano effettivi appena salvi.
        </div>
      </div>

      <SectionCard
        title="Moduli attivi"
        description="Quali parti del software sono disponibili. Se disattivi un modulo, la sua pagina non sarà accessibile."
      >
        {MODULES_ROWS.map((row) => (
          <ToggleRowItem
            key={row.key}
            row={row}
            value={Boolean(draft.modules[row.key as keyof typeof draft.modules])}
            onChange={(v) =>
              setSection("modules", { [row.key]: v } as Partial<FeatureFlags["modules"]>)
            }
          />
        ))}
      </SectionCard>

      <SectionCard
        title="Pagamenti accettati"
        description="Metodi di pagamento mostrati al cliente. Almeno uno deve essere attivo."
      >
        {PAYMENTS_ROWS.map((row) => (
          <ToggleRowItem
            key={row.key}
            row={row}
            value={Boolean(draft.payments[row.key as keyof typeof draft.payments])}
            onChange={(v) =>
              setSection("payments", { [row.key]: v } as Partial<FeatureFlags["payments"]>)
            }
          />
        ))}
      </SectionCard>

      <SectionCard
        title="Modalità ordine"
        description="Tipi di ordine selezionabili: asporto, tavolo, banco, consegna."
      >
        {ORDER_MODES_ROWS.map((row) => (
          <ToggleRowItem
            key={row.key}
            row={row}
            value={Boolean(draft.orderModes[row.key as keyof typeof draft.orderModes])}
            onChange={(v) =>
              setSection("orderModes", { [row.key]: v } as Partial<FeatureFlags["orderModes"]>)
            }
          />
        ))}
      </SectionCard>

      <SectionCard
        title="Catalogo"
        description="Cosa il cliente può personalizzare sui prodotti."
      >
        {CATALOG_ROWS.map((row) => (
          <ToggleRowItem
            key={row.key}
            row={row}
            value={Boolean(draft.catalog[row.key as keyof typeof draft.catalog])}
            onChange={(v) =>
              setSection("catalog", { [row.key]: v } as Partial<FeatureFlags["catalog"]>)
            }
          />
        ))}
      </SectionCard>

      <SectionCard
        title="Scontrino"
        description="Cosa appare sullo scontrino stampato."
      >
        {RECEIPT_ROWS.map((row) => (
          <ToggleRowItem
            key={row.key}
            row={row}
            value={Boolean(draft.receipt[row.key as keyof typeof draft.receipt])}
            onChange={(v) =>
              setSection("receipt", { [row.key]: v } as Partial<FeatureFlags["receipt"]>)
            }
          />
        ))}
        {draft.receipt.showQr && (
          <div className="sm:col-span-2 p-4 rounded-xl border bg-white">
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">
              URL del QR code
            </label>
            <input
              type="url"
              value={draft.receipt.qrUrl}
              onChange={(e) => setSection("receipt", { qrUrl: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </SectionCard>

      {/* Sezione Beeper e Stampanti placeholder — implementate in A.2.2 e A.2.3 con UI dedicata */}
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 space-y-2">
        <h3 className="text-lg font-black text-slate-900">In arrivo</h3>
        <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
          <li><strong>Beeper</strong> opzionali con range configurabile (Fase A.2.2)</li>
          <li><strong>Stampanti</strong>: wizard guidato con scelta larghezza carta, ruolo, reparto (Fase A.2.3)</li>
          <li><strong>Cameriere</strong>: rotta mobile-first con tavoli (Fase A.2.4)</li>
        </ul>
      </div>

      {/* Action bar */}
      <div className="sticky bottom-4 flex flex-wrap items-center gap-3 p-4 rounded-2xl bg-slate-900 text-white shadow-2xl">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-sm disabled:opacity-50 transition-colors"
        >
          <Save size={16} />
          {saving ? "Salvataggio…" : "SALVA MODIFICHE"}
        </button>
        <button
          onClick={handleReset}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs transition-colors"
        >
          <RotateCcw size={14} /> Ripristina default
        </button>
        {savedAt && !err && (
          <span className="text-xs text-emerald-300">
            Salvato {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
        {err && (
          <span className="text-xs text-red-300">Errore: {err}</span>
        )}
      </div>
    </div>
  );
}
