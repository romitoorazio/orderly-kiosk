import { useState, useEffect } from 'react';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (cancelled) return;
      setUser(nextUser);
      setLoading(false);
    });

    if (!auth.currentUser) {
      signInAnonymously(auth).catch((err) => {
        console.error('Auth failed', err);
        if (!cancelled) setLoading(false);
      });
    } else {
      setLoading(false);
    }

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { user, loading };
}
