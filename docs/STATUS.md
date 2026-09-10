# Starea proiectului

Actualizat: 10 septembrie 2026

## Punctul actual

**M02 — Conturi, substații și roluri este implementat și verificat pe Supabase real.**
Aplicația folosește proiectul Free existent **ambulanta**, ales de beneficiar,
`roxvzbhsszesglcaadcl`. Autentificarea, selectorul de substație, crearea conturilor,
rolurile, dezactivarea și auditul folosesc serviciul real.

- Branch comun: `main`, remote `origin`, repository `razvanstav/ambulanta`.
- Reper anterior verificat: **`80a5e08`**, M01 sincronizat, director de lucru curat
  la începutul M02. Hashul nou se raportează după commit; nu se include în sine.
- Commiturile și push-ul progresului sunt autorizate explicit (D26).
- Cheia secretă a proiectului a fost autorizată explicit pentru utilizare locală.
  Rămâne în `.env.local`, ignorat de Git, fără afișare sau includere în repository.
- Țintă: MVP fictiv, Netlify Free + Supabase Free; M00–M09 și apoi P01.
- Următorul modul: **M03 — Angajați, titulari și mașini**.

## Ce funcționează

- Autentificare e-mail/parolă, sesiune SSR verificată cu Supabase Auth, refresh
  cookie-uri și deconectare. Înscrierea publică și autentificarea anonimă sunt
  oprite în Supabase. Conturile se creează numai administrativ.
- Administratorul creează/redenumește/dezactivează substații, creează conturi
  individuale și atribuie explicit roluri globale sau locale, cu motiv.
- Logistica centrală vede toate substațiile instituției fără administrarea
  conturilor. Gestionarul și șeful de substație sunt locali; șeful de tură are
  perspectiva proprie. Sunt permise roluri multiple atribuite explicit.
- Ruta `/substatia/[id]` și operațiile verifică accesul pe server și în DB.
  Schimbarea manuală a identificatorului nu permite acces la altă substație.
  Conturile fără roluri și conturile dezactivate au comportamente distincte.
- Migrarea `202609100001_identity.sql` este aplicată și înregistrată în istoricul
  Supabase. Cinci tabele cu RLS: instituții, profiluri, substații, roluri și audit.
  Scrierile directe sunt interzise și administratorilor aplicației.
- Mutațiile de drepturi sunt atomice, inclusiv auditul. Blocarea instituției și
  reverificarea după blocare protejează împotriva revocărilor concurente.
  Administratorul nu își poate modifica propriul acces.
- Există instituția fictivă „SAJ — Demonstrație”, Roșiori și Alexandria, plus
  administratorul inițial cu parolă aleatorie. Datele de conectare sunt exclusiv
  în `private/initial-admin.json`; procedura se găsește în [ACCESS](ACCESS.md).
- Prezentarea M01 se păstrează integral la `/demo`, cu culorile și tipografia
  inspirate din referință. Zona autentificată nu folosește exemple ca fallback.

## Verificări M02

| Verificare                 | Rezultat                                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`            | Prettier, ESLint fără avertismente, TypeScript, Vitest și build trecute                                                   |
| `npm test`                 | 5 teste unitare ale contractului de acces și redirecturilor                                                               |
| `npm run test:integration` | 11 grupuri trecute pe PostgreSQL/Supabase real, prin Auth/PostgREST/RPC                                                   |
| Izolare și drepturi        | Anon refuzat, instituții și substații separate, proprietar propriu, metadate fără privilegii, scrieri directe refuzate    |
| Tranzacții și concurență   | Rollback integral inclusiv audit; JWT vechi după revocare; 3 runde de revocări reciproce; denumire unică creată concurent |
| `npm run test:e2e`         | 26 teste trecute, Chromium desktop și Pixel 7; rulare finală completă, cod 0                                              |
| Fluxuri E2E reale          | Login, reîncărcare, logout, selector, URL falsificat, cont fără rol, creare substație/cont, atribuire și revocare         |
| Acțiuni server             | Replay anonim redirecționat la login; replay cu rol local refuzat cu 404                                                  |
| Regresii M01               | 16 teste pentru navigație, filtre, stări, formular, fișă numai citire și lipsa salvărilor simulate                        |
| Inspecție vizuală          | Capturi login/substație/administrare desktop și mobil, fără depășirea lățimii; padding și aliniere formulare corectate    |

Primele rulări UI au identificat interacțiuni înainte de hidratarea paginii și
verificarea prea devreme a unei revocări. Meniul este dezactivat până la hidratare,
iar testele așteaptă rezultatul efectiv. Rularea finală a trecut toate cele 26 de
teste. Next/Node a emis un avertisment `Gzip MaxListenersExceededWarning` la
răspunsurile cu multe formulare; fără erori JavaScript sau verificări eșuate.
Se urmărește comportamentul la pregătirea publicării, fără schimbări de dependențe
fără legătură cu M02.

Mediul verificat este Node.js 24.19.0 și npm 10.2.0. Lansatoarele locale sunt în
`.tools/bin`; Chromium în `.tools/browsers`. Capturile/logurile și fixturele sunt
ignorate de Git. Testele de integrare creează instituții separate de demonstrația
utilizatorului; curățarea lor este limitată prin manifest și verificări de identitate.

## Limite și continuare

Curățarea fixturelor M02 a trecut; au rămas numai instituția demo, cele două
substații și administratorul inițial. Rularea repetată `bootstrap:admin` a
confirmat că nu creează duplicate. Verificarea build-ului client nu a găsit
cheia secretă, iar `.env.local` și fișierul administratorului sunt ignorate de Git.
`git diff --check` nu a raportat erori.

Nu există încă angajați, mașini, stocuri, ture, dovezi sau rapoarte persistente.
Spațiile autentificate indică explicit pregătirea modulelor. M02 verifică
contractul proprietarului; izolarea pe fișele/turele reale se verifică în M06,
iar pe dovezi și rapoarte în M07–M09. Legătura cont–angajat/titular este M03.

Crearea Auth și a profilului are compensare documentată, nu o tranzacție comună
între servicii. Recuperarea parolei rămâne administrată în Supabase; nu există
SMTP/invitații trimise sau resetare automată în aplicație. Nu s-au configurat
Netlify, domeniu sau publicare. Proiectul folosește date fictive și planul Free.

## Progres

| Modul                    | Stare                         |
| ------------------------ | ----------------------------- |
| M00 — Fundație           | Finalizat                     |
| M01 — Interfață          | Finalizat, păstrat la `/demo` |
| M02 — Acces și substații | Finalizat                     |
| M03 — Personal și mașini | Următorul modul               |
| M04 — Catalog și loturi  | Neînceput                     |
| M05 — Recepții și stoc   | Neînceput                     |
| M06 — Ture și predare    | Neînceput                     |
| M07 — Dovezi             | Neînceput                     |
| M08 — Închidere          | Neînceput                     |
| M09 — Rapoarte           | Neînceput                     |
| P01 — Publicare demo     | După M09                      |
| M10 — Corecții și audit  | Etapă ulterioară              |
| M11 — Pilot              | Etapă ulterioară              |
