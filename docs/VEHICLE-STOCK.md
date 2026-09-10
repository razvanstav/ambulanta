# Stoc permanent pe mașină și închiderea turei

Actualizat: 10 septembrie 2026. Cerința nouă înlocuiește returul implicit la final.

## Circuit

1. Titularul selectează mașina și stabilește obligatoriu începutul și finalul
   programat, în ora României. Finalul nu poate fi scurtat prin aplicație.
2. Magazia trimite fișa. Acceptarea transferă materialele din magazie în locația
   permanentă a mașinii și pornește tura. Se păstrează separat cantitățile găsite
   deja în mașină și completările primite pentru tura curentă.
3. Dacă există stoc în mașină, magazia poate trimite o fișă de preluare fără
   completare. Acceptarea nu produce o nouă scădere a magaziei.
4. La final titularul completează numai cantitatea consumată. Restul se calculează
   imediat și rămâne în mașină. Nu există câmp de retur sau pași pentru dovezi.
5. După finalul programat, un singur buton salvează declarația, scade consumul,
   păstrează restul în mașină, închide tura și eliberează mașina/titularul atomic.
6. Declarațiile și dovezile vechi rămân în istoric. Un retur început înaintea
   simplificării poate fi confirmat de magazie.

**Exemplu:** magazie 100 → predare 10 → magazie 90, mașină 10 → consum 7 →
magazie 90, mașină 3. Următoarea tură preia cele 3 fără altă scădere a magaziei.

Pe fiecare alocare: **preluat = consumat + rămas în mașină**.
În timpul turei, stocul afișat este soldul înregistrat; ciorna nu reprezintă
mișcare de stoc. Consumul este înregistrat la închiderea confirmată.

## Date și autorizare

- `inventory_locations.kind = vehicle` are unicitate pe mașină. Locațiile vechi
  `shift` rămân în istoric; migrarea mută soldurile prin jurnal și motorul unic.
- `shift_stock_allocations` păstrează instantanee nemodificabile: `opening`
  pentru stocul preluat și `issue` pentru completări. Dovezile și declarațiile
  nu sunt legate de soldul variabil al mașinii.
- `list_vehicle_stock` expune magaziei stocurile substației și titularului numai
  stocul mașinii rezervate/active proprii. Nu acordă următorului titular acces
  la mișcările, fișele sau dovezile titularului precedent.
- `submit_vehicle_closeout` verifică proprietarul, ora bazei de date,
  versiunea, alocările și dovezile sub blocarea instituției și turei.
- `confirm_vehicle_return` cere un gestionar distinct de titular și versiunea
  trimisă exactă. `app_private.finalize_vehicle_closeout` postează consumul și
  returul prin `move_stock`, apoi înregistrează versiunea finală și închiderea.
- Încercările repetate/concurente de închidere nu dublează stocurile.
  Suplimentările acceptate invalidează declarația veche; cele neacceptate sunt
  retrase la închidere. O eroare de stoc anulează întreaga tranzacție.
- Turele existente fără program folosesc `set_legacy_shift_schedule` o singură
  dată, cu final în viitor. Declarațiile din modelul vechi se salvează din nou.

## Activare pe Supabase și Netlify

Migrarea `202609100008_simple_closeout.sql` adaugă închiderea simplă într-o singură
tranzacție și face dovezile opționale. A fost aplicată și înregistrată în Supabase
pe 10 septembrie 2026. Funcția este acordată numai rolului `authenticated`, cele
două substații au politica opțională, iar verificarea jurnalului a raportat 0
diferențe.

Migrarea nouă este `202609100007_vehicle_stock_closeout.sql`. Cele șase migrări
anterioare nu se modifică și nu se rerulează. Migrarea 007 a fost aplicată și
înregistrată în Supabase pe 10 septembrie 2026. Soldurile vechi au fost transferate
fără diferențe de jurnal. Netlify a publicat apoi commitul `50eae63`, deploy
`6aa31299110cc36e9cb9fbd9`. Nici migrarea 007 nu se rerulează pe acest proiect.

Interfața simplificată a fost publicată ulterior din commitul `b44e551`, deploy
`6aa31946b0816dccbe519a4f`, după aplicarea migrării 008. Ambele migrări sunt deja
active în proiectul demo și nu se rerulează.

Procedura pentru un alt mediu:

1. Aplică migrările 007 și 008 în ordine, într-o fereastră fără operații de stoc
   concurente.
2. Verifică regresiile `npm run test:integration` cu fixture noi și apoi E2E.
   Curățarea fixturelor a fost adaptată noilor tabele și referințe finale.
3. Publică versiunea aplicației numai după reușita migrărilor și verifică fluxul
   pe Netlify. Codul nou necesită ambele migrări.

## Verificări locale

`npm run check` verifică formatarea, lint, tipurile, 16 teste unitare și buildul.

`tests/postgres/vehicle-stock.mjs` rulează 14 scenarii pe PostgreSQL real, într-o
bază nouă izolată. Include migrarea cu stoc și semnătură existente, 10/7/3,
preluarea următoare, retur, concurență, drepturi, ora de închidere, invalidarea
versiunilor, închiderea simplă dintr-un pas, rollback și reconcilierea integrală
cu jurnalul.

Necesită un server PostgreSQL local cu drept de creare a bazelor și modulul
Node `pg`. Configurează `TEST_DATABASE_URL` cu adresa locală. `TEST_PG_MODULE`
poate indica modulul `pg`; implicit se folosește instalarea izolată în
`.tools/runtime/node_modules/pg/lib/index.js`.

```powershell
node tests/postgres/vehicle-stock.mjs
```

Testul refuză gazde nelocale și creează o bază nouă `ambulanta_test_<uuid>`;
nu șterge baze existente. Schema Auth și metadatele Storage sunt infrastructură
de test. Validarea tranzacțiilor/RLS este reală, dar aceste teste nu validează
serviciile HTTP Supabase Auth/Storage găzduite.

Interfața a fost verificată în Chromium desktop și mobil, cu date fictive și
adaptor HTTP local peste PostgreSQL: filtre, stoc, calcul rămas, salvare ciornă,
explicații dovezi, semnătură păstrată și închidere temporizată. Capturile sunt
în `.verification/vehicle-ui/`, ignorate de Git. Adaptorul este exclus din aplicație.

Pe mobil s-a verificat și închiderea efectivă prin acțiunea server după final,
cu soldul rămas în mașină și trecerea la istoric. Regresia E2E locală are 18 teste
trecute și 16 omise explicit pentru lipsa fixturelor Supabase găzduite.

PDF-ul individual final și rapoartele agregate rămân pentru continuarea M08/M09;
această modificare nu le declară implementate.
