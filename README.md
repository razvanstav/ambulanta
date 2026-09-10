# Plan de pornire — Gestiune substații

Pregătit la 10 septembrie 2026. Acest pachet conține arhitectura și instrucțiunile pentru implementare; aplicația nu este încă construită.

## Ideea de bază

O aplicație web în limba română, utilizabilă pe calculator, tabletă și telefon, pentru recepții în depozit, distribuirea produselor către titularii mașinilor, consum și retur la final de tură. Fiecare substație are propriul stoc și propriile drepturi de acces. La închiderea turei se poate atașa un document, o fotografie sau o semnătură desenată pe ecran. Rapoartele sunt disponibile pe ture, zile și săptămâni.

Recomandarea este o singură aplicație organizată pe module, într-un singur repository Git. Fiecare etapă produce o funcționalitate verificabilă, documentație actualizată și un commit. Următoarea conversație pornește de la acele fișiere și de la codul salvat.

Actualizare după clarificările beneficiarului: ținta este o prezentare cu date fictive, pe Netlify Free + Supabase Free, în limitele planurilor gratuite. Se poate folosi adresa gratuită Netlify. Etapele pentru demonstrație sunt M00–M09, apoi P01 — Publicare demo; corecțiile avansate și pilotul operațional M10–M11 rămân etape ulterioare.

## Fișiere

| Fișier | Ce conține |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Fluxuri, drepturi, date, stoc, dovezi, rapoarte și structură tehnică |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Module în ordine, limitele lor și criterii de acceptare |
| [AGENTS.md](AGENTS.md) | Reguli pentru Codex: domeniul modificărilor, verificări, Git și predarea contextului |
| [docs/STATUS.md](docs/STATUS.md) | Starea reală de la care începe următoarea conversație |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Decizii inițiale și presupuneri care pot fi schimbate explicit |
| [docs/PROMPTS.md](docs/PROMPTS.md) | Mesaj de început și mesaj reutilizabil pentru fiecare modul |
| [docs/reference/dashboard-reference.png](docs/reference/dashboard-reference.png) | Imaginea furnizată de beneficiar, ca reper vizual |

## Cum începi

1. Dezarhivează pachetul într-un folder dedicat aplicației și deschide acel folder ca proiect în Codex.
2. Folosește mesajul pentru prima conversație din `docs/PROMPTS.md`.
3. Construiește M00, verifică rezultatul și salvează-l în Git. Planul nu a inițializat încă un repository și nu a creat unul pe GitHub.
4. Începe următoarea conversație în același proiect, din versiunea care conține ultimul modul integrat. Folosește mesajul reutilizabil și precizează modulul următor.

Documentele folosesc Markdown, deci pot fi citite de Codex și urmărite în Git împreună cu aplicația. `AGENTS.md` se așază la rădăcina proiectului; Codex îl poate folosi pentru instrucțiunile proiectului. [Documentația oficială OpenAI](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## Cum lucrăm între conversații

Păstrează un singur folder de proiect pentru întreaga aplicație. `AGENTS.md` rămâne la rădăcină, iar celelalte documente în `docs/`, lângă cod. Nu copia folderul pentru fiecare modul. Dacă folosești o versiune de lucru separată, aceasta trebuie să includă ultimul modul finalizat înainte să înceapă următorul.

O conversație nouă începe la o funcționalitate coerentă, de exemplu „Angajați și titulari”. Formularul, validările și micile corecții ale acelei funcționalități se lucrează în aceeași conversație. Dacă trebuie să o întrerupi, se salvează progresul și se continuă același modul într-o conversație nouă, folosind `STATUS.md`.

La final, Codex verifică rezultatul, actualizează starea și deciziile, salvează în Git și indică modulul următor. Utilizatorul poate verifica rezultatul vizual și apoi deschide următoarea conversație în același proiect. Un commit este un punct de salvare al codului și documentelor; trimiterea în GitHub și publicarea aplicației sunt operații separate.

`AGENTS.md` îi cere lui Codex să citească documentele relevante. Prezența altor fișiere `.md` nu înseamnă că întregul lor conținut este încărcat automat; mesajele din `PROMPTS.md` cer explicit citirea stării și a modulului curent.

## Ce poate fi decis pe parcurs

Numele aplicației și domeniul nu blochează M00–M01. Găzduirea țintă pentru demonstrație este Netlify Free, cu Supabase Free pentru date, autentificare și fișiere. Înainte de conectarea serviciilor se configurează accesul necesar. Pentru demo folosim date fictive și regulile propuse în plan. Înaintea unei eventuale utilizări reale se confirmă procedurile instituției și cerințele de operare.

Git păstrează codul și structura bazei de date. Datele operaționale, fotografiile și semnăturile au copii de siguranță separate.
