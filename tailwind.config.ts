// Stub di compatibilità.
//
// Il progetto usa Tailwind v4 con configurazione CSS-first in `src/styles.css`
// (direttive `@import "tailwindcss"` + `@theme`). Tailwind NON legge questo file.
// Esiste solo per silenziare il tooling Lovable (`generateConfig`) che cerca
// `tailwind.config.ts` in radice. Non aggiungere logica qui — modifica i token
// di tema in `src/styles.css`.
import type { Config } from "tailwindcss";

const config = {
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
} satisfies Config;

export default config;
