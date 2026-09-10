# Modulele aplicației

Modulele funcționale se adaugă la etapa lor din `docs/ROADMAP.md`. M00 nu introduce
implementări goale pentru autentificare, stoc, ture sau rapoarte.

Fiecare modul va expune contractele publice prin `index.ts`. Paginile din `src/app`
vor rămâne puncte de intrare subțiri. Un modul nu importă detalii interne din altul.
Mișcările de stoc vor trece exclusiv prin `inventory` și tranzacțiile PostgreSQL.

Testele unitare viitoare se așază lângă cod, în fișiere `*.test.ts` / `*.test.tsx`.
Testele de tranzacții, concurență și RLS vor rula pe PostgreSQL real începând cu
modulele care introduc aceste comportamente.
