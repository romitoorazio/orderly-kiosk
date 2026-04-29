
# Export ZIP completo del progetto

## Obiettivo
Generare un unico file `daorazio-totem-export.zip` in `/mnt/documents/`, scaricabile subito, contenente tutto il sorgente aggiornato a fine A.2.1, pronto per essere aperto/buildato fuori da Lovable.

## Cosa includo nello ZIP

Tutto il contenuto del repo eccetto le esclusioni elencate sotto:

- `src/` (tutte le sottocartelle: routes, pages, components, hooks, lib, integrations, config, types, styles, router)
- `public/` (tutte le immagini `.jpg/.png/.bmp/.svg/.ico` + `sounds/*.mp3` + `robots.txt`)
- `package.json`
- `bun.lockb` (lockfile)
- `bunfig.toml`
- `vite.config.ts`
- `wrangler.jsonc`
- `tailwind.config.ts`
- `tsconfig.json`
- `components.json`
- `eslint.config.js`
- `.prettierrc`, `.prettierignore`
- `firestore.rules`
- `PORTING_REPORT.md`
- `.lovable/plan.md` (utile come storico)
- `README_EXPORT.md` (nuovo, vedi sotto)
- `.env.example` (nuovo, vedi sotto — solo placeholder, nessun secret)

## Cosa NON includo (esclusioni esplicite)

- `node_modules/`
- `.env`, `.env.local`, `.env.*` reali
- chiavi/secret di qualsiasi tipo
- service account JSON Firebase
- credenziali SumUp
- `dist/`, `.output/`, `.wrangler/`, `.vite/`, `.cache/`
- `.git/` (gestito dall'host)

## File nuovi creati al volo

### `README_EXPORT.md`
Contiene:
- **Stato attuale**: A.1 (parity restore) chiusa + A.2.1 (Feature Flags & Modules tab) completata.
- **Setup**:
  - `bun install` (o `npm install`)
  - `bun run dev` — dev server Vite
  - `bun run build` — build produzione (Cloudflare Worker via wrangler)
  - `bun run preview` — preview build locale
- **Variabili env richieste** (vedi `.env.example`):
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN`
  - `VITE_FIREBASE_PROJECT_ID`
  - `VITE_FIREBASE_STORAGE_BUCKET`
  - `VITE_FIREBASE_MESSAGING_SENDER_ID`
  - `VITE_FIREBASE_APP_ID`
  - `VITE_APP_ID` (namespace Firestore `artifacts/{APP_ID}/...`)
- **Architettura**: TanStack Start v1 + Vite 7 + React 19 + Tailwind v4 (CSS-first in `src/styles.css`) + Firebase (Firestore + Storage + Auth) + deploy Cloudflare Worker.
- **Rotte attive**: `/`, `/totem`, `/cassa`, `/cucina`, `/sala`, `/gioca`, `/hub`, `/admin`.
- **Cosa resta da fare**:
  - **A.2.2 Beeper configurabile**: range min/max dinamico, autoAssign, releaseOn (ready/delivered), takeawayMode, fallbackText. Refactor `src/lib/beeperPool.ts` per leggere `flags.beepers.*` invece dei valori hard-coded 1–16.
  - **A.2.3 Stampanti**: wizard di configurazione in Admin, lista stampanti, ruoli (scontrino/cucina/bar), larghezza carta (58/80mm), test stampa. Driver browser reale + altri marcati "beta / non disponibile".
  - **A.2.4 Cameriere**: nuova rotta `/cameriere` con PIN separato, mappa tavoli, presa ordine al tavolo, conto/stampa conto. Modulo opt-in via `flags.modules.cameriere`.

### `.env.example`
Solo placeholder vuoti, nessun valore reale:
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_APP_ID=da-orazio-totem
```

## Procedura tecnica

1. Verifico con `rg` che non esistano `.env`, secret o service account commessi per errore.
2. Creo `README_EXPORT.md` e `.env.example` in radice.
3. Eseguo `zip -r /mnt/documents/daorazio-totem-export.zip . -x 'node_modules/*' '.env' '.env.*' 'dist/*' '.output/*' '.wrangler/*' '.vite/*' '.cache/*' '.git/*' '*.local'` (uso `nix run nixpkgs#zip` se `zip` non è in PATH).
4. Controllo dimensione e contenuto del file (`unzip -l`).
5. Espongo il file con `<lov-artifact path="daorazio-totem-export.zip" mime_type="application/zip">`.

## Output atteso

Un singolo link scaricabile in chat. Una volta scompattato, basterà:
```
bun install
cp .env.example .env   # poi compilare con i propri valori Firebase
bun run dev
```
e il progetto parte identico allo stato corrente di Lovable.

Confermi e procedo?
