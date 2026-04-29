import { createFileRoute } from "@tanstack/react-router";
import ProtectedRoute from "@/components/ProtectedRoute";
import CassaView from "@/pages/CassaView";
import ModuleGate from "@/components/ModuleGate";

export const Route = createFileRoute("/cassa")({
  component: CassaPage,
});

function CassaPage() {
  return (
    <ModuleGate module="cassa">
      <ProtectedRoute>
        <CassaView />
      </ProtectedRoute>
    </ModuleGate>
  );
}
