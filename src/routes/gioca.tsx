import { createFileRoute } from "@tanstack/react-router";
import WheelGame from "@/pages/WheelGame";
import ModuleGate from "@/components/ModuleGate";

export const Route = createFileRoute("/gioca")({
  component: GiocaPage,
});

function GiocaPage() {
  return (
    <ModuleGate module="gioca">
      <WheelGame />
    </ModuleGate>
  );
}
