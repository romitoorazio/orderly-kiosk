// Firebase singleton — porting fedele del lib originale, ma istanzia
// l'app una sola volta (compat con TanStack Start dev / HMR / SSR).
// Le credenziali sono web (publishable) — possono essere committate.
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const env = (key: string, fallback: string) => {
  // import.meta.env esiste sia client che server in Vite
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v = (import.meta as any).env?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
};

const firebaseConfig = {
  apiKey: env("VITE_FIREBASE_API_KEY", "AIzaSyD8OM2EFQtKGvo9DOE12X47hCRrWkclPDQ"),
  authDomain: env(
    "VITE_FIREBASE_AUTH_DOMAIN",
    "da-orazio-whitelabel-test.firebaseapp.com",
  ),
  projectId: env("VITE_FIREBASE_PROJECT_ID", "da-orazio-whitelabel-test"),
  storageBucket: env(
    "VITE_FIREBASE_STORAGE_BUCKET",
    "da-orazio-whitelabel-test.firebasestorage.app",
  ),
  messagingSenderId: env("VITE_FIREBASE_MESSAGING_SENDER_ID", "455108740025"),
  appId: env(
    "VITE_FIREBASE_APP_ID",
    "1:455108740025:web:ba0e2b71c19f2c87dc2c68",
  ),
};

export const APP_ID = env("VITE_APP_ID", "da-orazio-whitelabel");

function ensureApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

const _app = ensureApp();
export const auth: Auth = getAuth(_app);
export const db: Firestore = getFirestore(_app);
export const storage: FirebaseStorage = getStorage(_app);

/** Lazy + isSupported — evita crash SSR. */
export async function initAnalyticsIfSupported(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { isSupported, getAnalytics } = await import("firebase/analytics");
    if (await isSupported()) getAnalytics(_app);
  } catch {
    /* noop */
  }
}
