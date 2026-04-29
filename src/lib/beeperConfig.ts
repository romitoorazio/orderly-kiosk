import { DEFAULT_FLAGS, type BeepersFlags, type FeatureFlags } from "@/lib/defaultFlags";

export type BeeperRuntimeConfig = BeepersFlags & {
  /** Vecchio array Admin: true/false per i beeper nel range configurato. */
  status?: boolean[];
};

export type OrderNumberAssignment = {
  /** Numero mostrato al cliente e usato come numero ordine. */
  orderNumber: number;
  /** Numero beeper fisico, oppure null quando beeper spenti/fallback monitor. */
  beeperNumber: number | null;
  /** Origine dell'assegnazione, utile per report/debug. */
  source: "physical_beeper" | "takeaway_number" | "order_sequence";
};

const toSafeInt = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
};

export function normalizeBeeperConfig(input?: boolean[] | Partial<BeeperRuntimeConfig> | null): BeeperRuntimeConfig {
  if (Array.isArray(input)) {
    return {
      ...DEFAULT_FLAGS.beepers,
      enabled: true,
      rangeMin: 1,
      rangeMax: Math.max(1, input.length || DEFAULT_FLAGS.beepers.rangeMax),
      status: input,
    };
  }

  const merged: BeeperRuntimeConfig = {
    ...DEFAULT_FLAGS.beepers,
    ...(input || {}),
    status: Array.isArray((input as BeeperRuntimeConfig | undefined)?.status)
      ? [...((input as BeeperRuntimeConfig).status || [])]
      : undefined,
  };

  const min = Math.max(1, toSafeInt(merged.rangeMin, DEFAULT_FLAGS.beepers.rangeMin));
  const max = Math.max(min, toSafeInt(merged.rangeMax, DEFAULT_FLAGS.beepers.rangeMax));

  return {
    ...merged,
    enabled: merged.enabled !== false,
    autoAssign: merged.autoAssign !== false,
    rangeMin: min,
    rangeMax: max,
    releaseOn: merged.releaseOn === "ready" ? "ready" : "delivered",
    takeawayMode: merged.takeawayMode !== false,
    fallbackText: String(merged.fallbackText || DEFAULT_FLAGS.beepers.fallbackText),
  };
}

export function getEnabledBeeperNumbers(config?: boolean[] | Partial<BeeperRuntimeConfig> | null): number[] {
  const cfg = normalizeBeeperConfig(config);
  if (!cfg.enabled || !cfg.autoAssign) return [];

  const result: number[] = [];
  for (let n = cfg.rangeMin; n <= cfg.rangeMax; n++) {
    const idx = n - cfg.rangeMin;
    const isOn = cfg.status ? cfg.status[idx] !== false : true;
    if (isOn) result.push(n);
  }
  return result;
}

export function readGlobalBeeperConfig(): BeeperRuntimeConfig {
  if (typeof window === "undefined") return normalizeBeeperConfig(DEFAULT_FLAGS.beepers);
  const w = window as unknown as { __FEATURE_FLAGS__?: FeatureFlags };
  return normalizeBeeperConfig(w.__FEATURE_FLAGS__?.beepers || DEFAULT_FLAGS.beepers);
}

export function isPhysicalBeeperNumber(value: unknown, config?: Partial<BeeperRuntimeConfig> | null): boolean {
  const n = Number(value);
  if (!Number.isFinite(n)) return false;
  const cfg = normalizeBeeperConfig(config || readGlobalBeeperConfig());
  return cfg.enabled && n >= cfg.rangeMin && n <= cfg.rangeMax;
}

export function createBeeperStatusForRange(rangeMin: number, rangeMax: number, current?: boolean[], previousRangeMin = 1): boolean[] {
  const min = Math.max(1, Math.trunc(Number(rangeMin) || 1));
  const max = Math.max(min, Math.trunc(Number(rangeMax) || min));
  return Array.from({ length: max - min + 1 }, (_, idx) => {
    const actual = min + idx;
    const previousIdx = actual - previousRangeMin;
    return current?.[previousIdx] !== false;
  });
}
