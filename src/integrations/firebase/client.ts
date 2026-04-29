// Compat shim — alcune nuove parti del codice (Fase A) importavano da qui.
// Ora il singleton vive in src/lib/firebase.ts. Riesporto per non rompere import.
export {
  auth,
  db,
  storage,
  APP_ID,
  initAnalyticsIfSupported,
} from "@/lib/firebase";
import { auth, db } from "@/lib/firebase";
import type { FirebaseApp } from "firebase/app";
import { getApp } from "firebase/app";

export const getDb = () => db;
export const getFirebaseAuth = () => auth;
export const getFirebaseApp = (): FirebaseApp => getApp();
