# Recepții și motorul de stoc — M05

**Actualizare locală D61:** locația permanentă `vehicle` înlocuiește stocul ținut exclusiv pe tură. Consumul scade mașina; restul rămâne pentru următoarea tură. Returul fizic confirmat crește magazia. Migrarea 007 și verificările sunt în [VEHICLE-STOCK](VEHICLE-STOCK.md); nu este încă activată în Supabase găzduit. Descrierea de mai jos documentează baza M05 anterioară schimbării.

Migrarea `202609100004_inventory_receipts.sql` este aplicată în proiectul demo.
Ruta `/substatia/[id]/stocuri` arată soldurile pe lot, disponibilul, pragurile și
recepțiile. Administratorul, logistica centrală și gestionarul operează magazia;
șeful de substație consultă și primește rol gestionar explicit dacă trebuie să
înregistreze recepții ori predări.

## Contractul de stoc

`inventory_locations` separă depozitul de locațiile turelor.
`inventory_operations` identifică fiecare comandă prin substație, cheie UUID,
autor, conținut și moment UTC. `inventory_movements` este jurnalul operațiilor,
iar `stock_balances` este proiecția actualizată în aceeași tranzacție.

`app_private.move_stock` este singurul motor care actualizează soldurile. Nu este
apelabil de browser sau de rolul autentificat. Comenzile publice verifică rolul,
blochează instituția, reverifică accesul și apelează motorul. Blocarea comună
serializează și revocările, configurările de lot, rezervările și predările; este
o alegere simplă pentru volumul demonstrativ. Soldurile necesare sunt blocate
în ordine stabilă. Cantitățile sunt pozitive, exacte și respectă precizia.
Locațiile, loturile și operațiile sunt legate prin chei compuse pe substație.

`post_receipt` / acțiunea server `postReceipt` primește documentul, data,
furnizorul, 1–100 linii distincte pe lot și un motiv. Stocul inițial folosește
același circuit, cu tipul `initial`. Repetarea aceleiași chei și aceluiași conținut
întoarce recepția existentă. Alt autor sau conținut cu aceeași cheie este refuzat.
O linie invalidă anulează documentul, liniile, mișcările, soldurile și auditul.

Recepția poate consemna fizic un lot expirat/blocat, însă disponibilul pentru
predare îl exclude. Produsele trebuie să fie active global și local. Interfața
nu oferă câmp de editare a soldului; documentele validate nu se editează.
Rolurile aplicației nu scriu direct în tabele, nici administratorii. Cheia de
infrastructură rămâne privilegiată și este folosită doar local la bootstrap și
fixturele de test; nu reprezintă un rol de utilizator.

## Demonstrație și teste

După `seed:m04`, `npm run seed:m05` înregistrează o singură recepție fictivă pentru
cele 6 produse demo. Cheia fixă este limitată la substație; repetarea nu reface
soldurile și nu adaugă cantități. Mișcările ulterioare ale utilizatorului rămân.

Cele 5 grupuri PostgreSQL verifică 100 la recepție, replay concurent, rollback
complet, drepturi și izolare, zecimale exacte și reconciliere. M06 folosește același
motor și testează insuficiența și consumul concurent al disponibilului. Circuitul
UI verifică recepție 100 → predare 12 → suplimentare 3 → depozit 85.

Nu există încă retur, consum confirmat, corecții sau închidere: M07–M08 introduc
declarațiile, dovezile și închiderea. Valorile din ture nu se declară consumate
doar pentru că au ieșit din depozit.
