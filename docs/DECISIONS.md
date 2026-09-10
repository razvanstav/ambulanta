# Decizii și presupuneri

Acest fișier păstrează deciziile care trebuie cunoscute de conversațiile următoare. „Confirmat” înseamnă cerință exprimată de beneficiar; „Propus” înseamnă alegere inițială a planului, care poate fi revizuită.

| ID | Stare | Decizie | Motiv / efect |
| --- | --- | --- | --- |
| D01 | Confirmat | Mai multe substații, cu stocuri proprii | Roșiori este prima, altele se adaugă din aplicație |
| D02 | Confirmat | Numai titularii bifați pot primi produse | Angajații simpli sunt excluși din selecție |
| D03 | Confirmat | Predare scade; retur încarcă; „minus” = consum | Evită dubla scădere la finalul turei |
| D04 | Confirmat | Dovezi document/foto sau semnătură cu degetul | Asociate închiderii turei |
| D05 | Confirmat | Rapoarte pe ture/zile/săptămâni | Cu dashboard minimalist inspirat din imagine |
| D06 | Confirmat | Lucru modular, Git, conversații separate | Fiecare increment are un punct clar de predare |
| D07 | Propus | Monolit modular, un repository | Integrare și tranzacții coerente cu administrare simplă |
| D08 | Propus | Next.js/TypeScript, Supabase PostgreSQL/Auth/Storage | Un singur proiect de aplicație și servicii pentru date, conturi, fișiere |
| D09 | Propus | Un depozit disponibil per substație în MVP | Modelul permite locații suplimentare ulterior |
| D10 | Propus | Angajatul poate exista fără cont | Gestionarul poate înregistra și colecta semnătura pe dispozitivul lui |
| D11 | Propus | Gestionarul confirmă returul fizic și închide | Declarația titularului nu mărește singură stocul |
| D12 | Propus | Politică dovezi configurabilă, inițial cel puțin una | Document/foto SAU semnătură; ambele permise |
| D13 | Propus | Lot/expirare pentru medicamente | Predare și retur urmărite pe lot; fără recomandări clinice |
| D14 | Propus | Fără conversii de ambalaj în MVP | Cantități în unitatea de bază, cu precizie explicită |
| D15 | Propus | Online în MVP | Confirmarea serverului decide dacă stocul s-a modificat |
| D16 | Propus | Data operațională = data locală de început a turei | Consum agregat după ture; mișcări de depozit după momentul înregistrării |
| D17 | Propus | O singură tură activă per titular și mașină | Evită predări ambigue; regulă verificată în baza de date |
| D18 | Propus | PDF și CSV la prima livrare de rapoarte | CSV se poate deschide în Excel; XLSX separat dacă se cere |
| D19 | Propus | Corecții prin operații compensatorii | Istoricul și raportul original rămân consultabile |
| D20 | Propus | Datele istorice și fișierele au backup separat de Git | Codul salvat nu este o copie a stocului operațional |
| D21 | Confirmat | Aplicația este deocamdată un MVP pentru prezentare | Nu este solicitată încă utilizarea operațională în instituție |
| D22 | Confirmat | Infrastructură gratuită pentru demonstrație | Ținta convenită este Netlify Free + Supabase Free, în limitele planurilor; domeniu propriu opțional |
| D23 | Propus | Date fictive și scenariu complet de demonstrație | Roșiori ca exemplu, angajați și produse fictive, două mașini; semnături de test |
| D24 | Propus | M00–M09, apoi P01 pentru demo; M10–M11 ulterior | Prezentarea include fluxul cerut; pregătirea operațională se face dacă este solicitată |
| D25 | Confirmat | Următoarea conversație folosește același proiect | Fișierele Markdown și codul rămân împreună; progresul este consemnat în Git |

Clarificări consemnate la 10 septembrie 2026: discuția despre PHP/MySQL a fost exploratorie; nu a schimbat arhitectura propusă. D21–D24 delimitează scopul imediat al prezentării și amână cerințele exclusiv operaționale.

## Cum se modifică o decizie

Notează data, decizia înlocuită, noua regulă și modulele afectate. Pentru schimbări care ating stocul, drepturile, dovezile sau raportarea, actualizează și criteriile de acceptare. Nu transforma o presupunere în cerință confirmată fără o instrucțiune a beneficiarului.

## De confirmat înainte de pilot

- Cine operează închiderea în practică și cine primește cont individual.
- Dacă dovada este obligatorie la fiecare tură sau numai în anumite situații.
- Produsele concrete, unitățile de distribuire și informațiile de lot disponibile la recepție.
- Intervalele turelor și acceptarea regulii de dată operațională.
- Modelul PDF folosit de instituție, dacă există unul.
- Găzduirea, politica de păstrare a documentelor și responsabilul copiilor de siguranță.

Aceste întrebări nu impun oprirea M00–M01; valorile propuse permit pregătirea structurii și interfeței.
