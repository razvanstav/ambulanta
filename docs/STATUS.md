# Starea proiectului

Actualizat: 11 septembrie 2026

## Sincronizare pe PC-ul inițial — 11 septembrie 2026

Au fost preluate cele 7 commituri noi de pe `origin/main`, prin fast-forward
de la `283da32` la `97fe7d0`, fără conflicte sau modificări locale preexistente.
Configurația `.env.local` și fișierele private existente au fost păstrate.
Fișierele private create exclusiv pe celălalt PC nu sunt transportate prin Git.
`npm run check` a trecut aici: format, lint, TypeScript, 16 teste unitare și build.
În această sincronizare nu s-au rerulat migrări, teste PostgreSQL/E2E sau deployuri.
Reper anterior verificat: `97fe7d0`. Continuarea consemnată este PDF-ul individual
din M08, apoi rapoartele M09, conform fluxului simplificat D67.

## Punctul actual

**Optimizare citiri în publicare — 11 septembrie:** măsurarea live a paginii
„Tura mea” a dat 2811 / 4523 / 5018 / 2929 ms pentru patru încărcări complete
autentificate (aproximativ 7,8 KB HTML transferat). Citirile independente pentru
ture, stocul mașinii, titular și inventar rulează acum simultan; alocările pornesc
odată cu fișele. Pagina de stoc pornește simultan inventarul, mașinile și stocurile
lor. Interogările, RLS, verificarea Auth și lipsa cache-ului de stoc rămân identice.
Format/lint/tipuri, 20 unitare și build trecute; verificare browser numai prin
citire: tura proprie, stocuri/ture pentru administrator și refuzul accesului
logistic titularului. Buildul local a răspuns în 493–598 ms; nu se compară direct
cu Netlify. Fără migrări, mutații sau date temporare noi. Reper: `b1dc452`.

**Corecție D70 publicată:** blocarea până la finalul programat se aplică numai
butonului de închidere. Câmpurile de consum sunt editabile, inclusiv pentru ciorne
istorice. Tura raportată este `open`, fără declarație finală sau trimitere;
nu a fost necesară modificarea datelor. Formatul, lint, tipurile, 20 de unitare
și buildul au trecut (build cu `NEXT_TELEMETRY_DISABLED=1` pentru sandbox).
Nu se schimbă SQL sau regulile tranzacționale. Reper anterior: `4233c0e`.
Au trecut și 11 grupuri de acces Supabase și ambele circuite E2E desktop/Pixel 7:
editare repetată înainte de final, Enter fără închidere prematură, confirmare
după final și consum 7/rest 8. Datele temporare au fost curățate; cele 10 solduri
și 10 mișcări existente se reconciliază fără diferențe.
Commitul `c4ebb09` este publicat prin deployul `6aa3a2a405c6e00008d9d90d`,
finalizat la 09:42:25 Europe/Bucharest. Verificarea publică în sesiunea titularului
a confirmat câmpuri editabile cu valorile ciornei păstrate și buton blocat până la
ora programată. Tura și ciorna existente nu au fost modificate. Reper pentru
continuare: `c4ebb09`; următorul modul rămâne PDF individual M08.

**Publicat: gestiune numai pe cantități (D69).** Pragurile și selecția
loturilor/expirării au fost scoase din aplicația funcțională. Stocul și consumul
sunt agregate per produs, inclusiv după suplimentări. Migrarea 009 a fost aplicată
în Supabase cu soldurile neschimbate. Au trecut 21 scenarii PostgreSQL locale,
20 teste unitare și 11 grupuri de acces Supabase. Ambele circuite UI au trecut
în Chromium desktop și Pixel 7, cu Supabase real: recepție 100, predare 12,
suplimentare 3, magazie 85, consum 7 și rest 8 în mașină după închiderea efectivă
la ora programată. Formatul, lint, tipurile și buildul au trecut. Au fost
inspectate vizual produsele, stocul și închiderea. Filtrul de ture se actualizează
și după prima cerere. Instituțiile, conturile și mișcările temporare aprobate au
fost eliminate; cele 10 solduri și 10 mișcări rămase se reconciliază fără diferențe.

Commitul `8312e21` de pe `main` este publicat prin Netlify
`6aa39f3e0da8f60008f881f1`, finalizat la 09:27:52 Europe/Bucharest.
Pe adresa publică au fost verificate autentificarea reală, pagina de produse
fără praguri/expirare și cantitățile 85 în magazie / 8 în mașină, înaintea curățării
fixturei. Migrarea nu a schimbat soldurile existente. Configurația privată a rămas
neschimbată. Previzualizarea statică `/demo` rămâne prototipul istoric M01.
M08 (PDF individual) și M09 (rapoarte) rămân pentru continuare; acest increment
nu le declară finalizate. Reper anterior verificat: `8312e21`.
Contract: [QUANTITY-INVENTORY](QUANTITY-INVENTORY.md).

Stările de mai jos sunt istorice și se citesc cu D69.

**Publicat: interfață lizibilă și final de tură simplificat.** Interfața a fost trecută pe o paletă deschisă,
cu text închis și panouri albe. Finalul turei are acum numai cantitatea consumată,
restul calculat în mașină și un singur buton de închidere. Migrarea 008 face
operația atomică și elimină dovada/returul din fluxul curent, păstrând compatibilitatea
pentru retururi vechi aflate deja în verificare.

- npm run check: format, lint, tipuri, 16 unitare și build trecute.
- PostgreSQL local: 14 scenarii trecute; închiderea dintr-un pas consumă 2 din 11,
  lasă 9 în mașină și păstrează reconcilierea integrală cu jurnalul.
- Paleta a fost inspectată în Chromium pe ecranul de stoc; textele secundare și
  tabelele au fost ajustate după inspecția vizuală.
- Migrarea 008 a fost aplicată și înregistrată în Supabase. Funcția este disponibilă
  numai utilizatorilor autentificați, toate cele 2 substații au dovezile opționale,
  iar reconcilierea jurnalului are 0 diferențe.
- Netlify a publicat commitul `b44e551`, deploy `6aa31946b0816dccbe519a4f`.
  Pagina publică de ture a fost verificată autentificat după publicare.

Actualizare acces: la cererea explicită a beneficiarului a fost creat un
administrator suplimentar pentru instituția demo, cu profil activ și rol global
`administrator`. Autentificarea pe Netlify și accesul la `/administrare` au fost
verificate. Parola nu este inclusă în repository. Reper anterior: `913b482`.
Această operație nu necesită redeploy.

**Publicat: stoc permanent pe mașină și închidere după finalul turei.**
Migrarea 007 este aplicată în Supabase, iar Netlify a publicat versiunea nouă
la 10 septembrie 2026, 23:27 Europe/Bucharest. Reper verificat: `50eae63`,
care include implementarea `d073780`, branch `main`.

- Magazie 100 → predare 10 → consum 7 → magazie 90, mașină 3. Următoarea
  tură preia restul fără o nouă scădere a magaziei; stoc vizibil pe mașină.
- Declarație cu Consumat/Rămâne în mașină și retur fizic separat. Fără retur,
  titularul închide după finalul programat; returul este confirmat de magazie.
- Semnătura validată nu mai poate fi eliminată. Dovezile au explicații și
  contextul declarației; cererile, turele active și istoricul au filtre distincte.
- `npm run check`: format, lint, tipuri, 16 unitare și build trecute.
- 13 scenarii PostgreSQL locale trecute, inclusiv migrare cu date existente,
  10/7/3, preluare, concurență, drepturi, blocare temporală și rollback.
- Browser Chromium desktop și mobil: stoc, filtre, calcul, salvare, semnătură și
  blocarea închiderii verificate pe adaptor HTTP local cu PostgreSQL. Acestea nu
  înlocuiesc testele găzduite Supabase Auth/Storage.
- Închiderea prin buton după final a fost verificată pe mobil: consum înregistrat,
  stoc rămas în mașină și afișarea automată a istoricului. Regresia E2E disponibilă
  local: 18 teste trecute, 16 omise explicit din lipsa fixturelor Supabase reale.
- Supabase găzduit: migrarea 007 înregistrată; cele două solduri vechi de tură
  (7 și 5, pe loturi distincte) sunt acum pe mașină. Magazia este neschimbată,
  alocările sunt păstrate, jurnalul se reconciliază cu zero diferențe. RLS este
  activ, iar comenzile interne și închiderea anonimă sunt inaccesibile.
- Netlify: deploy `6aa31299110cc36e9cb9fbd9`, commit `50eae63`, Published;
  build, funcții, redirecturi și postprocesare reușite. Pagina publică de
  autentificare se încarcă. Suita completă Auth/Storage nu a fost repetată
  în această clonă, deoarece configurația privată este pe alt calculator.
- Urmează continuarea M08 cu PDF individual; M09 rămâne ulterior.

Contract și procedură: [VEHICLE-STOCK](VEHICLE-STOCK.md). Beneficiarul a autorizat
push-ul, migrarea Supabase și publicarea Netlify și s-a autentificat în ambele
dashboarduri. Migrarea a precedat deployul manual. Nu au fost schimbate secretele
de găzduire. Commiturile de documentație folosesc `[skip netlify]`.

## Starea găzduită anterioară — M07

**M00–M07 sunt implementate. M07 este verificat cu PostgreSQL, Storage și browser real.**
Incrementul M07 este publicat și verificat pe Netlify la cererea beneficiarului.

- Branch comun: `main`, remote `origin`, repository `razvanstav/ambulanta`.
- Reper anterior verificat: **`8838e84`**, corecția de publicare M07, pe `main` și
  `origin/main`; codul aplicației publice corespunde acestui commit.
- Commiturile și push-ul sunt autorizate (D26, D50).
- Proiect Supabase Free: **ambulanta**, `roxvzbhsszesglcaadcl`.
- Următorul modul funcțional: **M08 — Închiderea și raportul turei**.
- Publicare anticipată: proiectul Netlify existent **ambulanta**, conectat la GitHub,
  public la [ambulanta.netlify.app](https://ambulanta.netlify.app/autentificare).
  Deployul `7707565` avea variabilele Supabase lipsă. Au fost configurate URL-ul,
  cheia publicabilă și secretul validatorului aprobat explicit (D59).
  Redeployul `6aa2ebff27c92f00093ef0d1` și verificările online au reușit;
  limita demo este 4 MB/fișier. Plan Free reverificat: 254,9/300 credite
  disponibile la verificare, trei deployuri de producție, fără card sau upgrade.
  Commitul final de documentație/teste folosește `[skip netlify]`, pentru a nu
  consuma încă un deploy fără schimbarea codului aplicației.

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
- PDF/JPEG/PNG private, validare efectivă pe server, 4 MB/fișier pe Netlify
  (10 MB local), 5 documente și
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
`private/m03-demo-accounts.json`. Parolele rămân exclusiv locale, ignorate de Git.
Publicarea folosește URL-ul, cheia publicabilă și, cu aprobarea explicită D59,
`SUPABASE_EVIDENCE_SECRET_KEY` pentru validatorul server al dovezilor.
Crearea de conturi noi rămâne locală; cele existente funcționează și pe găzduire.
Secretul de dovezi este configurat numai în contextul Production și nu este public.

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

Publicarea M07: `npm run check` a trecut cu limita de 4 MB, iar cele 56 grupuri
PostgreSQL/Storage au fost repetate cu succes. Circuitul `stock-shifts.spec.ts`
a trecut **2/2 pe site-ul Netlify**, desktop și Pixel 7, cu autentificare, catalog,
recepție, predare, ciornă, semnătură, PDF paginat și fotografie. Browserul și API-ul
refuză explicit fișierul de 4 MB + 1 octet; replay-ul nu dublează dovada,
descărcările au `no-store`, alt titular nu are acces. Screenshotul mobil a fost
inspectat; PDF-ul și semnătura se afișează. TypeScript și formatul testelor au trecut.
Scanarea celor 140 fișiere Git și 21 fișiere publice de build nu a găsit cheia
secretă sau parolele fixturei. Curățarea finală a eliminat toate instituțiile
temporare și a reconfirmat inventarul demonstrativ de mai sus, fără ture sau dovezi.

Turele pornite rămân deschise până la M08. Există ciorne și dovezi/semnături,
dar nu există consum/retur confirmat, închidere, PDF final sau rapoarte agregate. Nu există actualizare
automată în timp real. Conturile noi se creează din mediul local; recuperarea
parolelor rămâne administrativă.
Nu există antivirus sau curățare automată a obiectelor abandonate. Semnătura
desenată nu certifică identitatea declarată. Aceste limite și integrarea exactă
pentru M08 sunt în [EVIDENCE](EVIDENCE.md); demonstrația folosește numai date fictive.

Publicarea anticipată M07 nu finalizează P01 integral. Procedura este în
[DEPLOYMENT](DEPLOYMENT.md).

| Modul                    | Stare                                                                       |
| ------------------------ | --------------------------------------------------------------------------- |
| M00–M03                  | Finalizate                                                                  |
| M04 — Catalog și loturi  | Finalizat                                                                   |
| M05 — Recepții și stoc   | Finalizat                                                                   |
| M06 — Ture și predare    | Finalizat                                                                   |
| M07 — Dovezi             | Finalizat și verificat local și pe Netlify; maximum 4 MB per dovadă în demo |
| M08 — Închidere          | Următorul modul                                                             |
| M09 — Rapoarte           | Neînceput                                                                   |
| Publicare anticipată M07 | Publicată la ambulanta.netlify.app și verificată desktop/mobil              |
| P01 complet              | După M09                                                                    |
| M10–M11                  | Etapă ulterioară                                                            |

## Actualizare acces după publicare — 10 septembrie 2026

La cererea explicită a beneficiarului a fost creat încă un cont individual de
șef de tură, asociat unui angajat activ și titular în Roșiori. Sunt acum
11 angajați și 4 titulari eligibili; flota și stocurile nu au fost modificate.
Autentificarea și rezolvarea titularului propriu au fost verificate în Supabase.
Datele de acces sunt păstrate numai în folderul privat, exclus din Git.
Nu s-a modificat politica generală a parolelor sau codul aplicației.
Reper anterior verificat: `4dea697`; această actualizare nu necesită redeploy.
