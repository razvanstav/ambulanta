# Gestiune substații

**Increment curent:** gestiune pe produs și cantitate, fără praguri, loturi
comerciale sau expirare. Predarea scade magazia și încarcă mașina; titularul
declară consumul, iar restul rămâne în mașină pentru următoarea tură.
Închiderea anticipată este disponibilă cu motiv și confirmare. Migrările 001–010
sunt aplicate. Vezi [starea curentă](docs/STATUS.md) și
[contractul cantitativ](docs/QUANTITY-INVENTORY.md).

Aplicație în română pentru evidența produselor și a turelor substațiilor de
ambulanță. Ținta este un MVP cu date fictive, Supabase Free și Netlify Free.

Autentificarea, personalul, produsele, recepțiile, turele și închiderea folosesc
Supabase real. Datele de prezentare sunt fictive. Dovezile istorice sunt private;
fluxul curent de închidere nu solicită dovezi. PDF-ul individual M08 și rapoartele
M09 rămân pentru continuare. Starea publicării este în STATUS.
Repository: [razvanstav/ambulanta](https://github.com/razvanstav/ambulanta).
Starea verificată și următorul modul: [STATUS](docs/STATUS.md).

## Pornire locală

Cerințe: Git, **Node.js 24.19.0**, **npm 10.2.0**. Versiunile sunt fixate în
`.node-version`, `.nvmrc`, `package.json` și `package-lock.json`.

```powershell
git clone https://github.com/razvanstav/ambulanta.git
cd ambulanta
npm ci
Copy-Item .env.example .env.local
```

Completează local conexiunea Supabase și urmează [configurarea M02](docs/ACCESS.md)
pentru administrator și [M03](docs/PERSONNEL.md) pentru personal/flotă. În proiectul
Supabase actual migrările M02–M06 sunt deja aplicate; nu le rerula.
Nu suprascrie o configurație locală existentă.

```powershell
npm run dev
```

Deschide [localhost:3000](http://localhost:3000). Fără configurare Supabase,
formularul de acces indică lipsa conexiunii; [previzualizarea](http://localhost:3000/demo)
poate fi explorată independent. Oprește serverul cu `Ctrl+C`.

În PowerShell poți folosi `npm.cmd` dacă politica blochează `npm.ps1`. Nu este
necesară schimbarea politicii globale. Calculatorul de dezvoltare are Node 21
global; verificările folosesc runtime-ul Node 24 din mediul de lucru, cu PATH
ajustat numai în proces. Nu utiliza Node 21 pentru proiect.

## Acces și lucru

Administratorul creează substații și conturi, apoi atribuie explicit rolurile.
Conturile noi nu primesc implicit acces. Logistica centrală vede substațiile
instituției fără drepturi de administrare; rolurile locale rămân limitate la
substațiile atribuite. Șeful de tură are perspectiva proprie, distinctă de
șeful substației. Mai multe roluri se pot atribui aceluiași cont.

Procedura `npm run bootstrap:admin` creează primul administrator al mediului
fictiv cu parolă aleatorie în `private/initial-admin.json`. Acest fișier și
`.env.local` sunt ignorate de Git. Cheia `SUPABASE_SECRET_KEY` nu primește prefix
`NEXT_PUBLIC_` și nu ajunge în codul client.

Șeful substației/adminul gestionează personalul și mașinile. Asocierea unui cont
este administrativă; „Tura mea” identifică titularul din contul autentificat.
`npm run seed:m03` completează datele fictive fără duplicate sau suprascrieri.
Accesul celor trei titulari este numai în `private/m03-demo-accounts.json`.

Fluxul de gestiune rămâne cel din [WORKFLOWS](docs/WORKFLOWS.md): șeful de tură
cere pornirea, magazia pregătește fișa, iar acceptarea confirmă predarea și
pornește tura atomic. Circuitul real include neconcordanțe, versiuni noi și suplimentări.

## Verificări

```powershell
npm run check
npx playwright install chromium
npm run test:e2e
```

`check` execută Prettier, ESLint, generarea tipurilor de rută, TypeScript,
Vitest și build-ul de producție. E2E pornește build-ul pe portul 3100; acesta
trebuie să fie liber. Recompilă dacă ai schimbat codul aplicației.

Pentru verificarea accesului real, creează mai întâi fixturea izolată pe proiectul
demo, apoi rulează E2E și curățarea, conform [ACCESS](docs/ACCESS.md):

```powershell
$env:M02_TEST_PROJECT_REF = "roxvzbhsszesglcaadcl"
npm run test:integration
npm run test:e2e
npm run test:integration:cleanup
```

Sunt 16 teste unitare, 56 grupuri de teste PostgreSQL/Storage și 34 de cazuri E2E cu
fixturea Supabase. Fără fixture, testele de acces real sunt explicit omise.
Nu confunda o rulare omisă cu validarea drepturilor. Toate parolele și fișierele
de test sunt locale, ignorate de Git. Datele operaționale nu sunt permise în teste.

| Comandă                                  | Scop                                                     |
| ---------------------------------------- | -------------------------------------------------------- |
| `npm run dev`                            | Dezvoltare locală                                        |
| `npm run build`, `npm start`             | Compilare și pornire de producție                        |
| `npm run lint`, `npm run typecheck`      | Analiză statică și tipuri                                |
| `npm run format:check`, `npm run format` | Verificare/formatare                                     |
| `npm test`, `npm run test:watch`         | Reguli unitare                                           |
| `npm run test:integration`               | RLS, tranzacții, revocare și concurență în Supabase real |
| `npm run test:e2e`                       | Browser desktop și Pixel 7                               |
| `npm run test:integration:cleanup`       | Eliminarea numai a fixturelor de test verificate         |
| `npm run bootstrap:admin`                | Inițializarea administratorului fictiv                   |
| `npm run seed:m03`                       | Populare demo: 10 angajați, 3 titulari și 5 mașini       |
| `npm run check`                          | Format, lint, tipuri, unitare și build                   |

## Structură și continuitate

```text
src/app/                Rute, layout și stiluri
src/components/         Componente vizuale și shell-uri demo/autentificat
src/modules/demo/       Previzualizare M01, fără salvări
src/modules/identity/   Sesiune, roluri, autorizare și acțiuni server
src/modules/substations/ Administrarea M02
src/modules/employees/  Personal, eligibilitate și identitate titular
src/modules/vehicles/   Flotă și disponibilitate tehnică
src/lib/supabase/       Configurație și clienți server
supabase/migrations/    Migrări versionate
scripts/                Inițializare și fixture fictive
tests/                  Teste E2E și PostgreSQL
docs/                   Plan și starea verificată
```

Lucrăm pe baza comună `main`, cu commituri și push în `origin`, fără force push
sau resetări destructive. Publicarea anticipată M06 este autorizată; **P01** integral rămâne după M09.
M10–M11 sunt pentru eventuala utilizare operațională.

Memoria proiectului: [STATUS](docs/STATUS.md), [DECISIONS](docs/DECISIONS.md),
[ARCHITECTURE](docs/ARCHITECTURE.md), [ROADMAP](docs/ROADMAP.md),
[ACCESS](docs/ACCESS.md), [UI](docs/UI.md) și [AGENTS](AGENTS.md).
Git păstrează codul, documentația și migrările; datele, dovezile și copiile de
siguranță se păstrează separat.

M07 adaugă ciorna declarației și dovezile private: [contract și configurare](docs/EVIDENCE.md).
Validarea fișierelor necesită cheia secretă numai pe server. Configurația locală
existentă este suficientă. [Demo public](https://ambulanta.netlify.app/autentificare)
folosește validatorul Netlify cu limita 4 MB/fișier (10 MB local):
[configurare și verificare](docs/DEPLOYMENT.md).
Trimiterea și închiderea efectivă urmează în M08.
