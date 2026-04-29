import { createFileRoute } from "@tanstack/react-router";
import Index from "@/pages/Index";
import ModuleGate from "@/components/ModuleGate";

export const Route = createFileRoute("/totem")({
  component: TotemPage,
});

function TotemPage() {
  return (
    <ModuleGate module="totem">
      <Index />
    </ModuleGate>
  );
}
