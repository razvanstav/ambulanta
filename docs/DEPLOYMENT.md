# Publicare demo anticipată după M06

Beneficiarul a autorizat publicarea acestui increment înainte de P01 integral.
Aplicația folosește exclusiv date fictive și conturi individuale existente.
Starea publicării și URL-ul verificat se păstrează în [STATUS](STATUS.md).

## Configurare Netlify

Contul Netlify este conectat, pe planul Free. Importul este pregătit la
[Creare proiect Netlify](https://app.netlify.com/start); conectarea GitHub trebuie
finalizată pentru repository-ul `razvanstav/ambulanta`. Butonul GitHub nu a deschis
autorizarea în browserul controlabil, iar beneficiarul a fost rugat să completeze
acest pas. Nu crea alt proiect dacă importul a fost între timp finalizat.

Repository: `https://github.com/razvanstav/ambulanta`, branch `main`.
`netlify.toml` fixează `npm run build`, directorul `.next`, Node 24.19.0,
npm 10.2.0 și dezactivarea telemetriei Next. Runtime-ul Next.js este detectat de
Netlify; nu se face export static, deoarece aplicația folosește SSR și Server Actions.

În configurația mediului Netlify se introduc numai:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Valorile vin din configurația locală autorizată. Nu se pune cheia secretă pe
găzduire și nu se încarcă `.env.local`, `private/`, fixturele sau parolele.
Administrarea datelor/rolurilor folosește sesiunea și RPC-urile; crearea de
conturi Auth noi rămâne disponibilă numai în mediul local.

Se selectează planul Free și adresa gratuită Netlify. Documentația oficială
consultată la 10 septembrie 2026 arată 300 credite/lună cu limită strictă, fără
reîncărcare automată pentru planul Free. Nu se activează upgrade sau abonament.
[Planuri Netlify](https://www.netlify.com/pricing/),
[limite Free](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/).

După publicare se verifică pagina de autentificare, accesul prin sesiune,
catalogul, stocurile și „Tura mea”, inclusiv antetele private și izolarea.
Supabase Auth rămâne fără înscriere publică. Migrările sunt aplicate separat;
un push sau deploy nu le rerulează.

## Acces demonstrativ

**Completare M07:** configurația de mai sus este cea a incrementului M06.
M07 validează fișierele pe un server de încredere folosind cheia secretă locală.
Încărcările M07 nu vor funcționa într-un deploy care are numai cele două variabile
publice. D54 rămâne respectată: cheia secretă nu a fost transmisă către Netlify.
Înaintea publicării M07/P01 trebuie configurat serviciul de validare exclusiv pe
server și verificată limita HTTP pentru fișiere de 10 MB; vezi [EVIDENCE](EVIDENCE.md).
Această conversație M07 nu a inițiat un deploy.

Administratorul este în `private/initial-admin.json`, titularii în
`private/m03-demo-accounts.json`. Fișierele sunt numai locale. Nu transmite
parole în mesaje publice, repository sau URL-uri. `/demo` este previzualizarea
vizuală M01, iar aplicația persistentă începe la `/autentificare`.

La M07, turele acceptate rămân deschise, cu ciorne și dovezi. M08 va adăuga
consumul/returul confirmat și închiderea. Publicarea acestui increment nu declară P01
integral sau utilizare operațională.
