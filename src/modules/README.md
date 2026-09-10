# Modulele aplicației

Modulele funcționale se adaugă la etapa lor din `docs/ROADMAP.md`. M01 introduce
doar `demo`: pagini de prezentare și exemple fictive. Acestea nu sunt contracte de
domeniu, backend sau fallback pentru citiri autentificate eșuate.

M02 adaugă `identity` (sesiune, politici și acțiuni de acces) și `substations`
(administrarea substațiilor și a conturilor). `identity/index.ts` expune contractele
server; `identity/policy.ts` expune tipurile și regulile utilizabile în client,
iar `identity/actions.ts` este intrarea explicită pentru Server Actions.

M03 adaugă `employees` (personal, eligibilitate și identitate titular) și `vehicles`
(flotă și disponibilitate tehnică). Contractele server de citire sunt în `index.ts`,
mutațiile în `actions.ts`; toate folosesc sesiunea utilizatorului și RLS.

Fiecare modul expune contractele publice prin `index.ts`. Paginile din `src/app`
rămân puncte de intrare subțiri. Un modul nu importă detalii interne din altul.
Mișcările de stoc vor trece exclusiv prin `inventory` și tranzacțiile PostgreSQL.

Testele unitare viitoare se așază lângă cod, în fișiere `*.test.ts` / `*.test.tsx`.
Testele de tranzacții, concurență și RLS M02/M03 rulează pe PostgreSQL real prin
`tests/integration/access.mjs` și `tests/integration/people-vehicles.mjs`. Verificările UI sunt în
`tests/e2e`; punctele de integrare sunt descrise în `docs/UI.md`.
