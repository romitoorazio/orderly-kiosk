// ModuleGate — wrapper che mostra ModuleDisabled se il flag del modulo è off.
// Usa useFeatureFlags realtime: se l'admin disattiva un modulo, le tab aperte
// reagiscono entro pochi secondi.
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import ModuleDisabled from "./ModuleDisabled";
import type { FeatureFlags } from "@/lib/defaultFlags";

type ModuleKey = keyof FeatureFlags["modules"];

const MODULE_LABELS: Record<ModuleKey, string> = {
  totem: "Totem cliente",
  cassa: "Cassa",
  cucina: "Cucina",
  sala: "Sala TV",
  gioca: "Gioco",
  hub: "Hub",
  cameriere: "Cameriere",
};

export default function ModuleGate({
  module,
  children,
}: {
  module: ModuleKey;
  children: React.ReactNode;
}) {
  const { flags, loading } = useFeatureFlags();
  // Durante il primo load mostriamo i children: i default sono "tutto on"
  // (eccetto cameriere). Evita un flash di "disabilitato" all'avvio.
  if (loading) return <>{children}</>;
  if (!flags.modules[module]) {
    return <ModuleDisabled name={MODULE_LABELS[module]} />;
  }
  return <>{children}</>;
}
