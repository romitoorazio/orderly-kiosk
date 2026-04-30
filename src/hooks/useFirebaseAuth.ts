--- a/src/hooks/useFirebaseAuth.ts
+++ b/src/hooks/useFirebaseAuth.ts
@@ -2,33 +2,85 @@
 import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
 import { auth } from '@/lib/firebase';
 
+let anonymousAuthPromise: Promise<User> | null = null;
+
+export async function ensureFirebaseAuthReady(): Promise<User> {
+  if (auth.currentUser) return auth.currentUser;
+
+  if (!anonymousAuthPromise) {
+    anonymousAuthPromise = signInAnonymously(auth)
+      .then((credential) => credential.user)
+      .finally(() => {
+        anonymousAuthPromise = null;
+      });
+  }
+
+  return anonymousAuthPromise;
+}
+
 export function useFirebaseAuth() {
   const [user, setUser] = useState<User | null>(auth.currentUser);
   const [loading, setLoading] = useState(true);
+  const [error, setError] = useState<unknown | null>(null);
 
   useEffect(() => {
-    let cancelled = false;
+    let active = true;
 
     const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
-      if (cancelled) return;
-      setUser(nextUser);
-      setLoading(false);
+      if (!active) return;
+
+      if (nextUser) {
+        setUser(nextUser);
+        setError(null);
+        setLoading(false);
+        return;
+      }
+
+      // Firebase può notificare `null` per un attimo prima che il login anonimo
+      // venga completato. Non marchiamo l'app come "non autenticata": proviamo
+      // subito a completare l'accesso e teniamo loading=true finché non finisce.
+      setUser(null);
+      setLoading(true);
+      ensureFirebaseAuthReady()
+        .then((signedUser) => {
+          if (!active) return;
+          setUser(signedUser);
+          setError(null);
+        })
+        .catch((err) => {
+          console.error('[Firebase anonymous auth failed]', err);
+          if (!active) return;
+          setUser(null);
+          setError(err);
+        })
+        .finally(() => {
+          if (!active) return;
+          setLoading(false);
+        });
     });
 
-    if (!auth.currentUser) {
-      signInAnonymously(auth).catch((err) => {
-        console.error('Auth failed', err);
-        if (!cancelled) setLoading(false);
+    ensureFirebaseAuthReady()
+      .then((signedUser) => {
+        if (!active) return;
+        setUser(signedUser);
+        setError(null);
+      })
+      .catch((err) => {
+        console.error('[Firebase anonymous auth failed]', err);
+        if (!active) return;
+        setUser(null);
+        setError(err);
+      })
+      .finally(() => {
+        if (!active) return;
+        setLoading(false);
       });
-    } else {
-      setLoading(false);
-    }
 
     return () => {
-      cancelled = true;
+      active = false;
       unsubscribe();
     };
   }, []);
 
-  return { user, loading };
+  return { user, loading, error };
 }
--- a/src/pages/AdminPanel.tsx
+++ b/src/pages/AdminPanel.tsx
@@ -20,7 +20,7 @@
 } from "lucide-react";
 import { collection, doc, setDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, waitForPendingWrites } from "firebase/firestore";
 import { db, APP_ID } from "@/lib/firebase";
-import { useFirebaseAuth } from "@/hooks/useFirebaseAuth";
+import { ensureFirebaseAuthReady, useFirebaseAuth } from "@/hooks/useFirebaseAuth";
 import { useFirestoreData } from "@/hooks/useFirestoreData";
 import { useActiveOrders } from "@/hooks/useActiveOrders";
 import { useArchiveCollections } from "@/hooks/useArchiveCollections";
@@ -238,7 +238,7 @@
 };
 
 const AdminPanel: React.FC = () => {
-  const { user, loading: authLoading } = useFirebaseAuth();
+  const { user } = useFirebaseAuth();
   const baseData = useFirestoreData(user);
   // 🔥 Listener mirati: ordini attivi + collections archivio (solo admin).
   const activeOrders = useActiveOrders(user);
@@ -285,20 +285,17 @@
   };
 
   const runFirebaseWrite = async (write: () => Promise<unknown>, successMessage?: string) => {
-    if (authLoading) {
-      alert("Attendi un secondo: Firebase sta completando l'accesso anonimo.");
-      return false;
-    }
-    if (!user) {
-      alert("Firebase non è autenticato: impossibile salvare. Controlla che l'accesso anonimo sia attivo nel progetto Firebase.");
-      return false;
-    }
     if (typeof navigator !== "undefined" && navigator.onLine === false) {
       alert("Sei offline: non posso sincronizzare con Firebase adesso.");
       return false;
     }
 
     try {
+      // Non fidiamoci solo dello stato React `user`: può essere ancora null
+      // anche quando Firebase sta completando l'accesso anonimo. Prima di
+      // scrivere forziamo/attendiamo l'autenticazione reale di Firebase Auth.
+      await ensureFirebaseAuthReady();
+
       await write();
       await waitForFirebaseSync();
       if (successMessage) alert(successMessage);
@@ -312,6 +309,7 @@
     }
   };
 
+
   // === SALVATAGGI ===
   const saveDept = async () => {
     if (!editingDept?.name?.trim()) {
