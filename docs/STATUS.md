# Starea proiectului

Actualizat: 10 septembrie 2026

## Punctul actual

**M04, M05 și M06 sunt implementate și verificate pe Supabase real.**
Continuarea cu M05/M06 și publicarea anticipată au fost cerute explicit de beneficiar.

- Branch comun: `main`, remote `origin`, repository `razvanstav/ambulanta`.
- Reper anterior verificat: **`c7d1eab`**, implementarea M04–M06, trimisă în
  `origin/main`. Hashul actualizării documentației se raportează după commit.
- Commiturile și push-ul sunt autorizate (D26, D50).
- Proiect Supabase Free: **ambulanta**, `roxvzbhsszesglcaadcl`.
- Următorul modul funcțional: **M07 — Dovezi și semnătură**.
- Publicare anticipată: configurația Netlify este pregătită; contul este conectat,
  planul **Free** verificat, 300 credite disponibile înaintea publicării.
  Importul GitHub nu a deschis autorizarea în browserul controlabil. Beneficiarului
  i s-a cerut conectarea repository-ului `razvanstav/ambulanta` în pagina
  `https://app.netlify.com/start`. Nu există încă deploy sau URL public verificat.

## Ce funcționează

- M02–M03: autentificare individuală, sesiune SSR, RLS, conturi și roluri,
  substații, personal, titulari și flotă.
- M04: catalog comun, categorii, unități și precizie, activare globală/locală,
  praguri distincte pe substație, loturi comerciale sau interne, expirare/blocare.
  Unitatea/precizia/urmărirea sunt fixe după primul lot; codul și expirarea
  lotului rămân fixe. Validările și auditul sunt în DB.
- M05: recepții cu document și mai multe linii, stoc inițial, jurnal și solduri
  atomice, chei de idempotență, disponibil separat de cantitatea fizică și praguri.
  Browserul nu modifică solduri sau mișcări. Motor unic: `app_private.move_stock`.
- M06: cerere proprie, rezervare unică a mașinii/titularului, interval planificat
  opțional, ciorne și fișe cu versiuni, semnalare neconcordanță, înlocuire,
  retragere, anulare înainte de predare și suplimentări.
- Acceptarea titularului confirmă predarea și pornește tura atomic. Ciorna și
  trimiterea nu modifică sau rezervă stoc. Stocul, loturile, versiunea, identitatea
  și eligibilitatea se reverifică la acceptare. Acceptarea repetată cu alte chei
  nu dublează predarea. Autorul fișei este distinct de titular.
- RLS izolează titularii din aceeași substație, inclusiv fișele, alocările,
  soldurile și mișcările proprii. Ciornele nu sunt expuse titularului.
- „Actualizează situația” încarcă schimbările celuilalt operator.
- M01 rămâne separat la `/demo`, fără fallback fictiv în zona autentificată.

Contracte: [CATALOG](CATALOG.md), [INVENTORY](INVENTORY.md), [SHIFTS](SHIFTS.md),
[ACCESS](ACCESS.md), [PERSONNEL](PERSONNEL.md).

## Demonstrația Roșiori

Instituția „SAJ — Demonstrație” păstrează **10 angajați fictivi, dintre care
3 titulari eligibili, și 5 mașini**. Au fost adăugate **6 produse, 6 praguri,
6 loturi și o recepție inițială**, fără ture pornite automat în instituția demo.

`seed:m04` și `seed:m05` au fost repetate: 0 produse/praguri/loturi suplimentare
și nicio cantitate duplicată. Produsele au unități separate; nu se însumează între
ele. Alexandria nu a fost populată cu stoc prin aceste scripturi.

Administratorul este în `private/initial-admin.json`; titularii în
`private/m03-demo-accounts.json`. Parolele și cheia secretă sunt exclusiv locale,
ignorate de Git. Publicarea folosește numai URL-ul și cheia publicabilă Supabase.
Crearea de conturi noi rămâne locală; cele existente funcționează și pe găzduire.

## Migrări

Versiunile următoare sunt aplicate și înregistrate în Supabase:

1. `202609100001_identity.sql`
2. `202609100002_people_vehicles.sql`
3. `202609100003_catalog_lots.sql`
4. `202609100004_inventory_receipts.sql`
5. `202609100005_shifts_issues.sql`

Nu le rerula și nu le modifica. Migrarea M04 a fost confirmată explicit de
beneficiar după ce revizuirea automată a cerut confirmarea mediului etichetat
„PRODUCTION”; acesta este proiectul demo convenit.

## Verificarea finală

| Verificare                 | Rezultat                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run check`            | Prettier, ESLint, TypeScript, Vitest și build trecute                                                              |
| Unitare                    | 11 teste trecute: acces, cantități, calendar și linii                                                              |
| `npm run test:integration` | 44 grupuri trecute pe PostgreSQL real: 11 M02 + 8 M03 + 9 M04 + 5 M05 + 11 M06                                     |
| `npm run test:e2e`         | 34 teste trecute, desktop Chromium și Pixel 7, cod 0                                                               |
| Circuit UI                 | Catalog → lot → recepție 100 → neconcordanță → fișă 12 → acceptare → suplimentare 3 → depozit 85                   |
| Concurență                 | Rezervare unică, recepție repetată, acceptări cu chei diferite, stoc insuficient, curse cu înlocuire/anulare       |
| Tranzacții și acces        | Rollback inclusiv audit, solduri reconciliate, roluri revocate, anon/scrieri directe refuzate și proprietar izolat |
| Populare repetată          | Datele și stocul inițial nu sunt duplicate                                                                         |

Prima rulare E2E nouă a cerut corectarea locatorului selectorului de lot;
rularea finală completă a trecut. Un răspuns temporar Supabase
`JWT issued at future` a apărut la testul concurent de recepție. Harnessul de
test reîncearcă doar această respingere explicită anterioară execuției, de cel
mult trei ori, fără reluarea erorilor de rezultat incert. Testul final pe
fixture noi a trecut.

Next continuă să raporteze sporadic `The destination stream closed early` la
navigări în E2E, fără verificări eșuate în rularea finală. Cauza nu este stabilită.
Build-ul local folosește `NEXT_TELEMETRY_DISABLED=1` pentru a evita scrierea
telemetriei în afara workspace-ului. Node 24.19.0 / npm 10.2.0; lansatoare în
`.tools/bin`, Chromium în `.tools/browsers`. Capturile și fixturele sunt ignorate.

După verificarea finală, `npm run test:integration:cleanup` a trecut. Au fost
eliminate numai instituțiile și conturile generate de teste. Citirea ulterioară
confirmă în demo: 10 angajați, 5 mașini, 6 produse, 6 loturi, o recepție și zero
ture. Cele șase solduri inițiale au rămas 10, 25,50, 100, 150, 200 și 200, fiecare
în unitatea produsului său. Pentru o nouă rulare E2E de acces real trebuie recreată
fixturea prin `test:integration`.

## Limite și continuare

Turele pornite rămân deschise până la M07–M08. Nu există încă dovezi/semnături,
consum/retur confirmat, închidere, PDF sau rapoarte agregate. Nu există actualizare
automată în timp real. Conturile noi se creează din mediul local; recuperarea
parolelor rămâne administrativă.

Publicarea anticipată M06 nu finalizează P01 integral. Procedura este în
[DEPLOYMENT](DEPLOYMENT.md).

| Modul                    | Stare                                                 |
| ------------------------ | ----------------------------------------------------- |
| M00–M03                  | Finalizate                                            |
| M04 — Catalog și loturi  | Finalizat                                             |
| M05 — Recepții și stoc   | Finalizat                                             |
| M06 — Ture și predare    | Finalizat                                             |
| M07 — Dovezi             | Următorul modul                                       |
| M08 — Închidere          | Neînceput                                             |
| M09 — Rapoarte           | Neînceput                                             |
| Publicare anticipată M06 | Așteaptă conectarea repository-ului GitHub în Netlify |
| P01 complet              | După M09                                              |
| M10–M11                  | Etapă ulterioară                                      |
