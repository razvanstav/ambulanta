# Conturi, substații și acces — M02

Aplicația folosește proiectul Supabase Free **ambulanta**, identificator
`roxvzbhsszesglcaadcl`, ales de beneficiar. Înainte de configurare au fost
verificate absența utilizatorilor și a tabelelor aplicației. Nu există date
operaționale. M02 configurează accesul; stocurile și turele apar ulterior.

## Configurarea mediului

1. Copiază `.env.example` în `.env.local` și completează URL-ul proiectului,
   cheia publicabilă și cheia secretă. Nu afișa și nu comite fișierul real.
2. Într-un proiect nou, aplică integral
   `supabase/migrations/202609100001_identity.sql`, o singură dată, prin SQL
   Editor sau prin fluxul de migrări Supabase CLI. Fișierul include tranzacție.
   În proiectul actual migrarea este deja aplicată și înregistrată în
   `supabase_migrations.schema_migrations`, versiunea `202609100001`, numele
   `identity`. Nu o rerula. Pentru aplicare manuală într-un alt proiect,
   consemnează versiunea în istoricul migrărilor înainte de folosirea CLI.
3. În Authentication → Sign In / Providers, oprește **Allow new users to
   sign up** și **Allow anonymous sign-ins**. În proiectul actual sunt oprite;
   autentificarea prin e-mail/parolă este activă. Conturile se creează prin
   administrare, cu e-mail confirmat explicit, fără trimitere de invitații.
4. Rulează `npm run bootstrap:admin` pentru un mediu demo nou. Creează instituția
   fictivă „SAJ — Demonstrație”, administratorul și substațiile Roșiori/Alexandria.
   Parola este generată aleatoriu și scrisă exclusiv în
   `private/initial-admin.json`, ignorat de Git. Rularea repetată verifică
   administratorul existent și nu îi schimbă parola.
5. Pornește `npm run dev`, deschide `/autentificare` și folosește accesul din
   fișierul privat. În `/administrare`, creează conturile individuale, apoi
   atribuie rolurile. Nu utiliza parole comune sau date reale în demonstrație.

Cheia `SUPABASE_SECRET_KEY` este utilizată în aplicație numai de clientul
`server-only` pentru crearea/compensarea conturilor Supabase Auth. Citirile și
scrierile datelor aplicației folosesc sesiunea utilizatorului, inclusiv la
administrare. Scripturile de inițializare și test au acces privilegiat explicit.
Fișierele `.env.local`, `private/` și `.verification/` nu intră în repository.

Crearea unui cont Auth și a profilului nu poate fi o singură tranzacție între
servicii. Dacă înregistrarea profilului eșuează, acțiunea încearcă să elimine
numai contul Auth tocmai creat; un eșec al compensării este raportat explicit.
Conturile noi nu primesc automat roluri. Recuperarea parolelor este administrată
de proprietarul proiectului Supabase; nu există încă un flux de e-mail/SMTP sau
recuperare automată în aplicație. Adresele bootstrap/test sunt fictive.

## Model și contracte

| Tabel              | Rol                                                              |
| ------------------ | ---------------------------------------------------------------- |
| `institutions`     | Limita instituțională și starea activă                           |
| `profiles`         | Cont Auth individual, instituție, nume afișat, activ/inactiv     |
| `substations`      | Instituție, denumire unică în instituție, activ/inactiv          |
| `role_assignments` | Roluri globale sau locale, cu domeniu impus de constrângeri      |
| `audit_events`     | Autor, motiv, obiect, versiune anterioară/ulterioară, moment UTC |

`administrator` și `logistics` au `substation_id = null`. `station_manager`,
`warehouse` și `shift_leader` au obligatoriu substație. Cheile externe compuse
împiedică atribuirea unei substații din altă instituție. Metadatele editabile
ale utilizatorului nu acordă drepturi. Nu există rol implicit la înregistrare.

Administratorul poate configura toate substațiile și conturile instituției.
Logistica centrală vede toate substațiile active fără administrarea conturilor.
Gestionarul și șeful de substație au numai perspectiva locală atribuită.
Șeful de tură primește perspectiva proprie; administratorul nu devine automat
șef de tură. Rolurile pot fi cumulate explicit.

Toate cele cinci tabele au RLS. `anon` nu primește acces, iar `authenticated`
primește numai citire supusă politicilor. Scrierile directe sunt refuzate,
inclusiv administratorilor aplicației. Funcțiile privilegiate au `search_path`
fix și granturi explicite:

- `save_substation`: creare, redenumire și activare/dezactivare în instituția
  administratorului; motiv obligatoriu.
- `register_account`: profil fără roluri pentru un cont Auth nou.
- `set_account_access`: stare și înlocuirea integrală a rolurilor, atomic,
  inclusiv auditul. Datele invalide anulează întreaga operație.
- `bootstrap_institution`: acces numai cu cheia de administrare a infrastructurii;
  nu poate fi executată cu sesiune obișnuită sau anonimă.
- `can_access_owned_record(substation, owner)`: contract pentru viitoarele
  fișe/ture. Șeful de tură trece numai pentru proprietarul propriu în substația
  atribuită. M06 va transmite proprietarul din rândul real, nu dintr-un câmp
  liber al cererii. Nu există tabele de ture fictive în M02.

Mutațiile administrative blochează rândul instituției, apoi reverifică dreptul
administratorului. Un administrator nu își poate modifica propriul acces.
Astfel, două revocări reciproce concurente nu pot elimina ambii administratori.
Dezactivarea profilului/substației sau revocarea unui rol se verifică din baza
de date la următoarea cerere, inclusiv cu un JWT emis anterior. JWT-urile nu
stochează rolurile aplicației. Datele deja afișate într-un browser nu pot fi
retrase retroactiv; cererile noi sunt controlate din nou.

## Sesiunea și interfața

`src/proxy.ts` reîmprospătează cookie-urile Supabase. Funcțiile server verifică
utilizatorul cu Auth și citesc drepturile prin RLS. Rutele private sunt dinamice,
cu răspunsuri `private, no-store`. Schimbarea identificatorului în URL nu ocolește
accesul. Acțiunile server reverifică administratorul și RPC-ul reverifică în DB.

- `/autentificare`: formular de acces și erori explicite.
- `/administrare`: creare cont, substații, roluri și dezactivare, numai administrator.
- `/cont`: identitate și drepturi; stare explicită dacă nu există substație atribuită.
- `/substatia/[id]`: selector cu substațiile autorizate și perspectivele permise.
- `/substatia/[id]/logistica`, `/substatia/[id]/tura-mea`: limite de acces reale,
  conținut operațional încă în pregătire, fără indicatori fictivi prezentați ca reali.
- `/demo`: interfața M01 integrală, marcată demonstrativ, fără salvări.

Contractele server și tipurile sunt în `src/modules/identity`; `policy.ts`
este intrarea utilizabilă și de componente client, iar `actions.ts` expune numai
acțiuni server. `src/modules/substations` conține administrarea. Legătura cont–
angajat/titular urmează în M03. Auditul de bază există în DB; ecranul de audit
și corecțiile sunt M10.

## Reproducerea verificărilor

Rulează exclusiv pe proiectul demo dedicat, cu variabilele locale configurate:

```powershell
$env:M02_TEST_PROJECT_REF = "roxvzbhsszesglcaadcl"
npm run test:integration
npm run check
npm run test:e2e
npm run test:integration:cleanup
```

`test:integration` verifică referința explicită a proiectului, creează două
instituții fictive și conturi cu parole aleatorii, apoi execută 11 grupuri de
teste asupra PostgreSQL real prin Auth/PostgREST/RPC. Acoperă RLS, izolarea
instituțională/locală, proprietarul, escaladarea privilegiilor, metadatele
declarate, scrieri directe, rollback inclusiv audit, revocare cu JWT existent,
audit și concurență. Revocările reciproce rulează în trei runde.

Fixturea privată `.verification/m02-fixtures.json` permite E2E autentificate.
Testele UI folosesc același serviciu real, conturi fictive și două configurații
Chromium: desktop și Pixel 7. Fără fixture, cazurile Supabase sunt explicit
omise, nu raportate ca verificări de acces trecute. Meniul mobil așteaptă
hidratarea înainte să devină activ.

Curățarea verifică URL-ul, instituțiile din manifest și apartenența conturilor
de test înaintea ștergerilor. Elimină doar fixturele generate, inclusiv conturile
E2E din instituțiile de test. Instituția demo și administratorul inițial rămân.
Nu folosi acest script ca procedură de ștergere a datelor operaționale. După o
rulare întreruptă, verifică manifestul privat înainte de reluare; o fixture
existentă blochează crearea alteia.

Referințe tehnice: [sesiuni SSR Supabase](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security),
[crearea administrativă a conturilor](https://supabase.com/docs/reference/javascript/auth-admin-createuser).
