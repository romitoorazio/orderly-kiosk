/**
 * Firebase config — chiavi pubbliche del web SDK.
 * Sicuro committarle: la sicurezza reale è applicata dalle Firestore Security Rules.
 * Sovrascrivibili via VITE_FIREBASE_* per deploy multi-tenant.
 */
export const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ??
    "AIzaSyD8OM2EFQtKGvo9DOE12X47hCRrWkclPDQ",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ??
    "da-orazio-whitelabel-test.firebaseapp.com",
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID ??
    "da-orazio-whitelabel-test",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ??
    "da-orazio-whitelabel-test.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? "455108740025",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ??
    "1:455108740025:web:ba0e2b71c19f2c87dc2c68",
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? "G-1FZ7QMVP33",
};
