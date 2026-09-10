# Gestiune substații

Aplicație web în română pentru evidența produselor și a turelor substațiilor de ambulanță. Ținta este un MVP de prezentare cu date fictive, pe Netlify Free și Supabase Free. Domeniul propriu este opțional.

**Stare: M00 — Fundația proiectului.** Pagina inițială funcționează. Autentificarea, gestiunea, dovezile și rapoartele se implementează în modulele următoare. Nu există încă o bază de date sau o aplicație publicată.

Repository: [razvanstav/ambulanta](https://github.com/razvanstav/ambulanta).

Fluxul stabilit are două perspective în aceeași aplicație: **Logistică / Magazie**, pentru distribuție și vederea de ansamblu, și **Tura mea**, pentru șeful de tură și datele sale proprii. Șeful de tură apasă „Start tură”, alege mașina disponibilă și acceptă fișa pregătită de magazie. Acceptarea scade stocul și pornește efectiv tura, atomic. Aceste cerințe sunt planificate în [WORKFLOWS](docs/WORKFLOWS.md); codul este încă la M00.

## Pornire locală

Cerințe: Git, **Node.js 24.19.0** și **npm 10.2.0**. Versiunea Node este consemnată în `.node-version` și `.nvmrc`, iar managerul în `package.json`. Folosește versiunea Node indicată prin managerul tău de versiuni sau instalatorul oficial. Dacă este necesar, instalează managerul fixat cu `npm install --global npm@10.2.0`.

Din PowerShell sau un terminal cu versiunile de mai sus în `PATH`:

```powershell
git clone https://github.com/razvanstav/ambulanta.git
cd ambulanta
node --version
npm --version
npm ci
npm run dev
```

Deschide [localhost:3000](http://localhost:3000). Oprește serverul cu `Ctrl+C`. Într-un folder care conține deja proiectul, începe direct cu `npm ci`. Pe Windows, dacă PowerShell blochează `npm.ps1`, folosește `npm.cmd` în loc de `npm`; nu este necesară relaxarea politicii globale de execuție.

Node.js 21, prezent inițial pe calculatorul de dezvoltare, nu este versiunea proiectului. Verificările M00 folosesc Node.js 24.19.0 disponibil în mediul de lucru, prin ajustarea `PATH` numai în procesele de verificare; instalarea globală rămâne neschimbată. Dacă `npm ci` afișează `EBADENGINE`, verifică versiunile din terminal.

M00 pornește fără `.env.local` și fără acces Supabase. `.env.example` documentează valorile publice care vor fi configurate în M02. Copierea este opțională:

```powershell
Copy-Item .env.example .env.local
```

Nu introduce parole, chei privilegiate sau date reale în Git. Prefixul `NEXT_PUBLIC_` expune o valoare browserului și nu se folosește pentru secrete.

## Verificări

```powershell
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` execută verificarea formatării, ESLint, generarea tipurilor de rută și TypeScript, Vitest și compilarea de producție. Browserul Playwright se instalează la prima utilizare. Testele E2E pornesc automat build-ul de producție pe portul 3100, care trebuie să fie liber; rulează `npm run build` dacă ai schimbat codul.

| Comandă                | Scop                                                     |
| ---------------------- | -------------------------------------------------------- |
| `npm run dev`          | Dezvoltare locală cu reîncărcare                         |
| `npm run build`        | Compilare de producție                                   |
| `npm start`            | Pornirea build-ului de producție, pe portul 3000         |
| `npm run lint`         | ESLint, fără avertismente acceptate                      |
| `npm run typecheck`    | Generarea tipurilor Next.js și verificare TypeScript     |
| `npm run format:check` | Verificarea formatării                                   |
| `npm run format`       | Formatarea codului și a documentelor noi                 |
| `npm test`             | Vitest, pregătit pentru testele unitare ale modulelor    |
| `npm run test:watch`   | Vitest în modul interactiv                               |
| `npm run test:e2e`     | Pagina inițială în Chromium pentru calculator și telefon |
| `npm run check`        | Format, lint, tipuri, Vitest și build                    |

M00 nu conține logică de gestiune sau teste unitare. `npm test` permite explicit lipsa acestora (`--passWithNoTests`); un rezultat fără teste nu validează reguli de stoc sau drepturi. Testul E2E existent verifică răspunsul HTTP, conținutul în română, lipsa erorilor JavaScript și încadrarea pe ecran. În modulele de gestiune vor fi necesare și teste pe PostgreSQL real pentru tranzacții, concurență și acces.

## Structură

```text
src/app/          Pagina inițială, layout, stiluri și viitoare rute subțiri
src/modules/      Limitele modulelor; implementările se adaugă la etapa lor
src/lib/          Convenții pentru configurări și viitorii clienți de servicii
tests/e2e/        Verificarea paginii în browser
docs/             Arhitectură, roadmap, decizii, stare și referința vizuală
```

Next.js App Router și TypeScript sunt fundația. Tailwind CSS este configurat; componentele comune și shadcn/ui intră în M01, când sunt necesare. Supabase PostgreSQL/Auth/Storage și primele migrări intră în M02. Nu există solduri sau autentificare simulate în M00.

Versiunile directe sunt exacte, iar `package-lock.json` fixează întregul arbore. Folosește `npm ci` pentru instalare; dependențele se modifică intenționat, nu ca parte implicită a unui alt modul. Referințe: [instalare Next.js](https://nextjs.org/docs/app/getting-started/installation) și [Next.js pe Netlify](https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/).

## Continuitate și Git

Lucrăm în același proiect, cu o bază comună pe `main`. Fiecare modul validat se salvează în commituri coerente și se trimite în `origin`, repository-ul indicat de beneficiar. Nu se folosesc force push sau resetări destructive. Publicarea aplicației este o etapă separată: **P01**, după M00–M09; un push nu configurează automat Netlify sau Supabase.

Începutul fiecărei conversații: citește `AGENTS.md`, starea, deciziile și modulul cerut, apoi verifică fișierele și istoricul Git. La final actualizează starea și salvează progresul. M10–M11 rămân pentru o eventuală utilizare operațională.

| Document                                                    | Conținut                           |
| ----------------------------------------------------------- | ---------------------------------- |
| [STATUS](docs/STATUS.md)                                    | Rezultat real și următorul modul   |
| [ROADMAP](docs/ROADMAP.md)                                  | Etape și criterii de acceptare     |
| [ARCHITECTURE](docs/ARCHITECTURE.md)                        | Fluxuri, date și limite de module  |
| [DECISIONS](docs/DECISIONS.md)                              | Decizii și presupuneri             |
| [PROMPTS](docs/PROMPTS.md)                                  | Mesaje pentru continuarea lucrului |
| [AGENTS](AGENTS.md)                                         | Reguli de implementare             |
| [Referință vizuală](docs/reference/dashboard-reference.png) | Reper pentru M01                   |

Git păstrează codul, documentația și viitoarele migrări. Datele din baza de date, fotografiile, semnăturile și copiile de siguranță se păstrează separat.
