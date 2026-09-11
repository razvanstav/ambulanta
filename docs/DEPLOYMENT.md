# Publicare demo anticipată după M07

## Actualizare cantitativă — 11 septembrie 2026

Migrarea 009 este aplicată și înregistrată în Supabase, cu soldurile neschimbate.
Aplicația nouă folosește RPC-urile de produs și cantitate. Migrările 001–009 nu
se rerulează. Contractul curent este în [QUANTITY-INVENTORY](QUANTITY-INVENTORY.md);
verificările și publicarea acestui increment sunt consemnate în [STATUS](STATUS.md).
Configurația privată Netlify existentă este păstrată.

Commitul `8312e21` de pe `main` a fost publicat automat prin deployul
`6aa39f3e0da8f60008f881f1`, finalizat la 09:27:52 Europe/Bucharest.
Verificarea pe adresa publică a confirmat autentificarea și interfața cantitativă,
inclusiv restul de 8 bucăți după închiderea turei de test. Fixturele aprobate au
fost curățate; reconcilierea finală Supabase are 0 diferențe.

## Actualizare publicată — stoc permanent pe mașină

La 10 septembrie 2026, după autentificarea beneficiarului, migrarea
`202609100007_vehicle_stock_closeout.sql` a fost aplicată prin SQL Editor,
în tranzacție împreună cu înregistrarea versiunii în istoricul Supabase.
Soldurile au fost păstrate și reconciliate cu jurnalul; RLS și restricțiile
de execuție au fost verificate. Migrările 001–007 nu se rerulează.

Deployul manual Netlify `6aa31299110cc36e9cb9fbd9` a publicat commitul
`50eae63` (implementare `d073780`) la 23:27 Europe/Bucharest. Buildul și
publicarea au reușit; pagina de autentificare funcționează. Variabilele existente
au fost păstrate. Testele complete găzduite Auth/Storage nu au fost repetate
din această clonă fără configurația privată. PDF-ul final M08 și rapoartele M09
rămân de implementat; detaliile M07 de mai jos sunt istorice.

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

M09 este publicat din `a980b0f`, deploy Netlify `6aa3f77037fe3a28a88ada8e`,
11 septembrie 2026. Migrarea 011 a fost aplicată și înregistrată înainte de deploy;
corpul funcției a fost comparat cu fișierul din Git, iar `STABLE`, `SECURITY INVOKER`
și refuzul apelului anonim au fost verificate în PostgreSQL găzduit.

Verificarea curentă folosește date izolate de instituția demonstrativă:

```powershell
$env:M02_TEST_PROJECT_REF = "roxvzbhsszesglcaadcl"
npm run test:quantity:setup
$env:E2E_BASE_URL = "https://ambulanta.netlify.app"
npm run test:reports:live
npm run test:integration:cleanup
npm run export:demo
```

Testul verifică Auth/PostgREST găzduit, două ture, stocul permanent pe mașină,
consumul final, replay fără dublare, izolarea și exporturile HTTP de pe Netlify.
Interfața se inspectează separat în browser, pe desktop și telefon. Testele
istorice `test:integration` includ fluxurile M02–M07; nu sunt procedura curentă
de refacere a demonstrației cantitative. Ghidul complet este în [DEMO](DEMO.md).

Administratorul este în `private/initial-admin.json`, titularii în
`private/m03-demo-accounts.json`. Fișierele sunt numai locale. Nu transmite
parole în mesaje publice, repository sau URL-uri. `/demo` este previzualizarea
vizuală M01; aplicația persistentă începe la `/autentificare`.

Verificările P01 au trecut pentru MVP-ul M00–M09, conform D67/D69/D73/D75;
fixturea temporară a fost curățată după autorizare. D76 descrie noul spațiu de probă.
Închiderea curentă declară consumul și păstrează restul în mașină; rapoartele sunt
private. M10–M11, corecțiile și pregătirea operațională, rămân etape ulterioare.
