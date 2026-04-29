# PORTING_REPORT — Da Orazio Whitelabel POS

> Aggiornato a chiusura **Fase A.1 (Parity Restore)**. Le tabelle "Feature parity" e "Admin parity" mappano lo stato attuale e la roadmap A.2.

---

## 1. Storia del porting

- **Fase A (prima iterazione)**: ricostruzione minimale (route placeholder, hooks light). **Scartata** dopo verifica preview: non era fedele al vecchio totem.
- **Fase A.1 (Parity Restore)**: dopo aver ricevuto l'archivio originale completo (`DA_ORAZIO_WHITELABEL_TEST-3.rar`), porting **1:1** di tutte le 9 pagine, 12 componenti totem, 11 hook, 113 asset (111 immagini + 6 audio + favicon + placeholder) sul nuovo stack TanStack Start v1 + React 19 + Tailwind v4 + Firebase 12. Build verde.
- **Fase A.2 (in arrivo)**: Admin come centro di controllo — feature flags, beeper opzionali, wizard stampanti, modulo cameriere. **Non rompe la parity A.1**: tutti i default riproducono il comportamento originale.

---

## 2. Stack & infrastruttura

- TanStack Start v1 (file-based routing in `src/routes/`)
- React 19 + Tailwind v4 (CSS-first, `src/styles.css` con `@theme`)
- Firebase Web SDK v12, singleton in `src/lib/firebase.ts` (no double-init in HMR/SSR)
- Analytics in lazy import + `isSupported()` (compat SSR / Cloudflare Workers)
- **Niente `firebase-admin`** (incompatibile Workers): operazioni atomiche via `runTransaction` lato client
- `tailwind.config.ts`: stub innocuo per silenziare il tooling Lovable. La config vera è in `src/styles.css`.

---

## 3. Bug critici risolti dentro il porting

| # | Bug originale | Stato | Note |
|---|---|---|---|
| 1 | Doppio `addDoc` flusso carta | ✅ Architettura immune | Singolo `tx.set` in transazione |
| 2 | `safeNum` accetta `"..."` / `"—"` | ✅ Risolto | Rifiuta string non-numeriche, NaN, Infinity, oggetti |
| 3 | `computeLocalOrderNumber` + `localStorage.orazio_lastBeeper` come fonte | ✅ Eliminato | Solo Firestore atomico |
| 4 | `firebase-admin` non compat Workers | ✅ Non importato | `api/sumup.ts` originale tenuto fuori dal bundle (SumUp disabilitato in A.1) |

---

## 4. Feature parity (vecchio Da Orazio Totem → nuovo stack)

Tutti i file originali mappati 1:1. UI, copy, asset, classi Tailwind copiati identici.

| Feature | File originale | File nuovo | Stato | Note |
|---|---|---|---|---|
| Welcome screen | `components/totem/WelcomeScreen.tsx` | `src/components/totem/WelcomeScreen.tsx` | ✅ 1:1 | |
| Categorie + ProductGrid | `components/totem/{CategoryBar,ProductGrid}.tsx` | idem | ✅ 1:1 | |
| CustomizerModal (ingredienti, formati, contorni, cottura) | `components/totem/CustomizerModal.tsx` | idem | ✅ 1:1 | tipo `cot` reso optional per tipi React 19 |
| Carrello | `components/totem/CartPanel.tsx` | idem | ✅ 1:1 | |
| Promo modal + ruota | `components/totem/PromoModal.tsx`, `pages/WheelGame.tsx` | idem | ✅ 1:1 | |
| PIN modal (cassa/admin/cucina/hub) | `components/totem/PinModal.tsx` | idem | ✅ 1:1 | |
| Pagamento contanti | `hooks/usePayment.ts` | `src/hooks/usePayment.ts` | ✅ + fix BUG-2/3 | numero ordine atomico, no localStorage |
| Pagamento SumUp (carta) | `api/sumup.ts` + flusso card | _non portato_ | ⏸ DISATTIVO | scelta esplicita: solo contanti in A.1 |
| Stampa scontrino | `components/totem/PrintTemplate.tsx` | idem | ✅ 1:1 (browser print) | wizard stampanti = A.2.3 |
| OrderConfirmation + InactivityWarning + OfflineBanner | `components/totem/*` | idem | ✅ 1:1 | |
| Totem cliente completo | `pages/Index.tsx` (= `<CustomerTotem />`, 1365 righe) | `src/pages/Index.tsx` + `CustomerTotem.tsx` (1352 righe) | ✅ 1:1 | |
| Cassa | `pages/CassaView.tsx` (717) | `src/pages/CassaView.tsx` (717) | ✅ 1:1 | |
| Cucina/KDS | `pages/KitchenDisplay.tsx` (451) | `src/pages/KitchenDisplay.tsx` (451) | ✅ 1:1 | rotta `/cucina` mantenuta |
| Sala TV display | `pages/SalaTvDisplay.tsx` (277) | idem | ✅ 1:1 | |
| WheelGame promo | `pages/WheelGame.tsx` (187) | idem | ✅ 1:1 | |
| Hub navigazione | `pages/Hub.tsx` (37) | idem | ✅ 1:1 | PIN protected |
| Admin completo (12 tab) | `pages/AdminPanel.tsx` (1559) | `src/pages/AdminPanel.tsx` (1559) | ✅ 1:1 | |
| BusinessSettings live | `hooks/useBusinessSettings.ts` | idem | ✅ 1:1 | listener Firestore realtime |
| `useFirestoreData` (catalogo, settings) | idem | idem | ✅ 1:1 | |
| `useActiveOrders`, `useArchiveCollections` | idem | idem | ✅ 1:1 | |
| `useAdminAuth`, `useAdminPin`, `useFirebaseAuth` | idem | idem | ✅ 1:1 | guard `typeof window` per SSR |
| `useCart`, `useOffline` | idem | idem | ✅ 1:1 | |
| `lib/beeperPool.ts` (range 1–16, reconcile) | idem | idem | ✅ 1:1 | dinamico in A.2.2 |
| `lib/readySound.ts` | idem | idem | ✅ 1:1 | guard `typeof Audio` |
| `lib/imageUpload.ts` (heic2any) | idem | idem | ✅ 1:1 | guard `typeof window` |
| `lib/constants.ts`, `lib/utils.ts`, `config/business.ts` | idem | idem | ✅ 1:1 | |
| Asset (111 img + 6 audio) | `public/*` | `public/*` | ✅ copiati | path identici → zero modifiche ai riferimenti |

**Rotte attive** (file sotto `src/routes/`): `/`, `/totem`, `/cassa`, `/cucina`, `/sala`, `/admin`, `/gioca`, `/hub`. Tutte registrate in `routeTree.gen.ts`.

---

## 5. Admin parity (configurabile ora vs roadmap A.2)

L'Admin originale ha già 12 tab. Sotto: cosa è davvero gestibile dal cliente non tecnico oggi e cosa arriva con A.2.

| Funzione | Configurabile ora | Da aggiungere | Fase |
|---|---|---|---|
| Branding (nome, logo, valuta, testi scontrino) | ✅ sì (tab BRAND, `BusinessSettingsTab`) | — | done |
| Menu/prodotti CRUD | ✅ sì (tab MENU) | flag opzionali (note/varianti/extra/allergeni/img obbligatoria) | A.2.1 |
| Reparti CRUD | ✅ sì (tab REPARTI) | — | done |
| Ingredienti CRUD | ✅ sì (tab INGREDIENTI) | — | done |
| Promo prodotto | ✅ sì (tab PROMO) | — | done |
| Ruota fortuna premi | ✅ sì (tab RUOTA) | toggle modulo on/off | A.2.1 |
| SumUp on/off + backend URL | ✅ sì (tab PAGAMENTI) | toggle contanti separato | A.2.1 |
| Beeper 1–16 attivi | ⚠️ parziale (16 fissi on/off) | **enable master, range min/max, autoAssign, releaseOn, fallback text** | A.2.2 |
| Stampante | ⚠️ parziale (1 toggle on/off) | **wizard, lista stampanti, ruoli, larghezza carta, test, anteprima** | A.2.3 |
| Cameriere | ❌ no | **modulo nuovo + rotta `/cameriere` + PIN + tavoli** | A.2.4 |
| Toggle moduli (totem/cassa/cucina/sala/gioca/hub) | ❌ no | **switch per ogni modulo, route guard, Hub filtrato** | A.2.1 |
| Modalità ordine (asporto/tavolo/banco/delivery) | ❌ no | flag in `settings/features` + UI condizionale | A.2.1 |
| Scontrino: logo/QR/IVA visibili | ⚠️ parziale (testi sì) | flag visibilità | A.2.1 |
| Sicurezza/PIN admin | ✅ sì (tab SICUREZZA) | PIN cameriere separato | A.2.4 |
| Marketing (lead) | ✅ sì (tab MARKETING) | — | done |
| Scatola nera (diagnostica SumUp) | ✅ sì (tab SCATOLA_NERA) | — | done |

---

## 6. Smoke test manuale (checklist QA chiusura A.1)

Eseguire dopo deploy/preview:

- [ ] `/` Welcome → INIZIA → categoria → prodotto → CustomizerModal → AGGIUNGI → carrello → CONFERMA → PaymentModal CONTANTI → OrderConfirmation con numero atomico assegnato + beeper → ritorno welcome dopo timeout
- [ ] `/cucina` con PIN → ordine appena creato visibile → "in preparazione" → "pronto" → suono ready riprodotto → beeper rilasciato
- [ ] `/cassa` con PIN → ordine visibile → ristampa funziona
- [ ] `/admin` con PIN → tab BRAND → modifica nome/logo → vedo update live in `/`
- [ ] `/sala` → mostra ordini pronti
- [ ] `/gioca` → ruota gira, premio assegnato secondo pesi
- [ ] `/hub` con PIN → naviga a tutte le rotte
- [ ] Offline: stacca rete → totem hard-blocked, banner offline, pulsante CONFERMA disabilitato → riconnetti → entro ~15s torna operativo

---

## 7. Limiti noti chiusura A.1

- **Auth admin**: protezione via PIN client-side (porting fedele del vecchio). Per produzione: aggiungere Firebase Auth + custom claim `admin` server-side prima del go-live.
- **Multi-tenant**: single-tenant (single Firebase project). Roadmap SaaS in §10.
- **Stampa**: solo `window.print()` browser-side (come l'originale). Wizard + driver multipli arrivano in A.2.3.
- **SumUp**: disabilitato per scelta esplicita. Solo flusso contanti testato.
- **Firestore Security Rules**: file `firestore.rules` incluso → **deploy manuale** dal cliente (Lovable non ha admin del progetto Firebase).

---

## 8. Roadmap A.2 — Admin configurabile dal cliente finale

Ordine di rilascio confermato:

1. **A.2.1 Feature Flags** (in corso): `useFeatureFlags()` + `DEFAULT_FLAGS` + tab MODULI in Admin + filtri in Hub/route guard. Default = parity A.1.
2. **A.2.2 Beeper opzionali**: `beepers.enabled`, range min/max dinamico, `releaseOn`, modalità solo numero ordine. `beeperPool` e `usePayment` adattati.
3. **A.2.3 Stampanti wizard**: collezione `settings/printers/{id}`, wizard "Aggiungi stampante", driver `browser` **realmente funzionante**, altri driver (WebUSB, WebSerial, Bluetooth, ESC/POS network, QZ bridge) presenti come opzioni **marcate "beta / non ancora disponibile"** con messaggio chiaro.
4. **A.2.4 Cameriere**: rotta `/cameriere` mobile-first, PIN opzionale, selezione tavolo, catalogo ridotto, invio a reparto, stato servito, stampa conto.

### Admin configurability roadmap (vista aggregata)

| Funzione | Configurabile da Admin ora | Da aggiungere | Note |
|---|---|---|---|
| Stampanti | parziale (1 toggle on/off) | wizard, lista, ruoli, larghezze (58/72/80/custom), test, anteprima, errori leggibili | A.2.3 — driver browser reale, altri marcati beta |
| Beeper | parziale (16 fissi on/off) | enable master, range min/max, autoAssign, releaseOn, fallback text, modalità solo numero | A.2.2 |
| Cameriere | no | modulo + rotta + PIN opzionale + tavoli + ordini tavolo | A.2.4 — tablet/smartphone first |
| Pagamenti | parziale (SumUp toggle) | toggle contanti, modalità mista | A.2.1 |
| Modalità ordine | no | takeaway / tavolo / banco / delivery | A.2.1 |
| Reparti | sì | — | done |
| Sala display | no | toggle modulo | A.2.1 |
| Gioco promo | sì (CRUD premi) | toggle modulo on/off | A.2.1 |
| Catalogo flags | parziale | note/varianti/extra/allergeni/img obbligatoria | A.2.1 |
| Scontrino | parziale (testi) | logo/QR/IVA visibili sì/no, larghezza carta | A.2.1 + A.2.3 |
| Toggle moduli (totem/cassa/cucina/sala/gioca/hub/cam) | no | switch per ogni modulo + route guard + Hub filtrato | A.2.1 |

---

## 9. Roadmap SaaS multi-tenant (oltre A.2)

1. **Tenant resolver**: subdomain o path-prefix → carica `firebaseConfig` da edge KV
2. **Onboarding**: server function provisiona Firebase project (o namespace su unico DB con `tenants/{id}/...`)
3. **Billing**: Stripe via `createServerFn` + webhook su `/api/public/stripe-webhook`
4. **Permission model**: Firebase Auth custom claims `{ tenantId, role }`
5. **Print gateway**: per stampanti di rete, microservizio Node esterno (Workers non aprono TCP raw)

---

## 10. Deploy Firestore Security Rules

```bash
firebase use da-orazio-whitelabel-test
firebase deploy --only firestore:rules
```

In produzione: abilitare **App Check** + creare custom claim `admin` per gli account staff (Cloud Function o console).

## A.2.2 Beeper configurabili

### Stato
Implementato nel pacchetto esportato e pronto per verifica build su Lovable/GitHub.

### Cosa è stato modificato
- Aggiunta configurazione runtime beeper da `settings/features.beepers` tramite `DEFAULT_FLAGS` / `useFeatureFlags`.
- Aggiunto supporto a beeper opzionali: se `beepers.enabled === false`, l'ordine usa un contatore Firestore atomico dedicato (`counters/orderSeq`) e salva `beeperNumber: null`.
- Aggiunto supporto a range dinamico `rangeMin` / `rangeMax` invece del range fisso 1–16.
- Aggiunto campo separato sugli ordini: `orderNumber`, `beeperNumber`, `beepersEnabled`.
- Aggiornato il rilascio beeper per leggere il range configurato e saltare gli ordini senza `beeperNumber`.
- Aggiornata la tab Admin **BEEPER** con master switch, range, auto-assign, release mode, fallback text e griglia beeper dinamica.

### File modificati / creati
- `src/lib/beeperConfig.ts` — normalizzazione config beeper, range dinamico, status array per Admin.
- `src/lib/orderDisplay.ts` — helper compatibili con ordini legacy e nuovi ordini con `beeperNumber` separato.
- `src/hooks/usePayment.ts` — nuova `generateAtomicOrderAssignment()`, contatore `orderSeq` quando beeper off, payload con `beeperNumber` separato.
- `src/lib/beeperPool.ts` — `releaseBeeper()` e `reconcileBeeperPool()` ora rispettano range dinamico e `beeperNumber`.
- `src/pages/CustomerTotem.tsx` — usa i flag beeper, salva `beeperNumber`, mostra fallback text quando i beeper sono off.
- `src/pages/AdminPanel.tsx` — tab Beeper rifatta: enable, range, autoAssign, releaseOn, takeawayMode, fallbackText, griglia dinamica.
- `src/pages/KitchenDisplay.tsx` — rilascio beeper secondo `releaseOn`, visualizzazione numero ordine compatibile.
- `src/pages/CassaView.tsx` — chiusura ordine rilascia solo beeper fisico se presente.
- `src/pages/SalaTvDisplay.tsx` — visualizzazione numero ordine compatibile.
- `src/components/totem/OrderConfirmation.tsx` — non mostra “beeper” se il modulo è spento.
- `src/components/totem/PrintTemplate.tsx` — testo ritiro guidato da config beeper, non da soglia fissa.
- `src/lib/constants.ts` — tipo `Order` esteso con `orderNumber`, `beeperNumber`, `beepersEnabled`.

### Come funziona con beeper attivi
- `beepers.enabled === true` e `autoAssign === true` preservano il comportamento storico, ma il range è quello configurato da Admin.
- I beeper fisici disponibili vengono ruotati tramite Firestore transaction su `counters/beeperPool`.
- Se i beeper fisici sono esauriti e `takeawayMode === true`, viene assegnato un numero fallback su monitor e `beeperNumber` resta `null`.

### Come funziona con beeper disattivati
- Nessun beeper viene assegnato.
- `beeperNumber` viene salvato come `null`.
- Il cliente vede solo il numero ordine.
- KDS, cassa, sala e stampa non devono assumere che `beeperNumber` esista.

### Test manuali da fare
- Admin → Beeper: spegnere “Usa beeper”, creare ordine contanti da `/totem`, verificare conferma solo numero ordine e `beeperNumber: null` su Firestore.
- Admin → Beeper: riaccendere beeper, impostare range 1–3, disabilitare il 2, creare più ordini e verificare rotazione 1 → 3 → fallback.
- Kitchen `/cucina`: segnare ordine pronto/consegnato e verificare rilascio beeper secondo `releaseOn`.
- Cassa `/cassa`: chiudere ordine e verificare che non vengano rilasciati numeri se `beeperNumber` è null.
- Sala `/sala`: verificare che mostri sempre il numero ordine, senza testo beeper quando spento.
- Stampa: verificare testo ritiro con beeper off e on.

### Gap residui
- La UI usa ancora la parola “BEEPER” come nome tab Admin per compatibilità; in una fase whitelabel può diventare “Numerazione / Beeper”.
- Il flusso carta SumUp resta disattivato: la compatibilità con `beeperNumber` separato andrà validata quando SumUp verrà riattivato.

---

## A.2.3 Stampanti configurabili da Admin

### Implementato

- Aggiunta gestione stampanti in `Admin → STAMPANTE` con UI cliente-finale.
- Aggiunto wizard guidato:
  1. tipo connessione,
  2. nome stampante,
  3. larghezza carta `58mm / 72mm / 80mm / custom`,
  4. ruolo stampante,
  5. reparto associato,
  6. copie + stampa automatica,
  7. stampa test,
  8. salvataggio.
- Aggiunta collection Firestore `printers` sotto `artifacts/{APP_ID}/public/data/printers`.
- Aggiunto driver reale `browser`, basato su finestra di stampa e CSS `@page`.
- Driver `webusb`, `webserial`, `bluetooth`, `escpos-network`, `qz` mostrati come `beta / non disponibile`, con messaggio chiaro: richiedono bridge/driver in una fase successiva.
- Aggiunta anteprima ticket e ultimo esito test.
- Lo scontrino totem non è più bloccato a `60mm`: usa `receiptWidthMm`, derivato dalla stampante ricevuta configurata, con default `72mm`.

### File creati

- `src/lib/print/types.ts`
- `src/lib/print/engine.ts`
- `src/hooks/usePrinterProfiles.ts`
- `src/components/admin/PrinterSettingsTab.tsx`

### File modificati

- `src/pages/AdminPanel.tsx`
- `src/pages/CustomerTotem.tsx`
- `src/components/totem/PrintTemplate.tsx`
- `firestore.rules`

### Limiti residui

- La stampa automatica multi-stampante/reparto non è ancora collegata a una coda `print_queue` completa.
- I driver ESC/POS hardware sono predisposti ma non operativi.
- Per stampanti LAN dirette su porta 9100 serve agent/bridge locale: il browser non può aprire socket TCP raw.

### Test manuali

1. Aprire `/admin → STAMPANTE`.
2. Creare una stampante Browser.
3. Scegliere `58`, `72`, `80` o custom.
4. Fare `Stampa test`.
5. Salvare.
6. Fare un ordine da totem e verificare che la ricevuta usi la larghezza configurata.

---

## A.2.4 Cameriere attivabile da Admin

### Implementato

- Aggiunta sezione `Admin → CAMERIERE`.
- Aggiunto flag modulo `modules.cameriere` già integrato con `Admin → MODULI` e `Hub`.
- Aggiunta configurazione cameriere in `settings/features.waiter`:
  - PIN richiesto sì/no,
  - PIN cameriere,
  - reparti visibili,
  - creazione ordini tavolo,
  - segna servito/consegnato,
  - richiesta conto,
  - ristampa,
  - lista tavoli/postazioni.
- Aggiunta rotta `/cameriere`.
- UI base tablet/mobile:
  - selezione tavolo,
  - selezione reparto,
  - catalogo,
  - carrello,
  - invio ordine al reparto.
- Gli ordini cameriere usano numero ordine atomico Firestore, ma non assegnano beeper fisico: `beeperNumber = null`, `mode = table`, `tableNumber = N`, `origine = cameriere`.

### File creati

- `src/components/admin/WaiterSettingsTab.tsx`
- `src/pages/CameriereView.tsx`
- `src/routes/cameriere.tsx`

### File modificati

- `src/lib/defaultFlags.ts`
- `src/pages/AdminPanel.tsx`
- `src/routeTree.gen.ts`
- `firestore.rules`

### Limiti residui

- La funzione `Segna servito`, `Richiedi conto` e `Ristampa` è configurabile da Admin, ma la UI cameriere attuale implementa solo la creazione ordine tavolo. Le azioni operative sui tavoli vanno completate in una fase successiva.
- Non esiste ancora gestione grafica sale/tavoli avanzata: per ora i tavoli sono una lista testuale configurabile.

### Test manuali

1. Aprire `/admin → CAMERIERE`.
2. Attivare funzione cameriere.
3. Configurare PIN e tavoli.
4. Aprire `/hub`: deve comparire `CAMERIERE`.
5. Aprire `/cameriere`, inserire PIN, selezionare tavolo, aggiungere prodotti e inviare.
6. Aprire `/cucina`: l’ordine deve arrivare con nota/tavolo.

---

## Fix extra prima export

- Il carrello del totem non usa più `localStorage` per `orazio_cart`: ora usa `sessionStorage` per evitare carrello condiviso tra clienti o tab kiosk diverse.
