export const BUSINESS = {
  slug: import.meta.env.VITE_BUSINESS_SLUG || "da-orazio",
  name: import.meta.env.VITE_BUSINESS_NAME || "Da Orazio",
  tagline: import.meta.env.VITE_BUSINESS_TAGLINE || "Dal 1950",

  storagePrefix: import.meta.env.VITE_BUSINESS_STORAGE_KEY || "orazio",

  locale: import.meta.env.VITE_BUSINESS_LOCALE || "it-IT",
  currency: import.meta.env.VITE_BUSINESS_CURRENCY || "EUR",
  currencySymbol: import.meta.env.VITE_BUSINESS_CURRENCY_SYMBOL || "€",

  logoUrl: import.meta.env.VITE_BUSINESS_LOGO_URL || "/logo.jpg",

  socials: {
    instagram:
      import.meta.env.VITE_BUSINESS_INSTAGRAM ||
      "https://www.instagram.com/daorazio1950/",
    facebook:
      import.meta.env.VITE_BUSINESS_FACEBOOK ||
      "https://www.facebook.com/daorazio1950/",
  },

  texts: {
    copyright:
      import.meta.env.VITE_BUSINESS_COPYRIGHT ||
      "© 2026 DA ORAZIO DAL 1950 - TUTTI I DIRITTI RISERVATI",
    welcomeFooter:
      import.meta.env.VITE_BUSINESS_WELCOME_FOOTER ||
      "PIZZASCHETTA E MARITATA",

    receiptThankYou:
      import.meta.env.VITE_BUSINESS_RECEIPT_THANK_YOU ||
      "GRAZIE E BUON APPETITO!",
    receiptPickupBeeper:
      import.meta.env.VITE_BUSINESS_RECEIPT_PICKUP_BEEPER ||
      "RITIRA IL CAMPANELLO",
    receiptPickupMonitor:
      import.meta.env.VITE_BUSINESS_RECEIPT_PICKUP_MONITOR ||
      "GUARDA IL MONITOR",
    receiptPaidByCard:
      import.meta.env.VITE_BUSINESS_RECEIPT_PAID_BY_CARD ||
      "PAGATO (CARTA/POS)",
    receiptPayAtCash:
      import.meta.env.VITE_BUSINESS_RECEIPT_PAY_AT_CASH ||
      "DA PAGARE IN CASSA",
  },
} as const;