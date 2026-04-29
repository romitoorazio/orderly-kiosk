// ModuleDisabled — schermata mostrata quando un modulo è stato disattivato in Admin → Moduli.
// Fase A.2.1.
import { Link } from "@tanstack/react-router";
import { PowerOff } from "lucide-react";

export default function ModuleDisabled({
  name,
  description,
}: {
  name: string;
  description?: string;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center gap-6">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
        <PowerOff size={40} className="text-muted-foreground" />
      </div>
      <div className="space-y-2 max-w-md">
        <h1 className="text-3xl font-black text-foreground">{name} non disponibile</h1>
        <p className="text-muted-foreground">
          {description ??
            "Questo servizio è temporaneamente sospeso. Riattivalo da Admin → Moduli quando vuoi."}
        </p>
      </div>
      <Link
        to="/admin"
        className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity"
      >
        Vai all'Admin
      </Link>
    </div>
  );
}
