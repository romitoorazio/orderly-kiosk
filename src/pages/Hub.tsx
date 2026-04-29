import { Link } from "@tanstack/react-router";
import {
  Monitor,
  ChefHat,
  CreditCard,
  Settings,
  Tv,
  Gamepad2,
  Users,
  LogOut,
} from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import type { FeatureFlags } from "@/lib/defaultFlags";

type ModuleKey = keyof FeatureFlags["modules"];

const ALL_LINKS: ReadonlyArray<{
  to: string;
  label: string;
  icon: typeof Monitor;
  color: string;
  module: ModuleKey;
}> = [
  { to: "/totem", label: "TOTEM", icon: Monitor, color: "bg-primary text-primary-foreground", module: "totem" },
  { to: "/cucina", label: "CUCINA", icon: ChefHat, color: "bg-kiosk-orange text-white", module: "cucina" },
  { to: "/cassa", label: "CASSA", icon: CreditCard, color: "bg-accent text-accent-foreground", module: "cassa" },
  { to: "/sala", label: "SALA TV", icon: Tv, color: "bg-secondary text-foreground", module: "sala" },
  { to: "/gioca", label: "GIOCA", icon: Gamepad2, color: "bg-primary text-primary-foreground", module: "gioca" },
  { to: "/cameriere", label: "CAMERIERE", icon: Users, color: "bg-accent text-accent-foreground", module: "cameriere" },
];

const Hub = () => {
  const { logout } = useAdminAuth();
  const { flags } = useFeatureFlags();

  // L'admin è sempre raggiungibile da qui (non gated dal modules toggle).
  const links = ALL_LINKS.filter((l) => flags.modules[l.module]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 gap-8">
      <h1 className="text-4xl font-black text-foreground tracking-tight">
        PANNELLO CENTRALE
      </h1>
      <div className="grid grid-cols-2 gap-4 w-full max-w-md">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className={`${l.color} rounded-2xl p-6 flex flex-col items-center gap-3 shadow-lg active:scale-95 transition-transform`}
          >
            <l.icon size={36} />
            <span className="text-lg font-black">{l.label}</span>
          </Link>
        ))}
        <Link
          to="/admin"
          className="bg-muted text-foreground rounded-2xl p-6 flex flex-col items-center gap-3 shadow-lg active:scale-95 transition-transform"
        >
          <Settings size={36} />
          <span className="text-lg font-black">ADMIN</span>
        </Link>
      </div>
      {links.length === 0 && (
        <p className="text-sm text-muted-foreground max-w-sm text-center">
          Nessun modulo operativo attivo. Vai in <strong>Admin → Moduli</strong> per accenderne almeno uno.
        </p>
      )}
      <button
        onClick={() => {
          logout();
          if (typeof window !== "undefined") window.location.href = "/";
        }}
        className="mt-4 flex items-center gap-2 px-6 py-3 rounded-xl bg-destructive/20 text-destructive font-bold text-sm active:scale-95 transition-transform"
      >
        <LogOut size={18} /> ESCI (LOGOUT ADMIN)
      </button>
    </div>
  );
};

export default Hub;
