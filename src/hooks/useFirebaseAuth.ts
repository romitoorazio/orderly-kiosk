import { useState, useEffect } from 'react';
import { signInAnonymously, onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

let anonymousAuthPromise: Promise<User> | null = null;

export async function ensureFirebaseAuthReady(): Promise<User> {
  if (auth.currentUser) return auth.currentUser;

  if (!anonymousAuthPromise) {
    anonymousAuthPromise = signInAnonymously(auth)
      .then((credential) => credential.user)
      .finally(() => {
        anonymousAuthPromise = null;
      });
  }

  return anonymousAuthPromise;
}

export function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      if (!active) return;

      if (nextUser) {
        setUser(nextUser);
        setError(null);
        setLoading(false);
        return;
      }

      setUser(null);
      setLoading(true);

      ensureFirebaseAuthReady()
        .then((signedUser) => {
          if (!active) return;
          setUser(signedUser);
          setError(null);
        })
        .catch((err) => {
          console.error('[Firebase anonymous auth failed]', err);
          if (!active) return;
          setUser(null);
          setError(err);
        })
        .finally(() => {
          if (!active) return;
          setLoading(false);
        });
    });

    ensureFirebaseAuthReady()
      .then((signedUser) => {
        if (!active) return;
        setUser(signedUser);
        setError(null);
      })
      .catch((err) => {
        console.error('[Firebase anonymous auth failed]', err);
        if (!active) return;
        setUser(null);
        setError(err);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return { user, loading, error };
}
