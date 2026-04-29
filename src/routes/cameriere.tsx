import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import ModuleGate from "@/components/ModuleGate";
import CameriereView from "@/pages/CameriereView";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

export const Route = createFileRoute("/cameriere")({
  component: CamerierePage,
});

function CamerierePage() {
  return (
    <ModuleGate module="cameriere">
      <WaiterPinGate>
        <CameriereView />
      </WaiterPinGate>
    </ModuleGate>
  );
}

function WaiterPinGate({ children }: { children: ReactNode }) {
  const { flags, loading } = useFeatureFlags();
  const [pin, setPin] = useState("");
  const [ok, setOk] = useState(false);

  if (loading) return <>{children}</>;
  if (!flags.waiter.requirePin || ok) return <>{children}</>;

  const expected = String(flags.waiter.pin || "1234");
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans uppercase">
      <div className="w-full max-w-sm bg-white text-slate-900 rounded-[3rem] p-8 shadow-2xl space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-black italic">Accesso cameriere</h1>
          <p className="text-xs font-bold text-slate-500 mt-2">Inserisci il PIN configurato in Admin.</p>
        </div>
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
          type="password"
          inputMode="numeric"
          className="w-full p-5 rounded-2xl bg-slate-100 text-center text-3xl font-black tracking-[0.5em] outline-none focus:ring-4 focus:ring-indigo-200"
          placeholder="••••"
        />
        <button
          onClick={() => (pin === expected ? setOk(true) : alert("PIN cameriere errato"))}
          className="w-full py-5 rounded-2xl bg-indigo-600 text-white font-black text-lg active:scale-95"
        >
          Entra
        </button>
        <a href="/hub" className="block text-center text-xs font-black text-slate-400">Torna al hub</a>
      </div>
    </div>
  );
}
