# Starea proiectului

Actualizat: 10 septembrie 2026

## Punctul actual

**M00–M07 sunt implementate. M07 este verificat cu PostgreSQL, Storage și browser real.**
Această conversație implementează numai M07 și integrarea necesară în ture.

- Branch comun: `main`, remote `origin`, repository `razvanstav/ambulanta`.
- Reper anterior verificat: **`11aef70`**, documentația stării M04–M06; implementarea
  anterioară este `c7d1eab`. Hashul nou M07 se raportează după commit.
- Commiturile și push-ul sunt autorizate (D26, D50).
- Proiect Supabase Free: **ambulanta**, `roxvzbhsszesglcaadcl`.
- Următorul modul funcțional: **M08 — Închiderea și raportul turei**.
- Publicare anticipată: configurația Netlify este pregătită; contul este conectat,
  planul **Free** verificat, 300 credite disponibile înaintea publicării.
  Importul GitHub nu a deschis autorizarea în browserul controlabil. Beneficiarului
  i s-a cerut conectarea repository-ului `razvanstav/ambulanta` în pagina
  `https://app.netlify.com/start`. Nu există încă deploy sau URL public verificat.
  Starea importului nu a fost reverificată în M07 și nu s-a inițiat un deploy.

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
- M07: titularul salvează declarația proprie cu Consumat/Returnat pe fiecare
  alocare. Ciornele sunt versiuni nemodificabile, cu snapshot și SHA-256 în DB.
  O versiune nouă cere dovezi noi; suplimentarea acceptată face neactuală ciorna
  care nu o include. Nu se modifică stocuri și nu se închide tura.
- PDF/JPEG/PNG private, validare efectivă pe server, 10 MB/fișier, 5 documente și
  o semnătură per versiune. Semnare cu deget/stylus/mouse, resetare, nume și
  confirmare obligatorii. Colectorul autentificat rămâne distinct de semnatar.
- Previzualizare foto și PDF cu paginare prin Mozilla PDF.js, inclusiv pe mobil;
  bibliotecile și workerul sunt locale, fără trimiterea documentelor către CDN.
  Eliminare logică din ciorna curentă și istoric pentru versiunile vechi.
- Politica dovezilor este configurabilă de administrator/șeful substației,
  implicit cel puțin o dovadă. Accesul este izolat inclusiv între titulari ai
  aceleiași substații și la descărcarea efectivă din Storage.
- M01 rămâne separat la `/demo`, fără fallback fictiv în zona autentificată.

Contracte: [CATALOG](CATALOG.md), [INVENTORY](INVENTORY.md), [SHIFTS](SHIFTS.md),
[ACCESS](ACCESS.md), [PERSONNEL](PERSONNEL.md), [EVIDENCE](EVIDENCE.md).

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
M07 folosește cheia secretă locală și pentru atestarea validării fișierelor;
aceasta nu a fost transmisă către Netlify. Publicarea M07/P01 necesită configurarea
serviciului de validare de încredere pe găzduire și verificarea limitei HTTP de
încărcare. Configurația anticipată M06 nu poate încărca dovezi M07.

## Migrări

Versiunile următoare sunt aplicate și înregistrate în Supabase:

1. `202609100001_identity.sql`
2. `202609100002_people_vehicles.sql`
3. `202609100003_catalog_lots.sql`
4. `202609100004_inventory_receipts.sql`
5. `202609100005_shifts_issues.sql`
6. `202609100006_closeout_evidence.sql`

Nu le rerula și nu le modifica. Migrarea M04 a fost confirmată explicit de
beneficiar după ce revizuirea automată a cerut confirmarea mediului etichetat
„PRODUCTION”; acesta este proiectul demo convenit.

## Verificarea finală

| Verificare                 | Rezultat                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `npm run check`            | Prettier, ESLint, TypeScript, Vitest și build trecute                                                              |
| Unitare                    | 16 teste trecute: acces, cantități, calendar, linii, fișiere, semnături și originea HTTP                           |
| `npm run test:integration` | 56 grupuri trecute pe PostgreSQL/Storage real: 11 M02 + 8 M03 + 9 M04 + 5 M05 + 11 M06 + 12 M07                    |
| `npm run test:e2e`         | 34 teste trecute, desktop Chromium și Pixel 7, cod 0                                                               |
| Circuit UI                 | Catalog → recepție 100 → fișă 12 → suplimentare 3 → depozit 85 → ciornă → semnătură/PDF/foto → versiune nouă       |
| Concurență                 | Rezervare unică, recepție repetată, acceptări cu chei diferite, stoc insuficient, curse cu înlocuire/anulare       |
| Tranzacții și acces        | Rollback inclusiv audit, solduri reconciliate, roluri revocate, anon/scrieri directe refuzate și proprietar izolat |
| Populare repetată          | Datele și stocul inițial nu sunt duplicate                                                                         |
| M07 concurență și acces    | Editări concurente, limita documentelor, idempotență, obiect lipsă, rol revocat și versiune veche refuzate         |
| Semnare și vizualizare     | Reset/refuz semnătură goală, evenimente tactile Chromium, PDF cu două pagini, JPEG și colectare de magazie         |
| Secrete                    | Fișierele pentru Git și pachetul public `.next/static` verificate fără cheia secretă sau parolele fixturei         |

Rulările intermediare M07 au identificat și rezolvat verificarea originii HTTP
în spatele adresei interne Next și previzualizarea PDF nativă goală pe mobil
(înlocuită cu PDF.js). Testul de replay a fost corectat să transmită octeții
compleți ai fișierului, iar citirea versiunii nu mai depinde de un buton ascuns
într-un formular restrâns. Rularea finală completă: 34/34 E2E, cod 0.

În M06, un răspuns temporar Supabase
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

Turele pornite rămân deschise până la M08. Există ciorne și dovezi/semnături,
dar nu există consum/retur confirmat, închidere, PDF final sau rapoarte agregate. Nu există actualizare
automată în timp real. Conturile noi se creează din mediul local; recuperarea
parolelor rămâne administrativă.
Nu există antivirus sau curățare automată a obiectelor abandonate. Semnătura
desenată nu certifică identitatea declarată. Aceste limite și integrarea exactă
pentru M08 sunt în [EVIDENCE](EVIDENCE.md); demonstrația folosește numai date fictive.

Publicarea anticipată M06 nu finalizează P01 integral. Procedura este în
[DEPLOYMENT](DEPLOYMENT.md).

| Modul                    | Stare                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| M00–M03                  | Finalizate                                                                                  |
| M04 — Catalog și loturi  | Finalizat                                                                                   |
| M05 — Recepții și stoc   | Finalizat                                                                                   |
| M06 — Ture și predare    | Finalizat                                                                                   |
| M07 — Dovezi             | Finalizat local, cu Supabase/Storage real; publicarea serviciului de validare rămâne la P01 |
| M08 — Închidere          | Următorul modul                                                                             |
| M09 — Rapoarte           | Neînceput                                                                                   |
| Publicare anticipată M06 | Așteaptă conectarea repository-ului GitHub în Netlify                                       |
| P01 complet              | După M09                                                                                    |
| M10–M11                  | Etapă ulterioară                                                                            |
