# Etape de implementare

Un modul se consideră terminat când funcționează în aplicație, îndeplinește criteriile de mai jos, are verificările relevante trecute și este salvat în Git. Dimensiunea unei conversații este dată de o funcționalitate coerentă. Dacă un modul devine prea mare, se împarte explicit în subetape, fiecare verificabilă; nu se livrează o jumătate de flux ca și cum ar fi complet.

Starea curentă a implementării este în `STATUS.md`; verifică și codul și istoricul Git înainte de continuare.

Actualizare pentru scopul confirmat: demonstrația gratuită se livrează prin M00–M09, apoi **P01 — Publicare demo**. M10–M11 rămân documentate pentru o eventuală utilizare operațională și nu sunt condiții pentru prima prezentare. Auditul de bază, drepturile și corectitudinea stocului rămân parte din modulele inițiale.

Actualizare de flux, 10 septembrie 2026: aplicația are perspectivele **„Logistică / Magazie”** și **„Tura mea”**. Șeful de tură inițiază cererea și selectează mașina; acceptarea fișei pregătite de magazie confirmă predarea și pornește efectiv tura, atomic. [WORKFLOWS](WORKFLOWS.md) descrie fluxul și propunerile pentru rezervarea mașinii. Modulele rămân în aceeași ordine.

## Ordinea de lucru

| Modul | Rezultatul vizibil | Depinde de | Exemplu de branch |
| --- | --- | --- | --- |
| M00 | Proiect care pornește, reguli și verificări de bază | Plan | `feat/m00-foundation` |
| M01 | Interfață generală inspirată din referință | M00 | `feat/m01-ui` |
| M02 | Autentificare, substații și drepturi | M01 | `feat/m02-access` |
| M03 | Angajați, titulari și mașini | M02 | `feat/m03-people-vehicles` |
| M04 | Catalog, unități, loturi și praguri | M02 | `feat/m04-catalog` |
| M05 | Recepții și stoc real | M04 | `feat/m05-stock` |
| M06 | Ture și predare către titular | M03, M05 | `feat/m06-issues` |
| M07 | Dovezi și semnătură pentru închidere | M06 | `feat/m07-evidence` |
| M08 | Consum, retur și raport individual | M07 | `feat/m08-closeout` |
| M09 | Rapoarte agregate și dashboard real | M08 | `feat/m09-reporting` |
| P01 | Demo publicat, cu date fictive și găzduire gratuită | M09 | `feat/p01-demo` |
| M10 | Corecții controlate și consultarea auditului | M09 | `feat/m10-corrections` |
| M11 | Pilot, copii de siguranță și pregătire operare | M10 | `feat/m11-pilot` |

## M00 — Fundația proiectului

**Include:** Next.js cu TypeScript, manager de pachete și versiuni fixate, structură minimă modulară, fișierele de plan în repository, `.gitignore`, `.env.example` fără secrete, format/lint, verificarea tipurilor și o verificare de compilare. Stabilește scripturile pentru testele care vor fi introduse ulterior. Documentează pornirea locală pe mediul disponibil. Nu creează tabele sau pagini fictiv funcționale pentru toate modulele viitoare.

**Acceptare:** o clonare nouă poate instala dependențele și porni aplicația urmând README; pagina inițială se deschide; verificările configurate trec; niciun secret în fișierele urmărite.

**Limite:** configurări, pagina inițială, structură și documentație. Nicio logică de stoc.

**Încheiere:** commit de fundație și STATUS actualizat. Git se inițializează numai în folderul dedicat, după verificarea faptului că nu aparține accidental altui repository. GitHub și găzduirea nu sunt necesare pentru acest modul.

## M01 — Interfața comună

**Include:** bară laterală, antet, selector vizual de substație, navigație, carduri, tabel cu filtre, formulare și stări standard. Folosește `reference/dashboard-reference.png` pentru culori, spațiere și densitate. Interfață în română, cu adaptare la telefon.

Clarificare confirmată la începutul M01: imaginea este numai inspirație pentru culori, fonturi și aspect, nu sursă de funcționalități. Fluxurile rămân cele stabilite în plan și WORKFLOWS (D37).

Pregătește două perspective vizuale: vederea de ansamblu „Logistică / Magazie” și „Tura mea”, cu „Start tură”, alegerea mașinii și previzualizarea fișei primite. Include stările „Nicio mașină disponibilă”, „În așteptarea fișei” și „Fișă de acceptat”. Paginile de prezentare nu acordă roluri reale; accesul efectiv se implementează în M02, iar operațiile în M06.

**Acceptare:** pagini navigabile, aspect verificat pe calculator și telefon, etichete și controale accesibile, stări fără date/încărcare/eroare. Orice exemplu este marcat „Date demonstrative”; butoanele pentru funcții încă neimplementate nu pretind că salvează.

**Limite:** componente vizuale, layout și pagini de prezentare; fără a inventa un backend temporar care trebuie înlocuit ulterior.

## M02 — Conturi, substații și roluri

**Include:** autentificare, sesiune pe server, utilizatori invitați/creați prin fluxul administrativ configurat, substații, roluri și selector funcțional. Creează structura de audit și înregistrează modificările de drepturi. Se introduce prima migrare SQL și politicile de acces. Administratorul inițial este creat printr-o procedură documentată, fără parolă universală în repository.

Definește distinct logistica centrală (vedere și operații în toate substațiile instituției, atribuite explicit), gestionarul local și șeful de tură (numai date proprii). Contul șefului de tură este individual; legătura efectivă cu angajatul se integrează în M03. M02 definește contractul de identitate și regula de proprietar, fără tabele de ture fictive.

**Acceptare:** utilizatorii cu drepturi locale în substații diferite nu își pot accesa reciproc datele; schimbarea manuală a identificatorului în URL nu ocolește accesul; rolurile sunt verificate și la operațiile pe server. Logistica centrală poate accesa explicit toate substațiile instituției, fără să administreze conturi sau roluri. Nici șeful de tură, nici gestionarul local ori șeful de substație nu își pot acorda singuri roluri globale. Contractul de acces propriu este verificat comportamental în M02; izolarea fișelor/turelor între doi șefi din aceeași substație se verifică pe entitățile reale în M06 și pentru dovezi/rapoarte în M07–M09.

**Limite:** `identity`, `substations`, infrastructura minimă de audit și integrarea cu navigația. Configurarea serviciilor reale este necesară aici; lipsa accesului se raportează explicit, fără a eticheta autentificarea simulată drept finalizată.

## M03 — Personal, titulari și mașini

**Include:** angajați, apartenență la substație, activ/inactiv, bifă titular, cont opțional pentru evidență și mașini active/apte de utilizare. Șeful de substație/adminul gestionează titularii. Legătura cu un cont individual este obligatorie pentru operarea „Tura mea”. Pregătește interfața publică de citire a titularilor eligibili și flotei; ocuparea mașinilor prin cereri/ture se integrează în M06.

**Acceptare:** un angajat simplu nu apare în lista eligibilă; bifarea și debifarea actualizează lista; un angajat poate exista fără cont, dar nu poate opera personal „Tura mea” până la asocierea contului. Identitatea titularului se rezolvă din cont pe server, fără posibilitatea alegerii altui angajat de către șeful de tură. Mașinile și angajații sunt limitați la substația potrivită; mașinile inactive sau indisponibile tehnic sunt excluse din selecție; schimbările sunt auditate.

**Limite:** `employees`, `vehicles`, permisiunile necesare și propriile migrări. Nu construiește încă predarea.

## M04 — Catalog, unități și loturi

**Include:** produse, categorii, unitate de bază și precizie, setarea urmăririi lotului/expirării, praguri pe substație și structura loturilor. Diferențiază produsul comun de cantitatea locală. Nu permite schimbarea unității unui produs deja folosit în mișcări.

**Acceptare:** se pot configura produse urmărite pe lot și produse fără lot comercial; câmpurile obligatorii sunt validate; pragurile diferă între substații; nu se însumează unități incompatibile. Se poate dezactiva un produs.

**Limite:** `catalog` și metadatele de lot din `inventory`; nu se introduce un câmp „stoc” editabil manual.

## M05 — Recepții și motorul de stoc

**Include:** locații, operații, jurnal de mișcări, proiecția soldurilor, comanda `postReceipt`, recepții cu document și linii, stoc inițial ca operație și ecranul stocului. Definește contractul unic prin care viitoarele predări vor modifica inventarul. Stabilește permisiunile care interzic modificarea directă a soldurilor și jurnalului.

**Acceptare:** recepția de 100 bucăți produce sold 100; repetarea cererii nu dublează intrarea; eșecul unei linii anulează întreaga operație; jurnalul și soldul se reconciliază; loturile expirate/blocate sunt excluse din disponibilul pentru predare.

**Limite:** `inventory`, `receipts`, ecranele lor și propriile migrări. Dacă trebuie împărțit, M05a introduce motorul cu verificări, iar M05b recepțiile și ecranul funcțional; M06 începe după ambele.

## M06 — Ture și predare

**Include:** „Start tură” inițiat de șeful de tură, selecția și rezervarea mașinii, cerere în așteptare, fișă pregătită/trimisă de magazie cu versiuni pe lot și cantitate, acceptare de titular fără editare, predare și pornire atomică. Include semnalarea neconcordanțelor, înlocuirea fișei și anularea cererii înainte de predare. Suplimentările au fișe separate, acceptate în aceeași tură, fără repornire. Data operațională folosește momentul efectiv al acceptării inițiale, separat de intervalul planificat. Prezintă separat cererile, turele deschise, depozitul și produsele aflate în ture.

**Acceptare:** fișa trimisă pentru 10 din 100 păstrează soldul 100; acceptarea produce 90 în depozit, 10 în tură și tura deschisă în aceeași tranzacție. Nontitularii, utilizatorii inactivi, fișa veche/retrasă și acceptarea de către alt cont sunt respinse pe server. Doi șefi din aceeași substație nu pot citi sau modifica reciproc fișele/turele; magazia nu poate accepta în locul titularului. Două cereri simultane nu rezervă aceeași mașină; două acceptări nu consumă același disponibil. Stocul devenit insuficient între trimitere și acceptare nu produce acceptare sau mișcări parțiale. Repetarea cererii, inclusiv cu altă cheie pentru aceeași fișă, nu dublează predarea. Înlocuirea/anularea concurentă cu acceptarea are un singur rezultat valid. Anularea înainte de predare eliberează mașina și invalidează fișa. Suplimentarea acceptată păstrează momentul inițial și mașina turei. Unicitatea mașinii/titularului acoperă cererile în așteptare, turele deschise și cele în așteptarea închiderii.

**Limite:** `shifts`, integrare prin contractele `inventory`, paginile și migrările necesare. Regresie obligatorie pentru recepțiile din M05.

## M07 — Dovezi și semnătură

**Include:** ciorna declarației de închidere, versiuni de conținut, atașare PDF/foto, captură semnătură, nume semnatar și identitatea colectorului, validări fișiere, acces privat și politica dovezilor pe substație. Nu finalizează stocurile înainte de M08.

**Acceptare:** încărcare și previzualizare, semnare reală pe ecran tactil, resetare înainte de trimitere, refuz pentru semnătură goală și fișier nevalid; altă substație nu poate descărca dovada; schimbarea cantităților invalidează asocierea cu semnătura anterioară. În UI este clar că raportul este ciornă.

Verifică și că un alt șef de tură din aceeași substație nu poate vedea/descărca dovezile. Acceptarea fișei de predare din M06 păstrează identitatea contului și versiunea fișei; nu înlocuiește semnătura sau dovezile pentru închiderea din M07.

**Limite:** `evidence` și partea de declarație/versiune din `shifts`. Contractul de validare a dovezilor este documentat pentru M08.

## M08 — Închiderea și raportul turei

**Include:** trimiterea declarației, verificarea gestionarului, consum, retur, închidere atomică, versiune finală nemodificabilă și PDF individual. Introduce regenerarea PDF independentă de operația de stoc.

**Acceptare:** scenariul 100/10/6/4 se încheie cu 94 în depozit; consumul nu scade încă o dată depozitul; închiderea repetată nu dublează returul; dovezile invalide sau neconcordanța cantităților blochează închiderea. Eșecul PDF nu redeschide tura. Raportul păstrează datele chiar dacă produsul sau angajatul este ulterior redenumit.

Șeful de tură completează și trimite numai declarația proprie; magazia confirmă returul și finalizează închiderea. Testează refuzul închiderii definitive de către titular și accesul între doi titulari ai aceleiași substații. Mașina se eliberează la închiderea confirmată, conform regulii inițiale D17/D35.

**Limite:** `shifts`, contractele tranzacționale din `inventory`, verificarea din `evidence` și raportul individual din `reports`. Aceste modificări între module sunt necesare integrării, nu o rescriere a lor.

## M09 — Rapoarte și dashboard

**Include:** filtre pe ture/zile/săptămâni și interval, rapoarte de consum, mișcări și stoc, PDF/CSV, indicatori reali și grafice relevante. Înlocuiește exemplele din M01 cu citiri autentificate. Include lista turelor neînchise.

Vederea de ansamblu a logisticii centrale acoperă substațiile instituției, iar gestionarul local vede numai aria atribuită. „Tura mea” afișează exclusiv fișele, turele și rapoartele proprii. Cererile fără fișă și fișele de acceptat sunt distincte de turele efectiv pornite.

**Acceptare:** totalurile se reconciliază cu rapoartele individuale și jurnalul; turele peste miezul nopții respectă data operațională; mișcările de depozit folosesc momentul înregistrării; filtrele și exporturile respectă substația; nu există amestec de unități în indicatori.

Filtrele și exporturile șefului de tură verifică și proprietarul, nu doar substația. Acceptarea după miezul nopții folosește noua dată operațională chiar dacă cererea sau intervalul planificat începeau în ziua anterioară.

**Limite:** `reports`, `dashboard` și interogările de citire necesare; nicio modificare a formulelor de stoc pentru a „potrivi” un raport.

## P01 — Publicare demo

Actualizare 10 septembrie 2026: beneficiarul a cerut publicarea anticipată a
incrementului M06. Aceasta nu înseamnă finalizarea P01: scenariul complet cu
dovezi, închidere și rapoarte rămâne dependent de M07–M09. Starea găzduirii este
consemnată în `STATUS.md`.

**Include:** date fictive pentru Roșiori, două mașini și câțiva angajați/produse; scenariu pregătit de recepție–predare–consum/retur–semnătură–raport; conturi de test individuale; proiect Supabase Free și aplicație Next.js publicată pe Netlify Free. Configurează build-ul din repository-ul distant ales de utilizator și adresa gratuită Netlify. Leagă domeniul propriu doar dacă este dorit și disponibil.

Scenariul folosește un cont de logistică și două conturi de șef de tură: selecție mașină → fișă pregătită de magazie → acceptare și pornire → consum/retur → verificare magazie și raport. Demonstrează și vederea de ansamblu, și faptul că cei doi șefi nu văd reciproc datele.

**Acceptare:** linkul funcționează pe calculator și telefon; fluxul complet poate fi prezentat cu date fictive; documentele de test rămân private; cheile și parolele nu apar în Git sau în interfața publică; există o procedură pentru refacerea datelor demonstrative, limitată strict la mediul demo. Verifică bugetele gratuite și accesul înainte de prezentare. Dacă lipsesc accesul la servicii sau destinația Git, pregătește configurația și raportează exact dependența, fără a declara site-ul publicat.

**Limite:** publicare pentru demonstrație, fără înscriere la servicii plătite sau folosirea datelor reale ale instituției. Codul și migrările sunt salvate în Git; păstrează o copie exportabilă a datelor și fișierelor demo dacă prezentarea trebuie refăcută. Pornirea unui modul de dezvoltare nu publică automat o versiune nouă.

## M10 — Corecții și istoric consultabil — etapă ulterioară

**Include:** ecran de audit, cereri/corecții cu motiv și aprobare a șefului, mișcări compensatorii, raport rectificat și legătura la original. Auditul existent din modulele anterioare se afișează, nu se inventează retroactiv.

**Acceptare:** documentele originale nu se modifică; corecția produce rezultatul calculat și rămâne identificabilă în rapoarte; utilizatorii fără rolul potrivit nu pot aproba; o corecție care ar produce sold negativ eșuează complet; sunt cerute dovezile aferente versiunii noi.

**Limite:** `audit`, contractul de corecție din `inventory`, versiunile de închidere și afișarea lor în `reports`. Regresii pe fluxul complet M05–M09.

## M11 — Pilot și operare — etapă ulterioară

**Include:** mediu de pilot separat, configurație reală pentru Roșiori, copii de siguranță pentru date și fișiere, restaurare verificată, procedură de publicare și revenire, ghid scurt pentru gestionar/titular/șef. Testează procedura completă cu date demonstrative înainte de utilizarea operațională.

**Acceptare:** circuitul recepție–predare–dovadă–consum/retur–raport funcționează pentru doi utilizatori; accesul între substații rămâne izolat; restaurarea include fișierele; procedura de corecție este utilizabilă; limitările cunoscute sunt scrise. Datele reale se introduc în mediul stabilit pentru operare, nu în datele demonstrative din Git.

**Limite:** publicare, exploatare și remedierea problemelor pilotului. Integrarea unui modul în Git nu constituie automat publicare în producție.

## Rutina la sfârșitul fiecărui modul

1. Verifică funcționalitatea pe scenariul concret și rulează controalele relevante. Folosește baza PostgreSQL reală de test pentru concurență, tranzacții și drepturi; simulările nu demonstrează aceste proprietăți.
2. Verifică diferențele Git și elimină modificările accidentale proprii, fără a șterge munca utilizatorului.
3. Actualizează `STATUS.md`: realizat, verificat, limitări, branch și următorul pas. Actualizează `DECISIONS.md` numai dacă există o decizie nouă.
4. Salvează în unul sau mai multe commituri coerente. O funcționalitate poate avea mai multe commituri; punctul de predare trebuie să fie clar.
5. Integrează versiunea validată în baza comună conform fluxului Git convenit. Următoarea conversație pornește de la această versiune, nu de la un branch fără modulul precedent.
6. În răspunsul de predare notează ce funcționează, ce verificări au trecut, identificatorul commitului și modulul următor. Dacă o verificare nu a putut fi rulată, scrie exact asta.

Un commit local păstrează progresul pe calculator. Sincronizarea într-un repository distant este un pas separat, folosit după configurarea destinației.
