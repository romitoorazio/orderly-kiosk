import { useState, useEffect, useCallback, useRef } from 'react';

const ADMIN_AUTH_KEY = 'orazio_admin_auth';
const ADMIN_TIMEOUT = 30 * 60 * 1000; // 30 min inactivity timeout

interface AdminAuthState {
  authenticated: boolean;
  expiresAt: number;
}

export function useAdminAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // SSR-safe: leggo sessionStorage solo dopo mount
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const stored = sessionStorage.getItem(ADMIN_AUTH_KEY);
      if (!stored) return;
      const state: AdminAuthState = JSON.parse(stored);
      if (state.authenticated && state.expiresAt > Date.now()) {
        setIsAuthenticated(true);
      }
    } catch {
      /* noop */
    }
  }, []);

  const timeoutRef = useRef<any>(null);

  const refreshTimeout = useCallback(() => {
    if (!isAuthenticated) return;
    if (typeof window === "undefined") return;
    const expiresAt = Date.now() + ADMIN_TIMEOUT;
    sessionStorage.setItem(
      ADMIN_AUTH_KEY,
      JSON.stringify({ authenticated: true, expiresAt }),
    );
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsAuthenticated(false);
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
    }, ADMIN_TIMEOUT);
  }, [isAuthenticated]);

  const login = useCallback(() => {
    setIsAuthenticated(true);
    const expiresAt = Date.now() + ADMIN_TIMEOUT;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        ADMIN_AUTH_KEY,
        JSON.stringify({ authenticated: true, expiresAt }),
      );
    }
  }, []);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  // Set up inactivity tracking
  useEffect(() => {
    if (!isAuthenticated) return;
    if (typeof document === "undefined") return;
    refreshTimeout();
    const events = ["mousedown", "touchstart", "keydown", "scroll"] as const;
    const handler = () => refreshTimeout();
    events.forEach((e) => document.addEventListener(e, handler));
    return () => {
      events.forEach((e) => document.removeEventListener(e, handler));
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isAuthenticated, refreshTimeout]);

  return { isAuthenticated, login, logout };
}
