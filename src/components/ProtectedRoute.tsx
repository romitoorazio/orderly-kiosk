// Wrapper PIN-protected. Legge il PIN admin (caricato live da Firestore in __root.tsx
// e propagato via window.__ADMIN_PIN__) e blocca l'accesso finché non viene digitato
// correttamente. Compat TanStack: niente react-router.
import React, { useEffect, useState } from "react";
import PinModal from "@/components/totem/PinModal";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  /** Override esplicito; se assente legge da window.__ADMIN_PIN__ */
  adminPin?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, adminPin }) => {
  const { isAuthenticated, login } = useAdminAuth();
  const [pin, setPin] = useState<string | undefined>(adminPin);

  // Sync con il PIN live esposto da AuthBridge in __root.tsx
  useEffect(() => {
    if (adminPin) {
      setPin(adminPin);
      return;
    }
    if (typeof window === "undefined") return;
    const tick = () => {
      const w = (window as any).__ADMIN_PIN__;
      if (typeof w === "string" && w) setPin(w);
    };
    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [adminPin]);

  if (!isAuthenticated) {
    return (
      <PinModal
        correctPin={pin}
        onSuccess={login}
        onCancel={() => {
          if (typeof window !== "undefined") window.location.href = "/";
        }}
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
