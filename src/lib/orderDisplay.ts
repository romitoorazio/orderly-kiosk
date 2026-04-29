import { normalizeBeeperConfig, type BeeperRuntimeConfig } from "@/lib/beeperConfig";

const hasOwn = (obj: any, key: string) => Object.prototype.hasOwnProperty.call(obj || {}, key);

export function getOrderNumber(order: any): string {
  const value = order?.orderNumber ?? order?.number ?? "";
  return String(value);
}

export function getBeeperNumber(order: any, config?: Partial<BeeperRuntimeConfig> | null): number | null {
  if (!order) return null;
  if (hasOwn(order, "beeperNumber")) {
    const raw = order.beeperNumber;
    if (raw === null || raw === undefined || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  // Compat legacy: i vecchi ordini non avevano beeperNumber separato.
  const cfg = normalizeBeeperConfig(config || undefined);
  const n = Number(order.number);
  if (!cfg.enabled || !Number.isFinite(n)) return null;
  return n >= cfg.rangeMin && n <= cfg.rangeMax ? n : null;
}

export function hasPhysicalBeeper(order: any, config?: Partial<BeeperRuntimeConfig> | null): boolean {
  return getBeeperNumber(order, config) !== null;
}

export function getReleaseNumberForOrder(order: any, config?: Partial<BeeperRuntimeConfig> | null): number | null {
  return getBeeperNumber(order, config);
}

export function getPickupLabel(order: any, config?: Partial<BeeperRuntimeConfig> | null): string {
  const cfg = normalizeBeeperConfig(config || undefined);
  if (!cfg.enabled) return cfg.fallbackText;
  return hasPhysicalBeeper(order, cfg) ? "Ritira con il beeper" : cfg.fallbackText;
}
