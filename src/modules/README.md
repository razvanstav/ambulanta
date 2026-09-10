# Modulele aplicației

Modulele funcționale se adaugă la etapa lor din `docs/ROADMAP.md`. M01 introduce
doar `demo`: pagini de prezentare și exemple fictive. Acestea nu sunt contracte de
domeniu, backend sau fallback pentru citiri autentificate eșuate.

Fiecare modul expune contractele publice prin `index.ts`. Paginile din `src/app`
rămân puncte de intrare subțiri. Un modul nu importă detalii interne din altul.
Mișcările de stoc vor trece exclusiv prin `inventory` și tranzacțiile PostgreSQL.

Testele unitare viitoare se așază lângă cod, în fișiere `*.test.ts` / `*.test.tsx`.
Testele de tranzacții, concurență și RLS vor rula pe PostgreSQL real începând cu
modulele care introduc aceste comportamente. Verificările vizuale M01 sunt în
`tests/e2e`; punctele de integrare sunt descrise în `docs/UI.md`.
