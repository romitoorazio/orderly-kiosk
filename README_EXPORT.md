# Da Orazio Totem — Export

Snapshot del progetto a fine **Fase A.2.1** (Feature Flags & Modules tab).
Pronto per essere aperto, buildato e modificato fuori da Lovable.

## Stato attuale

- ✅ **A.1 Parity restore** — porting completo del vecchio progetto: 8 rotte, 9 pagine, 14 componenti, 11 hook, 117 asset, Firebase singleton, fix BUG-2/3 su `usePayment`.
- ✅ **A.2.1 Feature Flags** — `useFeatureFlags` + `DEFAULT_FLAGS` + tab Admin "MODULI" + `ModuleGate` su tutte le rotte modulari + Hub dinamico.

Vedi `PORTING_REPORT.md` per le tabelle Feature parity / Admin parity.

## Setup

```bash
# 1. Dipendenze
bun install            # oppure: npm install

# 2. Variabili d'ambiente
cp .env.example .env
#   poi compila i valori Firebase del tuo progetto

# 3. Dev server
bun run dev            # Vite + TanStack Start, default http://localhost:8080

# 4. Build produzione (Cloudflare Worker)
bun run build

# 5. Preview build locale
bun run preview
```

## Variabili d'ambiente richieste

Tutte client-side, prefisso obbligatorio `VITE_` (vedi `.env.example`):

| Variabile | Scopo |
|-----------|-------|
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project id |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender id |
| `VITE_FIREBASE_APP_ID` | Firebase app id |
| `VITE_APP_ID` | Namespace Firestore (`artifacts/{APP_ID}/...`) |

> Nessun secret server-side richiesto in questa fase. SumUp è disattivato.

## Architettura

- **Framework**: TanStack Start v1 + Vite 7 + React 19
- **Styling**: Tailwind v4 CSS-first (`src/styles.css`, `tailwind.config.ts` è solo uno stub di compat)
- **Backend**: Firebase (Firestore + Storage + Auth anonima)
- **Deploy target**: Cloudflare Worker (vedi `wrangler.jsonc`)
- **File-based routing**: `src/routes/*.tsx` → `src/routeTree.gen.ts` (auto-generato, non editare)

## Rotte attive

| Path | Pagina | Protezione |
|------|--------|------------|
| `/` | Totem cliente | ModuleGate `totem` |
| `/totem` | idem | ModuleGate `totem` |
| `/cassa` | Cassa | PIN + ModuleGate `cassa` |
| `/cucina` | KDS | PIN + ModuleGate `cucina` |
| `/sala` | Display sala TV | ModuleGate `sala` |
| `/gioca` | WheelGame promo | ModuleGate `gioca` |
| `/hub` | Hub navigazione | PIN + ModuleGate `hub` |
| `/admin` | Pannello Admin | PIN |

## Cosa resta da fare

### A.2.2 — Beeper configurabile
Refactor `src/lib/beeperPool.ts` per leggere `flags.beepers.*` invece dei valori hard-coded:
- `enabled` on/off
- `rangeMin` / `rangeMax` dinamici (oggi 1–16 fissi)
- `autoAssign` on/off
- `releaseOn`: `"ready"` vs `"delivered"`
- `takeawayMode`: fallback numeri 17–99
- `fallbackText`: messaggio cliente quando beeper off
- Tab Admin "BEEPER" per esporre i toggle

### A.2.3 — Stampanti
Wizard di configurazione in Admin:
- Lista stampanti con ruoli (scontrino / cucina / bar)
- Larghezza carta (58/80mm)
- Driver browser reale + altri marcati "beta / non disponibile"
- Pulsante "Test stampa"
- Tab Admin "STAMPANTI"

### A.2.4 — Cameriere
Modulo opt-in (`flags.modules.cameriere = true`):
- Nuova rotta `/cameriere` con PIN separato (`useAdminPin` con chiave dedicata)
- Mappa tavoli configurabile da Admin
- Presa ordine al tavolo (riusa `CartPanel` / `CustomizerModal`)
- Conto / stampa conto
- Tab Admin "CAMERIERE" + "TAVOLI"

## Esclusioni nello ZIP

`node_modules/`, `.env*` reali, `dist/`, `.output/`, `.wrangler/`, `.vite/`, `.cache/`, `.git/`, service account, credenziali SumUp.

---

Generato da Lovable — fine A.2.1.

## Aggiornamento locale ChatGPT — A.2.2/A.2.3/A.2.4

Questo export include anche:

- A.2.2 Beeper opzionali/configurabili da Admin.
- A.2.3 Stampanti configurabili da Admin con driver Browser reale, formati 58/72/80/custom, test e anteprima. Driver hardware marcati beta/non disponibili.
- A.2.4 Modulo Cameriere predisposto e attivabile da Admin, rotta `/cameriere`, PIN opzionale, lista tavoli, catalogo, carrello e invio ordine a reparto.
- Fix extra: carrello totem in `sessionStorage`, non `localStorage`, per evitare carrello condiviso tra clienti.

Dopo l'installazione eseguire:

```bash
npm install
npm run dev
npm run build
```

Test principali:

1. `/admin → MODULI`: verificare toggle moduli.
2. `/admin → BEEPER`: spegnere beeper e fare un ordine, deve mostrare solo numero ordine.
3. `/admin → STAMPANTE`: creare stampante Browser, stampare test, scegliere 58/72/80/custom.
4. `/admin → CAMERIERE`: attivare modulo, configurare PIN/tavoli.
5. `/cameriere`: creare ordine tavolo e verificarlo in `/cucina`.
