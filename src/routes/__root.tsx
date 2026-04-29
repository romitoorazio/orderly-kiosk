import {
  Outlet,
  createRootRoute,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
import { useAdminPin } from "@/hooks/useAdminPin";
import { initAnalyticsIfSupported } from "@/lib/firebase";

import appCss from "../styles.css?url";

const queryClient = new QueryClient();

/**
 * AdminPinContext: il PIN admin è caricato live da Firestore (settings/admin)
 * dopo l'auth Firebase anonima. Lo esponiamo a ProtectedRoute via window
 * (porting fedele del pattern originale dove il PIN era propagato via prop
 * dall'App.tsx). In Fase A.1 manteniamo questa semplificazione.
 */
function AuthBridge() {
  const { user } = useFirebaseAuth();
  const adminPin = useAdminPin(user);
  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).__ADMIN_PIN__ = adminPin;
  }, [adminPin]);
  useEffect(() => {
    void initAnalyticsIfSupported();
  }, []);
  return null;
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Pagina non trovata</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          Torna alla home
        </a>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Da Orazio — Totem" },
      { name: "description", content: "Sistema cassa/totem self-service Da Orazio." },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthBridge />
        <Toaster />
        <Sonner />
        <Outlet />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
