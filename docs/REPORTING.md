# M09 — Rapoarte și dashboard

Implementat local la 11 septembrie 2026, conform D69 și D75.

## Ecrane și filtre

- `/substatia/[id]/logistica`: indicatori reali pentru ture pornite, cereri fără
  fișă, fișe de acceptat și ture închise, lista activității neînchise și grafice.
- `/substatia/[id]/rapoarte`: consum final, mișcări magazie, stoc curent,
  ture închise cu legături la PDF-ul individual M08, cereri/ture neînchise.
- `/substatia/[id]/rapoarte-proprii`: consumul și rapoartele titularului autentificat.
  Nicio citire a magaziei sau a stocului altor titulari în această perspectivă.

Perioada implicită: prima zi a lunii curente până mâine exclusiv. Intervalele
acceptă 1–366 zile, cu început inclus și final exclus. Gruparea consumului poate
fi pe zi, săptămână (luni), tură, titular, mașină, substație sau produs.
Filtre suplimentare: titular, mașină și o tură aleasă din lista turelor închise.
„Toate substațiile autorizate” include numai aria rolului curent, verificată în DB.

## Surse, semantica timpului și reconciliere

RPC-ul `read_reports(uuid,date,date,boolean,text,uuid,uuid,uuid)` este `STABLE`,
`SECURITY INVOKER`, cu `search_path` gol. Toate citirile folosesc același snapshot
PostgreSQL și RLS existent. Nu folosește cheia privilegiată și nu scrie în DB.
Valorile sunt agregate cu `numeric` și returnate ca text, fără pierderea preciziei
în JSON/JavaScript. RPC-ul întoarce un obiect JSON, nu o listă de rânduri paginată
implicit de PostgREST. Volumul este potrivit MVP-ului; nu este un export streaming.

Consumul se citește numai din `shifts.final_closeout_id`, din versiunea finală.
Identitatea produsului se rezolvă prin alocarea internă nemodificabilă, iar
denumirea și unitatea provin din declarația istorică. Denumirile istorice diferite
rămân rânduri separate; identitățile diferite nu se unesc doar fiindcă au același
nume. Nu se adună produse/unități diferite într-un total general.

Consumul și turele închise folosesc `operational_date`, fixată la pornirea
efectivă. Ora închiderii nu mută consumul în ziua următoare. Săptămâna începe luni.
Mișcările magaziei folosesc `inventory_operations.occurred_at`, cu limitele locale
convertite în PostgreSQL prin `Europe/Bucharest`, inclusiv zilele de 23/25 ore.

Sold inițial + recepții/stoc inițial − predări + retururi = sold final.
Mișcările sunt clasificate după sursă/destinație: închiderile istorice de tip
`closeout` pot conține retururi și sunt incluse. Returul nu se deduce din cantitatea
rămasă în mașină. Corecțiile operaționale M10 nu sunt introduse de acest modul.

Stocul este cel curent, la generare, pe produs și locație. Perioada și filtrele
de tură/titular/mașină nu restrâng stocul; filtrele de tură/titular/mașină nu
restrâng nici soldurile magaziei. Aceste limite apar în pagină și în exporturi.
Lista neînchisă și primele trei carduri arată situația curentă indiferent de
perioadă, cu filtrele de titular/mașină/tură aplicate. Turele neînchise nu sunt
considerate consum final zero. Cererile și fișele neacceptate nu sunt ture pornite.

## Export și acces

`GET /api/reports/aggregate` acceptă aceleași filtre, `station`, `kind` și
`format=csv|pdf`. Tipuri: `consumption`, `warehouse`, `stock`, `closed`, `pending`.
Pagina, CSV-ul și PDF-ul refolosesc aceleași definiții de coloane și selecție.
Exporturile sunt regenerate la cerere, cu aria, filtrele, baza temporală și momentul
generării. O descărcare ulterioară poate include operații nou confirmate.

CSV: UTF-8 cu BOM, câmpuri citate, escaparea ghilimelelor și protecție împotriva
interpretării textelor ca formule. PDF: font Unicode local, A4 landscape, antet de
tabel repetat și paginare inclusiv pentru denumiri lungi. Fișierele nu sunt salvate
în Storage sau pe URL public; răspunsurile folosesc `private, no-store` și `nosniff`.
Un eșec al exportului permite reîncercarea și nu modifică stocul sau tura.

Verificarea aplicației refuză accesul logistic al titularului; DB verifică din nou
aria și proprietarul. `p_own=true` impune `owner_id=auth.uid()` inclusiv conturilor
cu mai multe roluri. Alegerea identificatorului altei ture nu ocolește proprietarul.

## Migrare și publicare

Migrarea nouă: `202609110011_reporting.sql`. Adaugă numai funcția de citire și
dreptul de apel pentru `authenticated`; nu schimbă solduri, mișcări sau RLS.
La acest increment este verificată în PostgreSQL local, nu aplicată în Supabase.
Se aplică și se înregistrează înainte de deployul aplicației M09. Commitul folosește
`[skip netlify]` pentru a evita un deploy automat înaintea migrării. Nu modifica
și nu rerula migrările 001–010 existente pe mediul găzduit.

## Verificări reproductibile

- `npm run check`: format, lint, TypeScript, unitare și build.
- `npm run test:postgres`, cu `TEST_DATABASE_URL` local: creează o bază izolată,
  rulează 29 de scenarii de stoc/acces/raportare; include reconciliere, retur istoric,
  proprietar, instituție străină, filtre, redenumire, calendar și citiri concurente.
- Unitarele M09 verifică filtrele, CSV, endpointul privat și PDF-ul de cinci pagini
  cu 80 de produse. Artifactele de verificare rămân în `.verification/pdfs`.

Pentru verificarea UI fără mutații pe Supabase, două procese locale opționale:

1. Configurează `TEST_DATABASE_URL` către baza `ambulanta_test_...` raportată de
   testele PostgreSQL și rulează `node tests/postgres/report-preview.mjs`.
2. Pornește Next cu `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55440`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-preview`,
   `NEXT_TEST_DIST_DIR=.verification/next-m09`, apoi
   `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3101`.
3. Contul fictiv folosește `<id profil local>@example.test` și parola fixă
   `local-preview-only`. Acestea nu sunt conturi sau credențiale Supabase.
4. `node tests/postgres/report-http.mjs` verifică cele 10 exporturi CSV/PDF,
   cache-ul privat, anonimul, proprietarul și filtrele prin HTTP real.

Adaptorul acceptă numai baze locale izolate și ascultă doar pe loopback. Auth este
simulată strict pentru UI; interogările folosesc PostgreSQL real, rolul
`authenticated` și RLS. Acesta nu înlocuiește verificarea Auth/PostgREST pe Supabase.
Nu publica adaptorul, baza locală sau variabilele de test. Next poate adăuga automat
tipurile directorului de test în `tsconfig.json`; elimină acea schimbare temporară
după închiderea previzualizării. Configurația `.env.local` rămâne neschimbată.
