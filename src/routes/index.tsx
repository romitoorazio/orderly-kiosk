import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";
import ModuleGate from "@/components/ModuleGate";

// La rotta `/` è il totem cliente. Se il modulo totem viene disattivato in
// Admin → Moduli, mostriamo il messaggio "Servizio sospeso" anche qui per
// coerenza con la rotta `/totem`.
export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <ModuleGate module="totem">
      <Index />
    </ModuleGate>
  );
}
