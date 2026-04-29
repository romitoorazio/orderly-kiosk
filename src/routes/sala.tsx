import { createFileRoute } from "@tanstack/react-router";
import SalaTvDisplay from "@/pages/SalaTvDisplay";
import ModuleGate from "@/components/ModuleGate";

export const Route = createFileRoute("/sala")({
  component: SalaPage,
});

function SalaPage() {
  return (
    <ModuleGate module="sala">
      <SalaTvDisplay />
    </ModuleGate>
  );
}
