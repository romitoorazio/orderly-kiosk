import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { APP_ID, db } from "@/lib/firebase";
import type { PrinterProfile } from "@/lib/print/types";

const printersCol = () => collection(db, "artifacts", APP_ID, "public", "data", "printers");
const printerDoc = (id: string) => doc(db, "artifacts", APP_ID, "public", "data", "printers", id);

export function makeDefaultPrinterProfile(): Omit<PrinterProfile, "id"> {
  return {
    name: "Nuova stampante",
    enabled: true,
    role: "receipt",
    departmentId: null,
    connection: { driver: "browser" },
    paper: { width: 80 },
    copies: 1,
    autoPrint: true,
    lastTest: { at: null, ok: false },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function usePrinterProfiles() {
  const [printers, setPrinters] = useState<PrinterProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      printersCol(),
      (snap) => {
        setPrinters(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PrinterProfile, "id">) })));
        setLoading(false);
      },
      (err) => {
        console.warn("[usePrinterProfiles]", err);
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const createPrinter = async (profile: Omit<PrinterProfile, "id">) => {
    const ref = await addDoc(printersCol(), { ...profile, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    return ref.id;
  };

  const savePrinter = async (id: string, patch: Partial<PrinterProfile>) => {
    await setDoc(printerDoc(id), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  };

  const removePrinter = async (id: string) => {
    await deleteDoc(printerDoc(id));
  };

  const updateLastTest = async (id: string, ok: boolean, errorMessage?: string) => {
    await updateDoc(printerDoc(id), {
      lastTest: { at: serverTimestamp(), ok, ...(errorMessage ? { errorMessage } : {}) },
      updatedAt: serverTimestamp(),
    });
  };

  return { printers, loading, error, createPrinter, savePrinter, removePrinter, updateLastTest };
}
