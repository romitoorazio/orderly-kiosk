// useFeatureFlags — listener realtime su `settings/features`.
//
// Espone i flag con merge sui DEFAULT_FLAGS, così che:
// - se il documento non esiste → default (parity A.1, niente cambia)
// - se esiste con un sottoinsieme di campi → vengono sovrascritti solo quelli
//
// Bridge globale `window.__FEATURE_FLAGS__`: serve a componenti che girano
// fuori dal tree React (route guards, helper di stampa) per leggere i flag
// senza dover passare dal contesto.

import { useEffect, useMemo, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { APP_ID, db } from "@/lib/firebase";
import {
  DEFAULT_FLAGS,
  mergeFlags,
  type FeatureFlags,
} from "@/lib/defaultFlags";

const featuresRef = () =>
  doc(db, "artifacts", APP_ID, "public", "data", "settings", "features");

export function useFeatureFlags() {
  const [remote, setRemote] = useState<Partial<FeatureFlags> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      featuresRef(),
      (snap) => {
        const data = snap.exists()
          ? (snap.data() as Partial<FeatureFlags>)
          : null;
        setRemote(data);
        setLoading(false);
        if (typeof window !== "undefined") {
          (window as unknown as { __FEATURE_FLAGS__?: FeatureFlags }).__FEATURE_FLAGS__ =
            mergeFlags(data);
        }
      },
      (err) => {
        console.warn("[useFeatureFlags] error", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const flags = useMemo(() => mergeFlags(remote), [remote]);

  return { flags, loading, error, isUsingDefault: !remote };
}

/** Lettura sincrona dei flag (fuori da React). Restituisce DEFAULT_FLAGS se il bridge non è ancora pronto. */
export function readFeatureFlagsSync(): FeatureFlags {
  if (typeof window === "undefined") return DEFAULT_FLAGS;
  const w = window as unknown as { __FEATURE_FLAGS__?: FeatureFlags };
  return w.__FEATURE_FLAGS__ ?? DEFAULT_FLAGS;
}

/** Salva un patch parziale dei flag (deep merge lato Firestore tramite `setDoc(merge:true)`). */
export async function saveFeatureFlags(patch: Partial<FeatureFlags>): Promise<void> {
  await setDoc(featuresRef(), patch, { merge: true });
}
