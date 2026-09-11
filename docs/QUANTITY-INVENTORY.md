# Gestiune pe cantități — 11 septembrie 2026

Cerința D69 simplifică aplicația funcțională la produse și cantități:
magazie → mașină → consum → rămas în mașină. Nu se urmăresc praguri,
expirare, loturi comerciale sau stări de lot în fluxul curent.

## Interfață și calcul

- „Produse” conține denumirea, codul, unitatea și tipul cantității. Un produs
  nou este disponibil imediat în substație pentru recepție.
- Stocul magaziei și al mașinii are un singur rând per produs. Cantitățile
  din surse diferite se adună după identitatea produsului, nu după nume.
- Recepția și fișa folosesc produs + cantitate. Produsele inactive rămân
  consultabile în stoc, dar nu primesc operații noi de distribuție.
- La închidere, titularul declară un singur consum per produs, inclusiv când
  au existat suplimentări. Diferența rămâne în mașină pentru următoarea tură.
- Limita temporală, proprietarul turei și tranzacțiile atomice rămân în vigoare.

## Compatibilitate și migrare

Migrarea `202609110009_quantity_only_inventory.sql` este aplicată și înregistrată
în Supabase. Nu se rerulează și nu se modifică. Soldurile sunt comparate înainte
și după, în aceeași tranzacție sub blocarea instituțiilor; orice diferență anulează
migrarea. Nu sunt șterse sau rescrise mișcări, fișe, declarații ori dovezi istorice.

Identificatorii vechi de stoc rămân numai suport intern pentru motorul existent.
Recepțiile noi primesc automat un identificator tehnic. Distribuția împarte
cantitatea cerută între soldurile produsului, sub blocarea instituției, după
verificarea reluării cererii. Expirarea și blocarea vechilor loturi nu mai
restricționează fișa sau acceptarea. Cantitățile insuficiente sunt refuzate atomic.

Închiderea transformă consumul per produs în alocările nemodificabile existente,
în ordine stabilă, fără aritmetică zecimală aproximativă. RPC-ul reverifică
proprietarul, versiunea, toate alocările și precizia înaintea mișcării efective.
Nu se schimbă unitățile produselor cu stoc sau identitățile istorice.

RPC-urile noi sunt `save_simple_product`, `post_product_receipt`,
`save_product_issue_sheet` și `list_vehicle_product_stock`, numai pentru rolul
`authenticated`, cu verificările existente de acces pe server. Helperii interni
nu sunt executabili de browser. Citirile agregate păstrează izolarea titularului.

## Verificare

- `npm run check`: format, lint, TypeScript, unitare și build.
- `npm run test:postgres`: 21 scenarii PostgreSQL local, inclusiv migrare cu
  solduri existente, produs cu două surse expirate/blocate, recepție automată,
  concurență, idempotență, acces străin, cantități insuficiente, consum 12/7/5,
  preluarea restului de titularul următor și reconciliere integrală cu jurnalul.
- `npm run test:quantity:setup`: fixture de acces separată și doi titulari,
  cu două mașini fictive pentru browser. Necesită proiectul demo explicit în
  `M02_TEST_PROJECT_REF`; folosește `.env.local`, exclus din Git.
- `npm run test:e2e -- tests/e2e/stock-shifts.spec.ts`: circuit cantitativ desktop
  și Pixel 7. `npm run test:integration:cleanup` elimină numai fixturea verificată.

Rulările efective și publicarea sunt consemnate în STATUS. Testele istorice M04
păstrează verificările de integritate ale metadatelor existente; acestea nu sunt
funcționalități expuse în fluxul curent. Previzualizarea statică M01 `/demo`
rămâne un prototip istoric, nu aplicația persistentă.
