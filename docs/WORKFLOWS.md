# Perspectivele aplicației și fluxul turei

Actualizat: 10 septembrie 2026. Acest document descrie cerințele și propunerile
pentru modulele următoare. În cod este implementată numai fundația M00.

## Două perspective, aceeași aplicație

| Perspectivă             | Ce vede și ce face                                                                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Logistică / Magazie** | Vedere de ansamblu asupra substațiilor, stocului, mașinilor, turelor și fișelor; recepționează, pregătește distribuțiile, trimite fișele și urmărește acceptările, consumul și retururile.                                                              |
| **Tura mea**            | Șeful de tură vede propriile fișe, tura curentă și istoricul propriu. Inițiază „Start tură”, selectează o mașină disponibilă și acceptă fișa pregătită de magazie. La final declară consumul și returul, conform fluxului de închidere deja planificat. |

Separarea celor două perspective și inițiativa șefului de tură sunt **confirmate
de beneficiar**. O singură aplicație cu meniuri și drepturi diferite păstrează
arhitectura existentă; cele două perspective nu cer două proiecte sau baze de date.

Șeful de tură este modelat ca titularul responsabil, cu cont individual legat de
angajat. Pentru o tură nouă trebuie să fie activ, titular în substație și autorizat
pentru acea substație. Un angajat poate exista în evidență fără cont; nu poate
opera personal această perspectivă fără autentificare. „Șef de tură” și „șef de
substație” rămân roluri diferite.

Logistica centrală primește explicit drepturi operaționale asupra tuturor
substațiilor instituției, pentru vederea de ansamblu și distribuție. Acest rol nu
permite acordarea de roluri sau administrarea conturilor. Un gestionar local
primește aceleași funcții numai în substațiile atribuite. Administratorul acordă
drepturile; utilizatorii nu și le pot extinde singuri.

Accesul se verifică pe server și în baza de date. Șeful de tură nu poate citi
fișele, produsele alocate, rapoartele sau dovezile altui șef de tură, nici măcar din
aceeași substație. Lista de mașini disponibile expune doar datele necesare
selecției, fără datele turelor sau identitatea altor utilizatori. Un cont cu mai
multe roluri primește numai drepturile atribuite explicit, nu drepturi rezultate
din schimbarea meniului.

## Pornirea turei

**Confirmat prin D33:** acceptarea fișei reprezintă confirmarea primirii fizice,
produce predarea în stoc și pornește efectiv tura. Beneficiarul a confirmat
explicit acest moment. Rezervarea mașinii la crearea cererii și detaliile de
anulare din pașii de mai jos sunt propunerea tehnică D35.

1. Șeful de tură apasă **„Start tură”** și selectează substația autorizată, dacă
   are mai multe, apoi mașina disponibilă. Identitatea titularului vine din
   sesiunea sa; nu selectează un alt titular.
2. Confirmarea selecției creează o cerere **„În așteptarea fișei”**
   (`awaiting_issue`) și rezervă mașina pentru această cerere. Această rezervare
   nu înseamnă că tura a pornit și nu schimbă stocul.
3. Magazia vede cererea, pregătește produsele/accesoriile, loturile și cantitățile
   și trimite o versiune a fișei pentru tura, titularul și mașina respectivă.
   Cererea devine **„Fișă de acceptat”** (`awaiting_acceptance`). Trimiterea este
   internă aplicației, fără notificări externe obligatorii.
4. Șeful de tură citește fișa și apasă **„Accept fișa și pornesc tura”**. Nu poate
   modifica produse, loturi sau cantități. Dacă observă o diferență, poate semnala
   neconcordanța cu motiv; magazia emite o versiune nouă pentru acceptare.
5. Serverul reverifică drepturile, eligibilitatea, mașina, starea cererii,
   versiunea fișei și stocul. În aceeași tranzacție salvează acceptarea, execută
   predarea prin motorul unic de stoc și deschide tura (`open`). Momentul efectiv
   al pornirii se păstrează UTC; data operațională se calculează în
   `Europe/Bucharest` din acel moment. Intervalul planificat rămâne separat.

Magazia poate păstra o ciornă de fișă înaintea cererii. O versiune trimisă pentru
acceptare trebuie legată de o cerere concretă, cu mașina deja aleasă. Dacă nu există
încă fișă, șeful de tură vede clar starea de așteptare; aplicația nu inventează
produse și nu prezintă tura ca activă.

### Mașina și concurența

O mașină disponibilă este activă, aptă de utilizare, din substația selectată și
neocupată de altă cerere/tură. Rezervarea și unicitatea titularului se verifică
atomic în PostgreSQL pentru `awaiting_issue`, `awaiting_acceptance`, `open` și
`pending_close`. O ciornă `draft` care nu a fost trimisă nu rezervă mașina.

Înainte de predare, șeful de tură își poate anula cererea, iar magazia poate anula
cereri din aria sa de acces, cu motiv și audit. Anularea eliberează mașina și
invalidează fișele trimise. Schimbarea mașinii se face prin anularea cererii și o
nouă selecție, astfel încât o fișă pentru mașina veche nu poate fi acceptată.
După predare, mașina și titularul nu se schimbă prin editare; se urmează închiderea.

În propunerea inițială, mașina rămâne ocupată până la închiderea confirmată,
inclusiv cât se așteaptă verificarea returului (`pending_close`), conform D17.

### Fișa și corectitudinea stocului

O ciornă ori o fișă trimisă nu scade și nu rezervă cantități. Prin urmare, stocul
poate deveni insuficient între pregătire și acceptare. În acest caz întreaga
acceptare eșuează fără mișcări și fără pornirea turei, cu mesaj pentru cei doi
operatori; magazia pregătește o versiune nouă, dacă este necesar.

Versiunile trimise se păstrează. Înainte de acceptare, o modificare a fișei emite
o versiune nouă și împiedică acceptarea versiunii vechi. Dacă magazia retrage sau înlocuiește fișa
simultan cu acceptarea, numai o tranziție poate reuși. Se păstrează separat autorul
fișei, versiunea exactă acceptată, titularul care acceptă și momentele operațiilor.
Acceptarea din cont nu este semnătura desenată de la închidere, introdusă în M07.

Repetarea aceleiași cereri sau folosirea altei chei de cerere pentru o fișă deja
acceptată nu poate dubla predarea. O fișă acceptată nu se editează. Suplimentările
urmează același circuit magazie → fișă → acceptare de către titular, dar păstrează
tura `open`, mașina și momentul inițial de pornire.

Exemplu: 100 bucăți în magazie → fișă trimisă pentru 10, sold încă 100 → fișă
acceptată, 90 în magazie și 10 în tură → 6 consumate și 4 returnate confirmat,
94 în magazie. Nu se scade încă o dată depozitul la închidere.

## Închiderea și rapoartele

Fluxul de închidere planificat rămâne: șeful de tură declară consumul și returul
pentru propria tură, atașează dovezile și trimite spre verificare. Magazia confirmă
returul fizic și închide atomic; regula este `predat = consumat + returnat` pentru
fiecare alocare. Doar returul confirmat mărește magazia.

Logistica vede centralizat stocurile, cererile, fișele de acceptat, turele active,
consumul, retururile și rapoartele din aria sa. Șeful de tură vede numai situația și
rapoartele proprii. Indicatorii disting cererile de turele efectiv pornite.

## Module afectate și verificări de introdus

- **M01:** două perspective vizuale, meniuri specifice, fluxul „Start tură”, stări
  pentru lipsa mașinilor sau a fișei; fără salvări simulate.
- **M02:** identitatea șefului de tură, logistica centrală și accesul propriu;
  două persoane din aceeași substație nu pot citi reciproc datele, iar accesul
  central nu se poate acorda prin autoproclamare sau schimbarea adresei URL.
- **M03:** cont legat de titular și starea de utilizare a mașinii. Disponibilitatea
  calculată din cereri și ture se integrează în M06.
- **M06:** cerere, rezervarea mașinii, versiuni ale fișei, acceptare și predare;
  teste PostgreSQL pentru selecție concurentă, stoc insuficient, fișă veche,
  cereri repetate, anulare și acceptare în numele altui titular.
- **M08–M09:** închidere din perspectiva fiecărui rol și rapoarte limitate la
  aria de acces; verificarea exemplului 100/10/6/4 și a datei efective de pornire.
- **P01:** demonstrație cu un cont de logistică și două conturi de șef de tură,
  astfel încât acceptarea și separarea accesului să poată fi prezentate.
