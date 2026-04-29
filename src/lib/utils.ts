import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * safeNum — versione hardened.
 * Rifiuta stringhe placeholder ("...", "—", ""), NaN, Infinity, oggetti.
 * Ritorna sempre un numero finito >= 0 (clamp opzionale).
 */
export function safeNum(value: unknown, fallback = 0): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      trimmed === "" ||
      trimmed === "..." ||
      trimmed === "—" ||
      trimmed === "-" ||
      trimmed === "NaN"
    ) {
      return fallback;
    }
    const n = Number(trimmed.replace(",", "."));
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export function formatCurrency(amount: number, currency = "EUR", locale = "it-IT") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(safeNum(amount));
}
