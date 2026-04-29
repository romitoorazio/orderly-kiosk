import React, { useEffect, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { Save, Store, AlertTriangle } from "lucide-react";
import { APP_ID, db } from "@/lib/firebase";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import {
  DEFAULT_BUSINESS_SETTINGS,
  type BusinessSettings,
  useBusinessSettings,
} from "@/hooks/useBusinessSettings";
import ImageUploadField from "@/components/admin/ImageUploadField";

const businessSettingsRef = doc(
  db,
  "artifacts",
  APP_ID,
  "public",
  "data",
  "settings",
  "business"
);

const BusinessSettingsTab: React.FC = () => {
  const { user } = useFirebaseAuth();
  const { settings, loading, error, isUsingFallback } = useBusinessSettings(user);

  const [draft, setDraft] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const updateField = <K extends keyof BusinessSettings>(
    key: K,
    value: BusinessSettings[K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateText = (
    key: keyof BusinessSettings["texts"],
    value: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      texts: {
        ...prev.texts,
        [key]: value,
      },
    }));
  };

  const updateSocial = (
    key: keyof BusinessSettings["socials"],
    value: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      socials: {
        ...prev.socials,
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedMessage("");

    try {
      await setDoc(
        businessSettingsRef,
        {
          name: draft.name,
          tagline: draft.tagline,
          logoUrl: draft.logoUrl,
          faviconUrl: draft.faviconUrl || "",
          locale: draft.locale,
          currency: draft.currency,
          currencySymbol: draft.currencySymbol,
          socials: {
            instagram: draft.socials.instagram,
            facebook: draft.socials.facebook,
          },
          texts: {
            copyright: draft.texts.copyright,
            welcomeFooter: draft.texts.welcomeFooter,
            receiptThankYou: draft.texts.receiptThankYou,
            receiptPickupBeeper: draft.texts.receiptPickupBeeper,
            receiptPickupMonitor: draft.texts.receiptPickupMonitor,
            receiptPaidByCard: draft.texts.receiptPaidByCard,
            receiptPayAtCash: draft.texts.receiptPayAtCash,
          },
        },
        { merge: true }
      );

      setSavedMessage("Personalizzazione salvata.");
      setTimeout(() => setSavedMessage(""), 3000);
    } catch (err) {
      console.error("[BusinessSettingsTab] save failed", err);
      setSavedMessage(
        err instanceof Error
          ? `Errore salvataggio: ${err.message}`
          : "Errore salvataggio personalizzazione."
      );
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-slate-900 outline-none text-sm font-semibold bg-white";

  const labelClass =
    "block text-xs font-black uppercase tracking-widest text-slate-500 mb-2";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                <Store size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Brand & Testi
                </h2>
                <p className="text-sm text-slate-500 font-semibold">
                  Personalizza nome attività, logo, social e testi dello scontrino.
                </p>
              </div>
            </div>

            {isUsingFallback && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold">
                <AlertTriangle size={14} />
                Nessuna configurazione salvata: stai usando i valori default.
              </div>
            )}

            {error && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-bold">
                <AlertTriangle size={14} />
                Errore lettura configurazione: {error.message}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-sm shadow-lg"
          >
            <Save size={18} />
            {saving ? "SALVATAGGIO..." : "SALVA"}
          </button>
        </div>

        {savedMessage && (
          <div className="mb-6 px-4 py-3 rounded-2xl bg-slate-100 text-slate-800 text-sm font-bold">
            {savedMessage}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-8">
          <div className="space-y-4">
            <ImageUploadField
              value={draft.logoUrl}
              onChange={(url) => updateField("logoUrl", url)}
              folder="business"
              label="Logo attività"
            />

            <div className="text-xs text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-2xl p-4">
              Il logo caricato qui verrà salvato su Firebase Storage e usato da
              totem, monitor e scontrino quando i componenti leggono
              `settings/business`.
            </div>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Nome attività</label>
                <input
                  className={inputClass}
                  value={draft.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Da Orazio"
                />
              </div>

              <div>
                <label className={labelClass}>Tagline</label>
                <input
                  className={inputClass}
                  value={draft.tagline}
                  onChange={(e) => updateField("tagline", e.target.value)}
                  placeholder="Dal 1950"
                />
              </div>

              <div>
                <label className={labelClass}>Instagram</label>
                <input
                  className={inputClass}
                  value={draft.socials.instagram}
                  onChange={(e) => updateSocial("instagram", e.target.value)}
                  placeholder="https://www.instagram.com/..."
                />
              </div>

              <div>
                <label className={labelClass}>Facebook</label>
                <input
                  className={inputClass}
                  value={draft.socials.facebook}
                  onChange={(e) => updateSocial("facebook", e.target.value)}
                  placeholder="https://www.facebook.com/..."
                />
              </div>

              <div>
                <label className={labelClass}>Locale data/ora</label>
                <input
                  className={inputClass}
                  value={draft.locale}
                  onChange={(e) => updateField("locale", e.target.value)}
                  placeholder="it-IT"
                />
              </div>

              <div>
                <label className={labelClass}>Simbolo valuta</label>
                <input
                  className={inputClass}
                  value={draft.currencySymbol}
                  onChange={(e) => updateField("currencySymbol", e.target.value)}
                  placeholder="€"
                />
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-lg font-black text-slate-900 mb-4">
                Testi principali
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Footer welcome</label>
                  <input
                    className={inputClass}
                    value={draft.texts.welcomeFooter}
                    onChange={(e) => updateText("welcomeFooter", e.target.value)}
                    placeholder="PIZZASCHETTA E MARITATA"
                  />
                </div>

                <div>
                  <label className={labelClass}>Copyright</label>
                  <input
                    className={inputClass}
                    value={draft.texts.copyright}
                    onChange={(e) => updateText("copyright", e.target.value)}
                    placeholder="© 2026 ..."
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-lg font-black text-slate-900 mb-4">
                Testi scontrino
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Grazie</label>
                  <input
                    className={inputClass}
                    value={draft.texts.receiptThankYou}
                    onChange={(e) => updateText("receiptThankYou", e.target.value)}
                    placeholder="GRAZIE E BUON APPETITO!"
                  />
                </div>

                <div>
                  <label className={labelClass}>Ritiro campanello</label>
                  <input
                    className={inputClass}
                    value={draft.texts.receiptPickupBeeper}
                    onChange={(e) => updateText("receiptPickupBeeper", e.target.value)}
                    placeholder="RITIRA IL CAMPANELLO"
                  />
                </div>

                <div>
                  <label className={labelClass}>Guarda monitor</label>
                  <input
                    className={inputClass}
                    value={draft.texts.receiptPickupMonitor}
                    onChange={(e) => updateText("receiptPickupMonitor", e.target.value)}
                    placeholder="GUARDA IL MONITOR"
                  />
                </div>

                <div>
                  <label className={labelClass}>Pagato carta</label>
                  <input
                    className={inputClass}
                    value={draft.texts.receiptPaidByCard}
                    onChange={(e) => updateText("receiptPaidByCard", e.target.value)}
                    placeholder="PAGATO (CARTA/POS)"
                  />
                </div>

                <div>
                  <label className={labelClass}>Da pagare in cassa</label>
                  <input
                    className={inputClass}
                    value={draft.texts.receiptPayAtCash}
                    onChange={(e) => updateText("receiptPayAtCash", e.target.value)}
                    placeholder="DA PAGARE IN CASSA"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs text-slate-500 font-semibold leading-relaxed">
                Nota: il caricamento logo usa la cartella{" "}
                <code className="font-mono bg-white px-1 py-0.5 rounded">
                  uploads/business
                </code>
                . Prima del test online, nelle Firebase Storage Rules bisogna
                consentire anche la cartella <strong>business</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessSettingsTab;