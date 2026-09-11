# P01 — Ghid de demonstrație

Publicat pe 11 septembrie 2026: [aplicația](https://ambulanta.netlify.app/autentificare).
M00–M09 sunt disponibile în scopul demo actual D67/D69/D73/D75.
M10–M11 sunt etape ulterioare pentru corecții și utilizare operațională.

Actualizare: după resetarea cerută, Roșiori are 19 produse cu stoc, 10 angajați,
5 mașini și zero ture. Catalogul și personalul au denumiri uzuale, conform D76.
Substațiile vechi sunt arhivate/inactive; nu le reactiva pentru o probă nouă.

## Prezentare în Roșiori

Folosește contul administrativ din `private/razvan-admin.json` și titularul din
`private/cosmin-account.json`. Numai aceste două conturi sunt active după resetare.
Parolele se transmit individual; nu se includ
în documentație, URL-uri sau capturi publice. Contul administrativ gestionează
drepturile existente pe live; crearea conturilor noi se face din mediul local.

1. Intră în aplicație și selectează Roșiori. Arată „Logistică / Magazie”,
   produsele, personalul, cele cinci mașini și „Stocuri și recepții”.
2. Înregistrează un produs fictiv separat și o recepție de 100 bucăți, cu un
   număr de document unic. Nu reutiliza documentele unui test anterior.
3. Titularul intră în „Tura mea”, selectează o mașină disponibilă și intervalul.
   Cererea rezervă mașina; nu pornește încă tura și nu modifică magazia.
4. Magazia trimite o fișă cu 15 bucăți. Titularul verifică și acceptă fișa.
   Magazia ajunge la 85, mașina la 15. Fișa trimisă singură nu debitează stocul.
5. Titularul declară consumul 7 și închide la finalul planificat. Pentru o
   prezentare rapidă folosește explicit „Închide tura înainte”, cu motiv și
   confirmare. Diferența de 8 rămâne în mașină. În fluxul curent nu se cere
   semnătură sau încărcare de document; dovezile istorice rămân private.
6. Din istoric descarcă PDF-ul individual. În „Rapoarte” arată consumul final,
   mișcările magaziei, stocul, turele închise și cererile neînchise. Schimbă
   gruparea în săptămâni, titulari sau mașini și descarcă CSV/PDF.
7. Cosmin cere din nou aceeași mașină după eliberare. Magazia poate trimite
   o fișă fără completare; acceptarea preia cele 8 bucăți fără un nou debit al
   magaziei. Consum 3 → rest 5 în mașină; consum agregat 10, magazie 85.
8. Fiecare titular vede numai propriile ture și „Rapoartele mele”. Administratorul
   poate selecta toate substațiile autorizate; un rol local rămâne limitat.

Tura veche a fost închisă cu consum zero și păstrată în substația arhivată.
Toate cele cinci mașini noi sunt disponibile la finalul pregătirii.
Valorile de mai sus sunt pentru produsul nou, separat de stocurile existente.

## Refacerea verificării fără afectarea demonstrației existente

Următoarele comenzi creează instituții temporare distincte și conturi fictive.
Manifestul `.verification/m02-fixtures.json` păstrează strict identificatorii
acestei rulări. Setup-ul refuză să suprascrie un manifest existent.

```powershell
$env:M02_TEST_PROJECT_REF = "roxvzbhsszesglcaadcl"
npm run test:quantity:setup
$env:E2E_BASE_URL = "https://ambulanta.netlify.app"
npm run test:reports:live
```

Testul rulează circuitul cantitativ prin Supabase Auth/PostgREST, verifică
reluarea fără dublare, preluarea stocului la tura următoare, șapte grupări și
izolarea drepturilor. Apoi verifică pe Netlify zece exporturi, rapoartele proprii
și accesul la PDF-ul individual. Exporturile rămân în `.verification/p01-exports/`.
Interfața se verifică separat în browser pe desktop și telefon. Această comandă
nu pretinde că automatizează interfața. Pentru o nouă zi pornește o fixture nouă.

După inspecție:

Curățarea este definitivă și cere autorizare. Fixturea publicării din 11 septembrie
a fost eliminată după acordul beneficiarului; nu mai există manifestul acelei rulări.
Pentru alte rulări se folosește un manifest nou, cu țintele verificate de script.

```powershell
npm run test:integration:cleanup
```

Curățarea verifică numele instituțiilor și proprietatea conturilor înaintea
oricărei ștergeri. Elimină numai fixturele din manifest, inclusiv dovezile lor.
Nu resetează instituția „SAJ — Demonstrație”, conturile beneficiarului sau tura
existentă. Dacă un test este întrerupt, inspectează manifestul; nu-l șterge manual
pentru a forța o nouă rulare. Nu utiliza aceste comenzi într-un mediu operațional.

## Copia locală și limitele ei

`npm run export:demo`, cu aceeași variabilă de proiect, exportă numai instituția
„SAJ — Demonstrație” identificată de administratorul inițial. Scrie tabelele și
fișierele de dovadă în `backups/demo-<moment>/`, ignorat de Git. Verifică exact
soldurile față de jurnal. `data.json` păstrează metadatele; fișierul fiecărei
dovezi este `<id>.bin`. Exportul nu include parole sau chei Auth.

Este o copie pentru consultare/refacerea scenariului demo, citită secvențial;
ruleaz-o când nu se operează ture. Nu reprezintă backup tranzacțional și nu are
restaurare operațională automată. Refacerea testului se face prin setup-ul de mai
sus, cu identificatori noi. Nu importa solduri peste mișcările existente.
Backupul complet și restaurarea verificată în alt mediu aparțin M11.

## Înainte de prezentare

Verifică autentificarea, o pagină de rapoarte și disponibilitatea mașinii.
O pagină rămasă deschisă în timpul deployului poate necesita reîncărcare înainte
de trimiterea unui formular. `/demo` este numai previzualizarea vizuală M01;
datele persistente sunt după `/autentificare`.

Verifică bugetele în dashboardurile Netlify și Supabase. La publicare:
Netlify Free avea 102,6/300 credite disponibile; Supabase Free raporta
0,031/0,5 GB bază, 0,031/5 GB egress și 238/50.000 utilizatori activi lunar.
Valorile se actualizează cu întârziere. Nu sunt activate abonamente plătite.
Fișierele istorice rămân limitate la 4 MB pe Netlify. Limitele și eventualele
pauze ale serviciilor gratuite nu sunt garanții de disponibilitate operațională.
