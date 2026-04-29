import { useState, useEffect, useRef, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db, APP_ID } from '@/lib/firebase';
import { resolveBackendUrl } from '@/lib/constants';

type ConnectivityStatus = 'online' | 'offline' | 'degraded';

function resolveHealthUrl(backendUrl?: string): string {
  const normalized = resolveBackendUrl(backendUrl, typeof window !== 'undefined' ? window.location.origin : undefined);
  const separator = normalized.includes('?') ? '&' : '?';
  return `${normalized}${separator}health=1`;
}

export function useOffline(backendUrl?: string): { isOffline: boolean; status: ConnectivityStatus } {
  const [networkOffline, setNetworkOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [firebaseReachable, setFirebaseReachable] = useState(true);
  const [backendReachable, setBackendReachable] = useState(true);

  const checkTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkingRef = useRef(false);

  const checkConnectivity = useCallback(async () => {
    if (typeof navigator === 'undefined') return;
    if (checkingRef.current) return;

    checkingRef.current = true;

    try {
      if (!navigator.onLine) {
        setFirebaseReachable(false);
        setBackendReachable(false);
        return;
      }

      const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'settings', 'printer');

      const [firebaseResult, backendResult] = await Promise.allSettled([
        Promise.race([
          getDoc(ref),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
        ]),
        Promise.race([
          fetch(resolveHealthUrl(backendUrl), {
            method: 'GET',
            cache: 'no-store',
            headers: { Accept: 'application/json' },
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
        ]),
      ]);

      setFirebaseReachable(firebaseResult.status === 'fulfilled');
      setBackendReachable(
        backendResult.status === 'fulfilled' &&
          backendResult.value instanceof Response &&
          backendResult.value.ok
      );
    } catch {
      setFirebaseReachable(false);
      setBackendReachable(false);
    } finally {
      checkingRef.current = false;
    }
  }, [backendUrl]);

  useEffect(() => {
    const goOnline = () => {
      setNetworkOffline(false);
      void checkConnectivity();
    };

    const goOffline = () => {
      setNetworkOffline(true);
      setFirebaseReachable(false);
      setBackendReachable(false);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    void checkConnectivity();
    checkTimer.current = setInterval(() => {
      void checkConnectivity();
    }, 45000);

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
      if (checkTimer.current) clearInterval(checkTimer.current);
    };
  }, [checkConnectivity]);

  const serviceReachable = firebaseReachable && backendReachable;

  const isOffline = networkOffline;

  const status: ConnectivityStatus = networkOffline
    ? 'offline'
    : !serviceReachable
      ? 'degraded'
      : 'online';

  return { isOffline, status };
}
