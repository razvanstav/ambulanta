# Cereri, fișe și acceptare — M06

Migrarea `202609100005_shifts_issues.sql` este aplicată în proiectul demo.
`/substatia/[id]/ture` este spațiul magaziei; `/tura-mea` identifică titularul
din sesiune și filtrează explicit proprietarul și când contul are roluri cumulate.
Butonul „Actualizează situația” încarcă schimbările celuilalt operator. Nu există
încă actualizare automată în timp real sau notificări externe ale aplicației.

## Circuit

1. Titularul eligibil selectează o mașină liberă și creează cererea. Mașina este
   rezervată atomic. Intervalul planificat este opțional și interpretat în
   Europe/Bucharest. Tura nu este încă pornită și stocul nu se schimbă.
2. Magazia salvează o ciornă sau trimite fișa. Fiecare salvare produce o versiune
   nouă; versiunea curentă așteptată previne înlocuirea accidentală a schimbării
   altui operator. Ciornele nu sunt expuse titularului. Nicio cantitate nu este
   rezervată sau scăzută la pregătire/trimitere.
3. Titularul acceptă versiunea exactă, fără câmpuri editabile pentru cantități.
   Tranzacția reverifică rolul, apartenența, bifa Titular, contul, mașina, starea,
   versiunea, loturile și disponibilul. Salvează predarea, acceptarea și pornirea
   împreună. `started_at` este UTC, iar `operational_date` derivă din el în
   Europe/Bucharest. Autorul fișei trebuie să fie distinct de titular.
4. Neconcordanța oprește acceptarea acelei versiuni. Magazia o poate înlocui sau
   retrage. Titularul ori magazia poate anula cererea înainte de prima predare;
   se invalidează fișele și se eliberează mașina. Tura deja pornită nu se anulează.
5. Suplimentările folosesc alte versiuni acceptate în aceeași tură, fără schimbarea
   mașinii, titularului, momentului inițial sau datei operaționale.

## Date, acces și concurență

`shifts` păstrează cererea, identitatea, mașina și momentele.
`issue_sheet_versions` și `issue_sheet_lines` păstrează conținutul fiecărei
versiuni, inclusiv denumirea/unitatea/lotul din acel moment.
`issue_sheet_acceptances` are unicitate pe fișă și operație.

Unicitatea titularului, contului și mașinii acoperă așteptarea, tura deschisă și
viitoarea verificare a închiderii. Cererile au chei de idempotență; fișele au
versiuni și chei proprii; acceptarea este unică inclusiv cu chei diferite.
Aceeași cheie de operație cu alt conținut este respinsă. Înlocuirea, anularea și
acceptarea folosesc aceleași blocări, astfel încât o cursă are un singur rezultat
valid. Stocul insuficient nu lasă acceptări sau mișcări parțiale.

RLS și RPC-urile limitează titularii la propriile cereri, versiuni trimise,
acceptări, locații, solduri și mișcări. Datele altui titular din aceeași substație
sunt inaccesibile. Debifarea titularului oprește predările noi, dar păstrează
istoricul propriu cât timp contul și rolul local rămân active. Magazia nu poate
accepta în numele titularului. Scrierile directe sunt refuzate.

Cele 11 grupuri PostgreSQL verifică rezervarea concurentă, idempotența,
eligibilitatea/revocarea, ciornele, izolarea, scenariul 100→90/10, suplimentarea,
fișele vechi, loturile indisponibile, stocul concurent și cursele cu
înlocuire/anulare. E2E parcurge neconcordanța și versiunea nouă pe desktop și mobil.

## Limita actuală

Turele pornite rămân deschise până la implementarea M07–M08. Nu există încă
semnături, dovezi, consum/retur confirmat sau raport final. Nu marca demonstrația
M06 drept circuit operațional complet. P01 integral rămâne după M09; beneficiarul
a cerut separat publicarea anticipată a acestui increment.
