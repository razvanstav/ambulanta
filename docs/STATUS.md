# Starea proiectului

Actualizat: 10 septembrie 2026

## Punctul actual

**M03 — Angajați, titulari și mașini este implementat și verificat pe Supabase real.**
În instituția „SAJ — Demonstrație”, substația **Roșiori**, sunt **10 angajați
fictivi în total, dintre care 3 titulari eligibili, și 5 mașini active/apte**.
Aplicația folosește proiectul Free existent **ambulanta**, `roxvzbhsszesglcaadcl`.

- Branch comun: `main`, remote `origin`, repository `razvanstav/ambulanta`.
- Reper anterior verificat: **`2b4c86c`**, M02 sincronizat; directorul de lucru
  era curat la începutul M03. Hashul nou se raportează după commit.
- Commiturile și push-ul progresului sunt autorizate explicit (D26).
- Cheia secretă este autorizată pentru utilizare locală și rămâne în
  `.env.local`, ignorat de Git, fără afișare sau includere în repository.
- Țintă: MVP fictiv, Netlify Free + Supabase Free; M00–M09 și apoi P01.
- Următorul modul: **M04 — Catalog, unități, loturi și praguri**.

## Ce funcționează

- M02: autentificare e-mail/parolă, sesiune SSR, refresh și logout; conturi,
  substații, roluri globale/locale, dezactivare și audit. Înscrierea publică și
  autentificarea anonimă sunt oprite. Conturile se creează administrativ.
- Personal: adăugare și editare, cod intern, funcție, activ/inactiv în substație,
  bifă Titular și cont individual opțional. Șeful local/adminul gestionează;
  asocierea contului este rezervată administratorului inclusiv în DB.
- Mașini: indicativ unic în instituție, descriere, activ/inactiv și aptă de
  utilizare. Gestionarul/logistica consultă în domeniul autorizat.
- Logistică: numere reale de angajați, titulari eligibili și mașini disponibile
  tehnic; lista titularilor și legături către Personal/Mașini.
- Tura mea: identitatea este rezolvată pe server/DB din contul autentificat,
  fără alegerea altei persoane; mașinile inactive/inapte sunt excluse.
  Eligibilitatea cere apartenență activă, titular, cont activ și rol local.
- Cele 3 tabele M03 au RLS; scrierile directe sunt interzise. RPC-urile verifică
  substația și instituția, blochează instituția și reverifică drepturile.
  Identitatea/apartenența și auditul se salvează atomic.
- Migrările `202609100001_identity.sql` și `202609100002_people_vehicles.sql`
  sunt aplicate și înregistrate în istoricul Supabase. Nu se rerulează.
- Popularea `seed:m03` este repetabilă fără duplicate sau suprascrierea
  modificărilor utilizatorului. Cei 3 titulari au conturi individuale locale.
  Administrator: `private/initial-admin.json`; titulari:
  `private/m03-demo-accounts.json`. Parolele aleatorii sunt exclusiv locale.
- M01 rămâne la `/demo`, cu aspectul inspirat din referință. Zona autentificată
  nu folosește exemple drept fallback. Personalul/flota sunt persistente.

Procedurile și contractele sunt în [ACCESS](ACCESS.md) și [PERSONNEL](PERSONNEL.md).

## Verificări M03 și regresii

| Verificare                    | Rezultat                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`               | Prettier, ESLint fără avertismente, TypeScript, Vitest și build trecute                                                     |
| `npm test`                    | 6 teste unitare pentru acces și permisiunea de administrare locală                                                          |
| `npm run test:integration`    | 19 grupuri trecute pe PostgreSQL/Supabase real: 11 M02 și 8 M03                                                             |
| Izolare și drepturi M03       | Substații/instituții, titular propriu, anon și scrieri directe refuzate, asociere cont numai admin                          |
| Eligibilitate și flotă        | Debifare titular, inactivitate, cont inactiv, rol revocat cu JWT existent, vehicule inactive/inapte                         |
| Tranzacții și concurență      | Rollback identitate/apartenență/audit; două asocieri concurente la același cont și două indicative identice permit câte una |
| `npm run test:e2e`            | 32 teste trecute în rularea finală: Chromium desktop și Pixel 7, cod 0                                                      |
| Fluxuri UI M03                | Adăugare/editare/dezactivare, titular fără cont neeligibil, mașină retrasă din lista proprie, titular identificat din cont  |
| Acțiuni server                | Replay real cu rol gestionar refuzat cu 404, inclusiv pentru personal; URL din altă substație refuzat                       |
| Inspecție vizuală             | Capturi Personal, Mașini și Tura mea pe desktop/mobil, fără depășirea lățimii                                               |
| Curățare și populare repetată | Fixturele eliminate; demonstrația păstrează 10/3/5; repetarea seed adaugă 0 angajați și 0 mașini                            |

Prima rulare E2E M03 a cerut corectarea a două presupuneri ale testelor:
motivul se completează pentru fiecare salvare, iar indicativele se normalizează
la majuscule. Rularea finală a trecut toate cele 32 de cazuri. Next a raportat
sporadic `The destination stream closed early` în logul serverului de test,
fără verificări eșuate în rularea finală; cauza nu este stabilită. Comportamentul
se urmărește la pregătirea publicării. Avertismentul Gzip observat în M02 este
consemnat în commitul anterior.

Mediul verificat este Node.js 24.19.0 și npm 10.2.0. Lansatoarele locale sunt în
`.tools/bin`; Chromium în `.tools/browsers`. Capturile/logurile și fixturele sunt
ignorate de Git. Testele folosesc instituții separate de demonstrația utilizatorului.

## Limite și continuare

Nu există încă stocuri, ture, dovezi sau rapoarte persistente. Disponibilitatea
mașinilor este tehnică; rezervarea/ocuparea efectivă se implementează în M06.
M06 trebuie să reverifice eligibilitatea în tranzacția predării. Contractul
istoricului propriu rămâne accesibil după debifarea titularului; verificarea pe
fișele reale urmează în M06. Nu există interfață de transfer între substații.

Crearea Auth și a profilului are compensare documentată, fără tranzacție comună
între servicii. Recuperarea parolei rămâne administrată în Supabase; nu există
SMTP/invitații sau resetare automată în aplicație. Nu s-au configurat Netlify,
domeniu sau publicare. Datele sunt fictive, pe planul Free.

## Progres

| Modul                    | Stare                         |
| ------------------------ | ----------------------------- |
| M00 — Fundație           | Finalizat                     |
| M01 — Interfață          | Finalizat, păstrat la `/demo` |
| M02 — Acces și substații | Finalizat                     |
| M03 — Personal și mașini | Finalizat                     |
| M04 — Catalog și loturi  | Următorul modul               |
| M05 — Recepții și stoc   | Neînceput                     |
| M06 — Ture și predare    | Neînceput                     |
| M07 — Dovezi             | Neînceput                     |
| M08 — Închidere          | Neînceput                     |
| M09 — Rapoarte           | Neînceput                     |
| P01 — Publicare demo     | După M09                      |
| M10 — Corecții și audit  | Etapă ulterioară              |
| M11 — Pilot              | Etapă ulterioară              |
