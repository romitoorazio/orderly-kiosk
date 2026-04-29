// Default feature flags — riproducono il comportamento del vecchio Da Orazio Totem.
//
// Regola d'oro: con questi default attivi, l'app si comporta esattamente come
// in chiusura Fase A.1 (parity restore). Ogni cambio in Admin → Moduli sovrascrive
// solo i campi modificati (deep merge in `useFeatureFlags`).
//
// Documento Firestore associato: `artifacts/{APP_ID}/public/data/settings/features`.

export type ModulesFlags = {
  totem: boolean;
  cassa: boolean;
  cucina: boolean;
  sala: boolean;
  gioca: boolean;
  hub: boolean;
  cameriere: boolean;
};

export type BeepersFlags = {
  enabled: boolean;
  rangeMin: number;
  rangeMax: number;
  autoAssign: boolean;
  /** Quando rilasciare il beeper: alla pronto-call o alla consegna. */
  releaseOn: "ready" | "delivered";
  /** Se i beeper fisici si esauriscono, assegna numeri 17–99 come asporto. */
  takeawayMode: boolean;
  /** Testo mostrato al cliente quando i beeper sono disattivati. */
  fallbackText: string;
};

export type PaymentsFlags = {
  cash: boolean;
  sumup: boolean;
  card: boolean;
};

export type OrderModesFlags = {
  takeaway: boolean;
  table: boolean;
  counter: boolean;
  delivery: boolean;
};

export type CatalogFlags = {
  productNotes: boolean;
  variants: boolean;
  extras: boolean;
  allergens: boolean;
  imageRequired: boolean;
};

export type ReceiptFlags = {
  showVat: boolean;
  showLogo: boolean;
  showQr: boolean;
  qrUrl: string;
};

export type WaiterFlags = {
  requirePin: boolean;
  pin: string;
  visibleDepartmentIds: string[];
  canCreateOrders: boolean;
  canMarkServed: boolean;
  canRequestBill: boolean;
  canReprint: boolean;
  tables: string[];
};

export type FeatureFlags = {
  modules: ModulesFlags;
  beepers: BeepersFlags;
  payments: PaymentsFlags;
  orderModes: OrderModesFlags;
  catalog: CatalogFlags;
  receipt: ReceiptFlags;
  waiter: WaiterFlags;
};

export const DEFAULT_FLAGS: FeatureFlags = {
  modules: {
    totem: true,
    cassa: true,
    cucina: true,
    sala: true,
    gioca: true,
    hub: true,
    cameriere: false, // opt-in: nessuna nuova rotta visibile finché Admin non lo accende
  },
  beepers: {
    enabled: true,
    rangeMin: 1,
    rangeMax: 16,
    autoAssign: true,
    releaseOn: "delivered",
    takeawayMode: true,
    fallbackText: "Attendi il tuo numero d'ordine sul monitor",
  },
  payments: {
    cash: true,
    sumup: false, // disattivato in A.1, scelta esplicita
    card: false,
  },
  orderModes: {
    takeaway: true,
    table: false,
    counter: true,
    delivery: false,
  },
  catalog: {
    productNotes: true,
    variants: true,
    extras: true,
    allergens: false,
    imageRequired: false,
  },
  receipt: {
    showVat: true,
    showLogo: true,
    showQr: false,
    qrUrl: "",
  },
  waiter: {
    requirePin: true,
    pin: "1234",
    visibleDepartmentIds: [],
    canCreateOrders: true,
    canMarkServed: true,
    canRequestBill: true,
    canReprint: false,
    tables: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
  },
};

/** Deep merge superficiale (1 livello di nesting, sufficiente per la struttura piatta dei flag). */
export function mergeFlags(remote?: Partial<FeatureFlags> | null): FeatureFlags {
  if (!remote) return DEFAULT_FLAGS;
  return {
    modules: { ...DEFAULT_FLAGS.modules, ...(remote.modules || {}) },
    beepers: { ...DEFAULT_FLAGS.beepers, ...(remote.beepers || {}) },
    payments: { ...DEFAULT_FLAGS.payments, ...(remote.payments || {}) },
    orderModes: { ...DEFAULT_FLAGS.orderModes, ...(remote.orderModes || {}) },
    catalog: { ...DEFAULT_FLAGS.catalog, ...(remote.catalog || {}) },
    receipt: { ...DEFAULT_FLAGS.receipt, ...(remote.receipt || {}) },
    waiter: { ...DEFAULT_FLAGS.waiter, ...(remote.waiter || {}) },
  };
}
