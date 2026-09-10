# Starea proiectului

Actualizat: 10 septembrie 2026

## Punctul actual

**M01 — Interfața comună este finalizat și verificat.** Aplicația are navigație
în română, antet, selector vizual de substație și cele două perspective:
**Logistică / Magazie** și **Tura mea**. Referința furnizată este folosită pentru
culori, tipografie și atmosferă vizuală; funcțiile provin din plan și WORKFLOWS.

- Branch comun: `main`.
- Repository: `https://github.com/razvanstav/ambulanta.git`, remote `origin`;
  commiturile și push-ul sunt autorizate prin D26.
- Reper verificat la începutul M01: **`e8b0afe`**, pe `main`, director de lucru
  curat și `origin/main` la același reper local. Fundația M00 este în `697def3`,
  planul inițial în `bfefbb4`. Commitul M01 se raportează în răspunsul de predare.
- Țintă: MVP cu date fictive, Netlify Free + Supabase Free; M00–M09, apoi P01.
- Următorul modul: **M02 — Conturi, substații și roluri**. Necesită serviciul
  Supabase real, autentificare și verificarea accesului pe server/PostgreSQL.

Implementarea M01 este salvată în **`fcb85eb`**. După confirmarea explicită a
beneficiarului din 10 septembrie 2026, push-ul către `origin/main` a reușit până
la reperul **`fdb7d6a`**, inclusiv nota de predare. Blocajul de aprobare anterior
este rezolvat. Codul și documentația M01 sunt sincronizate în repository-ul
GitHub; aplicația rămâne locală, fără publicare Netlify.

## Ce funcționează în M01

- Layout comun cu meniu lateral pe calculator și dialog de navigație pe telefon,
  închidere prin Escape/buton, revenirea focusului și legătură „Sari la conținut”.
- Dashboard demonstrativ cu repere de produse, ture active, cereri în așteptare
  și produse sub prag. Cantitățile cu unități diferite nu sunt însumate.
- Tabel de stoc cu căutare inclusiv fără diacritice, filtre combinate pe categorie
  și stare, resetarea filtrelor și legături din alerte către filtrul potrivit.
- „Tura mea”: alegerea mașinii prin formular, validarea selecției, previzualizare
  explicită fără rezervare; stări separate pentru lipsa mașinilor, așteptarea fișei
  și fișa de acceptat. Produsele, loturile și cantitățile fișei nu se pot edita.
- Selectorul Roșiori/Alexandria schimbă numai exemplele afișate. Alexandria
  ilustrează lipsa datelor. Schimbarea substației golește selecția mașinii și
  starea formularului; contextul vizual se păstrează în navigarea din aplicație.
- Destinațiile Recepții, Distribuire, Închidere, Rapoarte, Personal, Mașini și
  Setări sunt navigabile. Distribuirea afișează exemple de cereri; operațiile
  viitoare sunt dezactivate, cu explicații. Istoricul propriu are stare fără date.
- Componente comune: butoane, legături de acțiune, carduri, badge-uri, titluri,
  tabel derulabil, stări fără date/încărcare/eroare. Există fallback-uri Next.js
  pentru încărcare, eroare și adresă necunoscută; Setări permite inspectarea stărilor.
- Toate exemplele sunt marcate „Date demonstrative”. Nicio acțiune nu pretinde că
  salvează sau că acordă roluri. Nu există backend temporar sau persistență locală.

Structura interfeței și punctele de integrare sunt în [UI.md](UI.md). Datele sunt
izolate în `src/modules/demo`. Nu s-au schimbat dependențele sau lockfile-ul.
Titlurile folosesc Bahnschrift cu fonturi de rezervă, corpul Segoe UI/Arial;
nu există descărcări de fonturi necesare la build.

## Verificări M01

Mediu: Node.js **24.19.0**, npm **10.2.0**, versiunile fixate în M00.

| Verificare                           | Rezultat                                                                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                      | Format, ESLint fără avertismente, TypeScript și build de producție trecute                                                                                |
| `npm test`, inclus în check          | Vitest pornește, 0 teste unitare; nu există încă logică de domeniu                                                                                        |
| `npm run test:e2e`                   | **16 teste trecute**, Chromium calculator și Pixel 7; proces încheiat cu cod 0                                                                            |
| Comportamente E2E                    | Navigație, filtre, selecție și resetare, fișă numai pentru citire, acțiuni inactive, lipsa cererilor de scriere, stări standard, tastatură și meniu mobil |
| Verificare suplimentară a layoutului | Dashboard, stoc, fișă și distribuire la 1440×1000, 768×1024, 390×844 și 320×740; fără depășirea lățimii paginii și fără erori JavaScript                  |
| Inspecție vizuală                    | Capturi desktop/mobil pentru dashboard, stoc, formular și fișă; tabelele late se derulează în propriul container                                          |
| `git diff --check`                   | Fără erori de whitespace                                                                                                                                  |

Pe acest calculator, lansatoarele din `.tools/bin` și Node 24 din runtime sunt
folosite prin PATH local procesului. Chromium este în `.tools/browsers`, setat
prin `PLAYWRIGHT_BROWSERS_PATH`. `NEXT_TELEMETRY_DISABLED=1` evită scrierea
configurației telemetriei în afara proiectului. Aceste setări nu schimbă
instalarea globală și nu sunt condiții ale aplicației.

Prima încercare a testelor nu găsea browserul în locația implicită. După indicarea
instalării locale, verificările au identificat doi selectori de test ambigui
(anunțul de rută Next.js și eticheta categoriei), corectați prin rol și aria
conținutului. Mediul restricționat întârzia oprirea serverului; rularea finală cu
permisiunile necesare s-a încheiat normal: 16 teste în 8,6 secunde.

Capturile, logurile și instrumentele locale din `test-results` și `.verification`
sunt ignorate de Git. Nu conțin date operaționale.

## Limite și continuare

M01 validează **interfața**, nu autentificarea, izolarea datelor reale sau
corectitudinea stocului. Perspectivele și substațiile sunt demonstrative.
Nu există încă Supabase, migrări, sesiuni, ture persistente, recepții, dovezi sau
rapoarte generate. Tranzacțiile, concurența și accesul se vor verifica pe
PostgreSQL real în modulele care le introduc.

Acceptarea fișei ca moment al predării și pornirii atomice rămâne D33. Fișa din
M01 doar ilustrează acest contract; acceptarea este dezactivată. Rezervarea
mașinii și anularea rămân propunerea D35, pentru M06.

Aplicația poate fi pornită local fără configurare Supabase. Nu s-au creat conturi,
servicii sau publicări. Netlify și adresa publică rămân P01.

## Progres

| Modul                    | Stare            |
| ------------------------ | ---------------- |
| M00 — Fundație           | Finalizat        |
| M01 — Interfață          | Finalizat        |
| M02 — Acces și substații | Următorul modul  |
| M03 — Personal și mașini | Neînceput        |
| M04 — Catalog și loturi  | Neînceput        |
| M05 — Recepții și stoc   | Neînceput        |
| M06 — Ture și predare    | Neînceput        |
| M07 — Dovezi             | Neînceput        |
| M08 — Închidere          | Neînceput        |
| M09 — Rapoarte           | Neînceput        |
| P01 — Publicare demo     | După M09         |
| M10 — Corecții și audit  | Etapă ulterioară |
| M11 — Pilot              | Etapă ulterioară |
