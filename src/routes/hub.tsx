import { createFileRoute } from "@tanstack/react-router";
import ProtectedRoute from "@/components/ProtectedRoute";
import Hub from "@/pages/Hub";

export const Route = createFileRoute("/hub")({
  component: HubPage,
});

function HubPage() {
  return (
    <ProtectedRoute>
      <Hub />
    </ProtectedRoute>
  );
}
