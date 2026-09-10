# M07 — Ciorne, dovezi și semnătură

Migrarea `202609100006_closeout_evidence.sql` este aplicată și înregistrată în
Supabase demo `roxvzbhsszesglcaadcl`. M07 nu schimbă solduri și nu închide tura.

## Declarația și versiunile

Titularul completează în „Tura mea” fiecare alocare acceptată, inclusiv
suplimentările: **Consumat** și **Returnat**. Numerele sunt zecimale exacte în
PostgreSQL, cu precizia produsului. O ciornă poate avea cantități încă
nejustificate; nu poate depăși predatul. Pentru închidere trebuie reconciliată
fiecare alocare, nu numai totalul produsului sau lotului.

`save_closeout_draft(p_shift, p_expected_version, p_request_key, p_lines)` este
exclusiv pentru titularul propriu. Liniile conțin `allocation_id`, `consumed`,
`returned`. Baza de date rezolvă alocările, instantaneele produsului/lotului și
identitatea turei. `closeout_versions` păstrează conținutul JSONB, numărul
versiunii, autorul, cheia cererii și SHA-256 calculat din reprezentarea JSONB
canonică în baza de date. Browserul nu furnizează hashul declarației.

Versiunile nu se actualizează. Două editări concurente ale aceleiași versiuni
au un singur câștigător; aceeași cheie și același conținut întorc rezultatul
existent. O versiune nouă cere reatașarea documentelor și semnare nouă.
Istoricul păstrează cantitățile și dovezile originale. O suplimentare acceptată
după salvare face ciorna neactuală prin compararea alocărilor curente cu
instantaneul salvat, inclusiv dacă a fost acceptată în timpul încărcării.

## Fișiere și colectare

- PDF, JPEG și PNG, maximum 10 MB per fișier, maximum 5 documente și o semnătură
  pentru o versiune. Semnătura este PNG; numele semnatarului și confirmarea sunt
  obligatorii. Contul colectorului, numele său la momentul colectării și momentul
  UTC rămân distincte de numele declarat al semnatarului.
- Captura folosește Pointer Events, cu deget, stylus sau mouse și resetare înainte
  de salvare. Serverul verifică prezența unui traseu vizibil; această verificare
  nu certifică identitatea semnatarului.
- `sharp` decodează și reencodează imaginile, eliminând EXIF. Sunt refuzate
  imaginile corupte, animate sau peste 20 milioane pixeli. Semnătura are limite
  suplimentare de dimensiune și conținut vizibil.
- `pdf-lib` parsează PDF-ul, refuzând fișierele corupte, criptate, peste 100 pagini,
  formulare, acțiuni active și fișiere încorporate. Nu există scanare antivirus;
  folosim numai fișiere fictive în demonstrație.
- Încărcarea este prin `POST /api/evidence`, cu sesiune verificată, origine
  verificată și corp limitat inclusiv pentru cereri fără Content-Length.
  După citirea autorizată prin RLS, serverul validează octeții.
- `reserve_validated_evidence` și `finalize_validated_evidence` sunt executabile
  numai de `service_role`. Primesc identitatea verificată de server și reverifică
  drepturile sub blocarea instituției/turei. Nu acceptă atestări din browser.
- Rezervarea creează o înregistrare `pending` și o cale aleatorie determinată de
  DB. Storage primește numai fișierul validat, fără upsert. Finalizarea verifică
  existența, dimensiunea și MIME din Storage și versiunea încă actuală.
  SHA-256 al octeților stocați este păstrat separat de hashul declarației.
- Încărcarea și DB nu sunt o singură tranzacție. La timeout, aceeași cheie poate
  relua operația fără duplicare; un obiect existent se reutilizează numai după
  verificarea hashului său. Nu se șterge un obiect după un rezultat incert al
  finalizării. Încărcările incomplete sunt vizibile și pot fi eliminate din
  ciorna curentă pentru eliberarea locului.

Bucketul `shift-evidence` este privat. Browserul nu poate încărca, suprascrie
sau șterge obiecte direct. Citirea prin Storage aplică RLS și cere dovadă
validată, proprietarul turei sau drept logistic în substație. Alt titular din
aceeași substație nu are acces. Ruta `GET /api/evidence/[id]` reverifică atât
metadatele, cât și accesul Storage folosind sesiunea utilizatorului și răspunde
cu `Cache-Control: private, no-store`. Nu există linkuri publice permanente.
Modelul urmează [controlul accesului Storage](https://supabase.com/docs/guides/storage/security/access-control).

Previzualizarea PDF folosește Mozilla PDF.js, încărcat la cerere, cu paginare și
randare în canvas inclusiv pe telefon. Fișierul se citește prin aceeași rută
autentificată; workerul, fonturile și decodoarele sunt servite local, fără CDN.
`scripts/prepare-pdf-viewer.mjs` pregătește activele bibliotecii la `dev`/`build`;
acestea sunt generate din dependența fixată, nu sunt dovezi sau fișiere în Git.

Eliminarea unei dovezi din ciorna actuală este logică și auditată. Nu șterge
obiectul și nu permite înlocuirea fișierului original. Versiunile vechi și
viitoarele ture trimise/închise nu permit această mutație. Curățarea fizică
a obiectelor abandonate rămâne o procedură ulterioară; scriptul de test curăță
numai dovezile instituțiilor fictive verificate în manifest.

## Politică și contract pentru M08

Administratorul sau șeful substației poate configura `at_least_one` (implicit)
sau `optional`, cu motiv și audit. Gestionarul și titularul nu schimbă politica.

`closeout_readiness(p_version)` verifică accesul și întoarce `current`,
`balanced`, `policy`, `evidence_count`, `ready`. Numără numai dovezi validate
pentru hashul versiunii, cu obiect existent în Storage și metadate conforme.
Este un contract de verificare a ciornei, nu o comandă de închidere.

În M08, trimiterea și închiderea trebuie să:

1. Blocheze instituția și tura în aceeași ordine ca M06–M07 și să reverifice
   actorul, versiunea, alocările, politica și dovezile înaintea mișcărilor.
2. Înghețe identificatorul versiunii și dovezile folosite la trimitere; în prezent
   `current_closeout` permite numai `open`. M08 trebuie să distingă validitatea
   versiunii trimise în `pending_close` de permisiunea editării unei ciorne.
3. Mențină blocarea modificării/eliminării dovezilor după trimitere. O corecție a
   cantităților creează o versiune nouă și cere reconfirmare/semnătură nouă.
4. Modifice stocul numai prin motorul unic și să salveze raportul final atomic.
   Generarea PDF-ului final este separată, după tranzacție.

## Configurarea serverului

Validarea M07 folosește `SUPABASE_SECRET_KEY` numai pe server, în modulul
`evidence/storage-server.ts`, după verificarea sesiunii și RLS. Nu există cheia
în browser sau în Git. Cheia locală existentă permite circuitul complet local.
Aceasta extinde utilizarea locală de la crearea Auth la validarea fișierelor.

Configurația Netlify anticipată M06, cu numai cheia publicabilă, nu poate încărca
dovezi M07. Conform D54, cheia secretă nu este transmisă automat către găzduire.
La publicarea M07/P01 trebuie stabilit serviciul de validare de încredere și
configurat secretul exclusiv pe server sau un serviciu separat echivalent.
Trebuie verificată și limita HTTP a găzduirii pentru fișiere de 10 MB. În această
conversație nu s-a publicat un site și nu s-au schimbat secretele de găzduire.

## Verificări

`npm run check`: format, lint, TypeScript, teste unitare și build.
`npm run test:integration` include cele 12 grupuri M07 pe PostgreSQL/Storage,
după regresiile M02–M06. `npm run test:e2e` extinde circuitul real existent cu
ciornă, semnătură/reset, PDF/foto, replay HTTP, versiune nouă, colectare de
magazie și eliminare. Testul mobil folosește evenimente tactile Chromium reale.
