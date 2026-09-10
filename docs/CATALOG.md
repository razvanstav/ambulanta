# Catalog, praguri și loturi — M04

Migrarea `202609100003_catalog_lots.sql` este aplicată în proiectul demo
`ambulanta`. Nu se rerulează și nu se modifică după aplicare.

Produsele sunt comune instituției. Administratorul și logistica centrală le
creează, redenumesc și dezactivează. Gestionarul și șeful local pot configura
pragul, activarea locală și loturile numai în substațiile lor. Șeful de tură
primește conținutul propriei fișe, fără acces general la catalog sau loturi.

`products` păstrează codul unic, denumirea, categoria, unitatea, precizia și
urmărirea. Categoriile sunt Medicamente, Consumabile și Accesorii. Unitățile
sunt bucată, fiolă, comprimat, pereche, mililitru, litru și metru. Primele patru
sunt indivizibile; celelalte acceptă 0–3 zecimale. Nu există conversii de ambalaj.

Medicamentele cer lot comercial și expirare. Expirarea cere urmărirea lotului.
`station_product_settings` păstrează activarea și pragul fiecărei substații,
separat de orice sold. Numerele SQL sunt exacte, fără rotunjire la inserare;
pragurile nu acceptă fracții incompatibile, NaN, infinit sau valori negative.

`stock_lots` aparține unui produs și unei substații. Pentru produsele fără lot
comercial există un singur lot `INTERN` local. Codul și expirarea rămân fixe;
un lot greșit se blochează și se înregistrează unul corect. Unitatea, precizia
și urmărirea produsului sunt fixe din momentul primului lot în orice substație.
Astfel sunt protejate implicit și produsele folosite ulterior în mișcări.

Un lot este valabil până la sfârșitul zilei înscrise, în Europe/Bucharest.
Blocarea sau expirarea îl exclude din predare. Înregistrarea lui nu adaugă stoc.
Dezactivările păstrează istoricul. Scrierile din aplicație trec prin RPC cu motiv,
blocare pe instituție, reverificarea drepturilor și audit atomic. Tabelele au RLS.

`npm run seed:m04` completează în Roșiori 6 produse fictive, praguri și loturi,
fără suprascrierea datelor deja existente. Numele medicamentelor sunt explicit
demonstrative și nu constituie recomandări clinice.

Cele 9 grupuri PostgreSQL M04 verifică izolarea, drepturile, validările,
precizia, rollback-ul inclusiv auditul, dezactivarea, revocarea cu JWT existent
și unicitatea la cereri concurente. Circuitul E2E verifică și blocarea schimbării
unității după crearea lotului.
