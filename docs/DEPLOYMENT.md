# Publicare demo anticipată după M07

Beneficiarul a autorizat publicarea incrementului M07 înainte de P01 integral.
Aplicația folosește exclusiv date fictive și conturi individuale existente.

## Proiectul public

- [Aplicație — autentificare](https://ambulanta.netlify.app/autentificare)
- [Proiect Netlify](https://app.netlify.com/projects/ambulanta/overview)
- Repository: `https://github.com/razvanstav/ambulanta`, branch `main`.

Proiectul exista deja, inițial numit `eloquent-eclair-399901`; nu s-a creat unul
duplicat. Importul GitHub este funcțional. Producția este publică, dashboardul
Netlify și deploy previews rămân private. Aplicația cere autentificare individuală.

`netlify.toml` fixează `npm run build`, directorul `.next`, Node 24.19.0,
npm 10.2.0 și dezactivarea telemetriei Next. Netlify detectează runtime-ul Next.js;
nu se face export static: aplicația folosește SSR, Server Actions și rute API.
Push-urile pe `main` declanșează publicarea automată. Migrările nu sunt rerulate
prin deploy. Înainte de un push viitor se verifică și impactul publicării.

## Variabilele mediului

Configurate în interfața Netlify, din valorile locale autorizate:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_EVIDENCE_SECRET_KEY`: marcată **Contains secret values**, numai în
  contextul **Production**. Beneficiarul a aprobat explicit transferul (D59).

Secretul este consumat numai de validatorul server al dovezilor, după verificări
Auth/RLS. Factory-ul pentru administrarea conturilor Auth folosește alt nume,
`SUPABASE_SECRET_KEY`, care rămâne local. Secretul pentru dovezi nu are prefix
public și nu se salvează în Git. Pe Free, Netlify permite secretul în scopurile
Builds, Functions, Runtime, fără selectarea lor individuală; nu este disponibil
pentru Post processing sau deploy previews.

Nu se încarcă `.env.local`, `private/`, fixturele ori parolele. O modificare a
variabilelor cere redeploy. Dacă autentificarea afișează „Conexiunea Supabase nu
este configurată”, se verifică variabilele publice și ultimul build publicat.

## Dovezi și limite gratuite

Demo Netlify acceptă **4 MB/fișier**, configurat la build prin
`NEXT_PUBLIC_EVIDENCE_MAX_MB = "4"`. Browserul refuză fișierele mai mari înainte de
trimitere; API-ul și validarea bytes aplică aceeași limită. Local, implicit, sunt
10 MB; bucketul privat păstrează plafonul 10 MB. Validarea și RLS rămân obligatorii.
Transportul pentru fișiere mai mari este backlog P01.

Motivul: funcțiile sincrone Netlify au un payload de 6 MB, redus efectiv la circa
4,5 MB pentru cereri binare codificate Base64. Limita nu se poate configura.
[Limitele funcțiilor Netlify](https://docs.netlify.com/build/functions/configuration/).

Planul este Free, fără upgrade sau reîncărcare automată. Se folosește adresa
gratuită, fără domeniu plătit. Bugetul și starea verificării sunt în [STATUS](STATUS.md).
[Planuri Netlify](https://www.netlify.com/pricing/).

## Verificarea și accesul demonstrativ

Verificarea de publicare folosește date de test izolate de instituția demonstrativă:

```powershell
$env:M02_TEST_PROJECT_REF = "roxvzbhsszesglcaadcl"
npm run test:integration
$env:E2E_BASE_URL = "https://ambulanta.netlify.app"
$env:NEXT_PUBLIC_EVIDENCE_MAX_MB = "4"
npm run test:e2e -- tests/e2e/stock-shifts.spec.ts
npm run test:integration:cleanup
```

Configurația E2E nu pornește server local când `E2E_BASE_URL` este setată.
Testul verifică desktop și telefon, autentificare, catalog, stoc, predare,
ciornă, semnătură, PDF cu paginare, foto, refuzul fișierelor prea mari,
replay fără dublare și izolarea dovezilor. Rezultatele efective sunt în STATUS.

Administratorul este în `private/initial-admin.json`, titularii în
`private/m03-demo-accounts.json`. Fișierele sunt numai locale. Nu transmite
parole în mesaje publice, repository sau URL-uri. `/demo` este previzualizarea
vizuală M01; aplicația persistentă începe la `/autentificare`.

La M07, turele acceptate rămân deschise, cu ciorne și dovezi. M08 va adăuga
consumul/returul confirmat și închiderea. Publicarea acestui increment nu declară
P01 integral sau utilizare operațională.
