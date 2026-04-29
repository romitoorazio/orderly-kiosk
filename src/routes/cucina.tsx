import { createFileRoute } from "@tanstack/react-router";
import ProtectedRoute from "@/components/ProtectedRoute";
import KitchenDisplay from "@/pages/KitchenDisplay";
import ModuleGate from "@/components/ModuleGate";

export const Route = createFileRoute("/cucina")({
  component: CucinaPage,
});

function CucinaPage() {
  return (
    <ModuleGate module="cucina">
      <ProtectedRoute>
        <KitchenDisplay />
      </ProtectedRoute>
    </ModuleGate>
  );
}
