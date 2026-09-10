# Instrucțiuni de proiect — Gestiune substații

Aceste reguli sunt pentru implementarea incrementală a aplicației. Livrarea inițială a pachetului de plan nu inițializează automat codul aplicației sau Git.

Ținta actuală este un MVP funcțional pentru prezentare, cu date fictive și infrastructură în limitele gratuite: Netlify Free + Supabase Free. Adresa gratuită Netlify este suficientă; domeniul propriu este opțional. Construiește M00–M09 și apoi P01 — Publicare demo. M10–M11 rămân pentru o etapă ulterioară de utilizare operațională. Păstrează corectitudinea stocului și controlul accesului și în demo.

## La începutul fiecărei conversații de implementare

- Citește `docs/STATUS.md`, `docs/DECISIONS.md`, partea relevantă din `docs/ARCHITECTURE.md` și modulul cerut din `docs/ROADMAP.md`.
- Inspectează codul existent, starea Git și commiturile recente. Fișierele documentează intenția; verifică situația reală înainte de a afirma că ceva este implementat.
- Identifică rezultatul concret, modulele afectate, criteriile de acceptare și verificările. Anunță pe scurt scopul în română, apoi lucrează.
- Dacă presupunerile din plan diferă de o instrucțiune mai nouă a utilizatorului, respectă instrucțiunea utilizatorului și actualizează documentele relevante.

## Domeniul modificărilor

- Implementează modulul cerut și integrarea strict necesară pentru ca acesta să funcționeze.
- Refolosește componentele și interfețele existente. Nu rescrie alte module, nu reformata tot proiectul și nu actualiza dependențe fără legătură cu lucrarea.
- Modificările necesare în contracte comune, rute, migrări, tipuri și teste sunt permise; explică motivul și verifică funcțiile afectate. O dependență reală nu este motiv să lași modulul incomplet.
- Pentru alegeri obișnuite și reversibile, folosește regulile existente și judecata proprie. Cere clarificare numai când informația lipsă schimbă substanțial rezultatul sau este necesară pentru o acțiune neautorizată.
- Nu implementa în aceeași conversație module viitoare necerute. Consemnează ideile în backlog.

## Reguli de gestiune

- Aplicația are două perspective: „Logistică / Magazie”, pentru distribuție și vedere de ansamblu, și „Tura mea”, pentru șeful de tură autentificat, limitat la propriile fișe și ture. Șeful de tură nu este același rol cu șeful de substație.
- Șeful de tură inițiază „Start tură” și selectează o mașină disponibilă. Magazia stabilește produsele, loturile și cantitățile fișei; șeful de tură acceptă versiunea primită, fără să o editeze. Fluxul și presupunerile sunt în `docs/WORKFLOWS.md`.
- Acceptarea fișei confirmă predarea, scade magazia și pornește efectiv tura, atomic. Pregătirea sau trimiterea fișei nu modifică soldurile.
- „Pe minus” înseamnă consumat. Interfața folosește eticheta clară „Consumat”.
- Doar angajații activi marcați ca titulari în substație primesc predări noi.
- Predarea scade depozitul. Consumul închide cantitatea aflată în tură. Returul confirmat crește depozitul.
- Stocul este permanent pe mașină. La închidere, preluat = consumat + rămas în mașină + retur fizic, pentru fiecare lot/alocare. Restul nu se întoarce implicit în magazie; următoarea tură îl preia fără o nouă scădere a depozitului.
- Intervalul turei este obligatoriu. Închiderea titularului este permisă numai după finalul programat, verificat în PostgreSQL. În fluxul curent titularul declară numai consumul; diferența rămâne automat în stocul mașinii, iar închiderea se face dintr-un singur buton.
- Semnătura validată nu se elimină din declarație. O corecție produce o versiune nouă și păstrează originalul în istoric. Contractul actual este în `docs/VEHICLE-STOCK.md`.
- Toate mișcările trec prin motorul unic de stoc, în tranzacții atomice, cu protecție la cereri repetate și concurență. Browserul nu modifică direct soldurile.
- Datele, rapoartele și dovezile sunt izolate pe substație și prin verificări pe server/baza de date, nu numai prin interfață.
- Mișcările validate și rapoartele finale nu se suprascriu. Corecțiile au motiv, autor și legătură la original.
- Semnătura este asociată versiunii exacte a raportului. Cantitățile schimbate cer confirmare și semnătură nouă.
- Fișierele de dovadă sunt private. Contul colectorului și identitatea declarată a semnatarului rămân distincte.
- Interfața este în română; momentele se păstrează în UTC, cu afișare și calendar operațional Europe/Bucharest.

## Verificare și Git

- Rulează scripturile reale din proiect, nu inventa nume de comenzi sau rezultate. Verifică tipurile, compilarea și testele relevante schimbării.
- Pentru stoc, ture, drepturi și dovezi sunt necesare teste comportamentale. Verifică tranzacțiile și concurența pe PostgreSQL. Pentru ajustări vizuale mici, inspectarea interfeței poate fi suficientă.
- Nu include în Git parole, chei, fișiere `.env` reale, baze de date, documente de tură, semnături, fotografii sau date personale reale. Exemplele sunt fictive.
- Păstrează migrările noi în Git; nu rescrie migrări deja aplicate în medii comune. Nu rula migrări destructive pe date operaționale ca parte a unei ajustări obișnuite.
- Salvează progresul autorizat în commituri coerente, fără modificările preexistente ale utilizatorului. Nu folosi resetări destructive, force push sau ștergerea branchurilor ca metodă de curățare.
- Înainte de încheiere actualizează `docs/STATUS.md` și deciziile schimbate. Nu cere commitului să conțină propriul său hash: consemnează reperul anterior în document și raportează hashul nou în răspunsul final; conversația următoare îl verifică în Git.
- Nu declara un modul complet dacă lipsesc verificări esențiale sau servicii necesare. Notează ce este funcțional și ce rămâne.
- Comunicarea finală include rezultatul, verificările, commitul/branchul, limitările și următorul modul.

## Continuitate

Memoria proiectului este codul și documentația din repository. Nu presupune acces la conversațiile vechi și nu solicita utilizatorului să repete cerințe deja consemnate. Nu crea automat conversații, subagenți, conturi, servicii plătite sau publicări pentru modulele viitoare.
