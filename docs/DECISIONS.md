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
| D26 | Confirmat | Repository comun: `https://github.com/razvanstav/ambulanta.git`; progresul lucrat se trimite acolo | Instrucțiunea beneficiarului din 10 septembrie 2026 autorizează commiturile și push-ul; publicarea aplicației rămâne P01 |
| D27 | Adoptat în M00 | Node.js 24.19.0, npm 10.2.0, Next.js 16.3.4, React 19.3.0, TypeScript 5.9.3 | Versiuni directe exacte și lockfile; Node 21 global nu se folosește la verificări |
| D28 | Adoptat în M00 | `main` este baza comună; commituri coerente urmate de push în `origin` după verificări | Repository-ul distant a fost verificat gol înainte de inițializare; planul original este primul commit |
| D29 | Adoptat în M00 | Vitest pentru viitoarele reguli; Playwright verifică pagina pe calculator și telefon | Lipsa testelor unitare este permisă explicit cât nu există logică de domeniu; PostgreSQL real rămâne obligatoriu la modulele relevante |
| D30 | Confirmat | Două perspective: „Logistică / Magazie” și „Tura mea” | Logistica distribuie și urmărește activitatea de ansamblu; șeful de tură vede numai propriile fișe și ture |
| D31 | Confirmat | Șeful de tură inițiază „Start tură” și alege mașina dintre cele disponibile | Înlocuiește pregătirea exclusiv de către gestionar din fluxul inițial M06 |
| D32 | Confirmat | Magazia pregătește fișa de produse/accesorii; șeful de tură o acceptă fără editarea conținutului | Autorul fișei și persoana care o acceptă sunt identități distincte, cu momente și versiuni păstrate |
| D33 | Confirmat | Acceptarea fișei finalizează predarea și pornește efectiv tura, într-o tranzacție | Beneficiarul a confirmat explicit „Da, la acceptarea fișei”; pregătirea/trimiterea fișei nu modifică soldurile |
| D34 | Adoptat în plan | În fluxul principal, șeful de tură este titularul responsabil și are cont individual legat de angajat | D02 rămâne valabilă; D10 permite evidența angajaților fără cont, dar operarea „Tura mea” cere cont și titular activ |
| D35 | Propus | Cererea de pornire rezervă mașina; stocul se reverifică la acceptare, fără rezervare la trimiterea fișei | Două cereri concurente nu pot reține aceeași mașină; anularea înainte de predare eliberează mașina |
| D36 | Adoptat în plan | Un singur proiect cu două zone după drepturi; logistica centrală are acces instituțional atribuit explicit | Vederea de ansamblu acoperă toate substațiile instituției, fără drept implicit de administrare a conturilor; accesul local rămâne limitat |

Clarificări consemnate la 10 septembrie 2026: discuția despre PHP/MySQL a fost exploratorie; nu a schimbat arhitectura propusă. D21–D24 delimitează scopul imediat al prezentării și amână cerințele exclusiv operaționale.

Implementare M00, 10 septembrie 2026: D07–D08 sunt adoptate tehnic pentru fundație (Next.js App Router și structură modulară); serviciile Supabase se configurează în M02. Tailwind CSS este instalat, componentele comune și shadcn/ui se introduc în M01. Alegerea tehnică nu transformă presupunerile de gestiune în cerințe confirmate. D26 înlocuiește instrucțiunea inițială din promptul M00 de a păstra commiturile numai local. Repository-ul indicat este public; în el intră codul, planul și referința vizuală furnizată, fără date operaționale sau secrete.

## Cum se modifică o decizie

Clarificare de flux, 10 septembrie 2026: D30–D33 sunt cerințele noi ale beneficiarului, inclusiv confirmarea explicită a predării la acceptarea fișei. D34–D36 explică integrarea lor în modelul existent; D35 rămâne propunerea pentru rezervarea mașinii, nu o cerință confirmată. Detaliile sunt în `WORKFLOWS.md`. Se actualizează M01 (două perspective), M02 (contul șefului de tură, acces propriu și logistică centrală), M03 (flotă și eligibilitate), M06 (cerere, fișă și acceptare), M07–M09 (dovezi proprii, închidere și vizibilitate) și scenariul P01. Codul rămâne la fundația M00; această clarificare nu implementează modulele respective.

Notează data, decizia înlocuită, noua regulă și modulele afectate. Pentru schimbări care ating stocul, drepturile, dovezile sau raportarea, actualizează și criteriile de acceptare. Nu transforma o presupunere în cerință confirmată fără o instrucțiune a beneficiarului.

## De confirmat înainte de pilot

- Cine operează închiderea în practică și cine primește cont individual.
- Dacă dovada este obligatorie la fiecare tură sau numai în anumite situații.
- Produsele concrete, unitățile de distribuire și informațiile de lot disponibile la recepție.
- Intervalele turelor și acceptarea regulii de dată operațională.
- Modelul PDF folosit de instituție, dacă există unul.
- Găzduirea, politica de păstrare a documentelor și responsabilul copiilor de siguranță.

Aceste întrebări nu impun oprirea M00–M01; valorile propuse permit pregătirea structurii și interfeței.
