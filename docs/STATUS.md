# Starea proiectului

Actualizat: 10 septembrie 2026

## Punctul actual

**M00 — Fundația proiectului este finalizat și verificat.** Aplicația Next.js pornește local și afișează pagina inițială în română, adaptată pentru calculator și telefon. Sunt configurate TypeScript strict, Tailwind CSS, ESLint, Prettier, Vitest și Playwright. Dependențele directe au versiuni exacte și există `package-lock.json`.

Planul și imaginea de referință sunt păstrate în Git. `README.md` descrie instalarea, pornirea și scripturile reale. `.env.example` nu conține secrete, iar configurațiile locale, instrumentele, build-urile și fișierele private sunt excluse din Git.

- Branch comun: `main`.
- Repository: `https://github.com/razvanstav/ambulanta.git`, configurat ca `origin`; beneficiarul a autorizat trimiterea progresului acolo.
- La început nu exista Git local, iar repository-ul distant a fost verificat gol. Primul commit păstrează planul original: **`bfefbb4`**. Commitul fundației se raportează în răspunsul de predare și se verifică în Git la conversația următoare.
- Ținta rămâne MVP cu date fictive, Netlify Free + Supabase Free; parcurs M00–M09, apoi P01. Domeniul propriu este opțional.
- Următoarea lucrare: **M01 — Interfața comună**, folosind `docs/reference/dashboard-reference.png`.

## Verificări efectuate

Cu Node.js **24.19.0** și npm **10.2.0**:

| Verificare                                                                 | Rezultat                                                                                                    |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `npm install`                                                              | Dependențe instalate și lockfile generat                                                                    |
| `npm ci` într-un folder temporar curat, copiat din fișierele destinate Git | Instalat fără `node_modules`, `.next` sau `.env.local` preexistente; audit npm: 0 vulnerabilități raportate |
| `npm run check`, inclusiv în copia curată                                  | Format, lint fără avertismente, tipuri și build de producție: trecute                                       |
| `npm test` (inclus în `check`)                                             | Vitest pornește; 0 teste unitare, permis explicit în M00 deoarece nu există logică de domeniu               |
| `npx playwright install chromium` și `npm run test:e2e`                    | 2 teste trecute: Chromium pentru calculator și telefon; ultima rulare curată s-a încheiat cu cod 0          |
| `npm run dev -- --hostname 127.0.0.1 --port 3000`                          | Pornit; pagina răspunde HTTP 200 fără configurare Supabase                                                  |
| Inspecție vizuală în browser                                               | Capturi la 1440×1000 și profil Pixel 7; text lizibil, layout încadrat                                       |
| `git diff --check`, lista fișierelor și scanarea tiparelor uzuale de chei  | Fără erori de whitespace sau configurații/secrete detectate în fișierele destinate Git                      |

Probleme rezolvate în timpul verificării: selecția Node 21 de către lansatorul npm de pe Windows, două reguli lint și avertismentul de încărcare a configurației Vitest. Pentru acest calculator, lansatoare locale în `.tools/bin` (ignorate de Git) folosesc explicit Node 24 disponibil în mediul de lucru; instalarea globală nu a fost schimbată. Un pas offline de regenerare a lockfile-ului a necesitat reluare online pentru pachetele opționale lipsă din cache, apoi a reușit.

Prima rulare Playwright în mediul restricționat a trecut testele, dar a întârziat la oprirea serverului. Configurația lansează acum Next direct, iar rularea finală cu permisiunile necesare în copia curată s-a încheiat automat: 2 teste în 1,4 secunde. Instalarea afișează notificarea upstream de retragere a ESLint 9; acesta este păstrat la 9.39.5 deoarece `eslint-plugin-react` încă declară compatibilitate până la seria 9. Lint-ul trece, iar auditul npm nu raportează vulnerabilități.

## Contracte, limite și continuare

- Nu au fost introduse migrări, tabele, contracte de stoc sau clienți Supabase. `src/modules` și `src/lib` documentează responsabilitățile; implementările se adaugă la etapa lor.
- Nu există autentificare, stoc, ture, dovezi sau rapoarte funcționale. Testele M00 nu validează aceste funcții; modulele relevante vor introduce teste comportamentale și verificări pe PostgreSQL real.
- Generarea automată Next.js de instrucțiuni pentru agenți este dezactivată prin `agentRules: false`, astfel încât `AGENTS.md` furnizat rămâne neschimbat.
- M01 introduce navigația, antetul, selectorul vizual de substație și componentele comune, inclusiv shadcn/ui când este necesar. Nu are dependențe externe care să blocheze pornirea.
- Supabase și autentificarea reală se configurează în M02. Netlify și publicarea demo-ului rămân P01; în M00 nu s-au creat conturi, servicii sau publicări.

## Progres

| Modul                    | Stare            |
| ------------------------ | ---------------- |
| M00 — Fundație           | Finalizat        |
| M01 — Interfață          | Următorul modul  |
| M02 — Acces și substații | Neînceput        |
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
