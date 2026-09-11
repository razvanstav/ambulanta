# Decizii și presupuneri

## D69 — Confirmat, 11 septembrie 2026

Beneficiarul cere gestiune numai pe produs și cantitate: ieșire din magazie, intrare în mașină, consum și rest păstrat în mașină. Pragurile, loturile și expirarea sunt eliminate din fluxul curent, inclusiv ca restricții la distribuție. Înlocuiește D48–D49 și părțile M04–M07 referitoare la urmărirea comercială; metadatele vechi și mișcările rămân în istoric. Unitățile, precizia, accesul și stocul atomic se păstrează. Contractul curent: [QUANTITY-INVENTORY](QUANTITY-INVENTORY.md).

Acest fișier păstrează deciziile care trebuie cunoscute de conversațiile următoare. „Confirmat” înseamnă cerință exprimată de beneficiar; „Propus” înseamnă alegere inițială a planului, care poate fi revizuită.

## Actualizare stoc pe mașină — 10 septembrie 2026

- **D61 — Confirmat:** mașina are stoc permanent vizibil; 10 primite și 7 consumate lasă 3 în mașină pentru următoarea tură. Înlocuiește locația exclusiv pe tură din D09/M06 și formula de închidere din plan. Returul real continuă să încarce magazia, dar nu este implicit.
- **D62 — Confirmat:** eliminarea semnăturii din ciornă nu mai este oferită. Implementarea interzice eliminarea semnăturii validate inclusiv prin RPC; schimbarea cantităților păstrează originalul și cere o nouă versiune.
- **D63 — Confirmat:** titularul nu poate închide fișa înainte de finalul stabilit al turei. **Alegere de implementare:** începutul și finalul sunt obligatorii la cerere, fără posibilitatea scurtării ulterior. Turele vechi fără program îl stabilesc o singură dată.
- **D64 — Adoptat pentru D61/D63:** fără retur fizic, titularul închide direct după final; cu retur, magazia confirmă primirea și închide, fiind distinctă de titular. Modifică D11 numai pentru închiderile fără retur. Consumul, returul, versiunea finală și eliberarea mașinii sunt atomice.
- **D65 — Aplicat:** migrarea precedă publicarea aplicației. Migrarea 007 a fost aplicată tranzacțional prin SQL Editor și înregistrată în istoricul Supabase; soldurile existente au fost reconciliate cu jurnalul. Configurația privată locală rămâne pe alt calculator.
- **D66 — Confirmat și executat:** beneficiarul a autorizat trimiterea pe GitHub și activarea în Supabase/Netlify, apoi s-a autentificat în dashboarduri. Implementarea `d073780` a fost publicată prin deployul manual al commitului `50eae63`, `6aa31299110cc36e9cb9fbd9`, după migrare. Variabilele secrete existente nu au fost modificate.

- **D67 — Confirmat:** finalul turei este redus la consum și restul rămas în mașină. Titularul completează numai „Cât s-a consumat”, vede restul calculat și folosește un singur buton care salvează declarația, postează consumul și închide tura. Dovezile și returul fizic nu mai fac parte din fluxul curent; un retur deja trimis înaintea schimbării poate fi finalizat de magazie.
- **D68 — Confirmat:** interfața folosește o paletă deschisă, calmă, cu fundal gri foarte deschis, panouri albe, text închis și accente albastre/verzi cu contrast clar.

Contractul curent și verificările: [VEHICLE-STOCK](VEHICLE-STOCK.md). Deciziile istorice de mai jos se citesc cu aceste înlocuiri.

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
| D37 | Confirmat | Imaginea furnizată este exclusiv inspirație pentru culori, fonturi și aspect | Clarificarea beneficiarului la începutul M01: funcționalitățile nu se deduc din imagine; rămân cele din ROADMAP și WORKFLOWS |
| D38 | Adoptat în M01 | Componente React comune, controale HTML native și fonturi de sistem, fără dependențe noi | Select, radio și dialog acoperă nevoile curente; shadcn/ui rămâne opțional când un control mai complex îl justifică. Bahnschrift/Segoe UI au fonturi de rezervă și nu cer rețea la build |
| D39 | Adoptat în M01 | Exemplele vizuale sunt izolate în `src/modules/demo`, fără backend sau persistență | Selectorul de substație și perspectiva schimbă doar prezentarea; datele autentificate vor înlocui exemplele în modulele următoare. Indicatorii numără repere/ture/cereri, fără sume între unități incompatibile |
| D40 | Confirmat | Se folosește proiectul Supabase Free existent „ambulanta”, `roxvzbhsszesglcaadcl` | Beneficiarul a ales proiectul și a autorizat explicit cheia secretă numai în configurația locală ignorată de Git; nu se creează alt proiect sau abonament |
| D41 | Adoptat în M02 | Conturi create administrativ, fără înscriere publică; primul administrator are parolă aleatorie locală | Crearea Auth folosește client privilegiat numai pe server. Datele aplicației, inclusiv administrarea, folosesc sesiunea și RLS. Conturile noi nu au rol implicit; fără SMTP sau invitații trimise |
| D42 | Adoptat în M02 | Rolurile globale/locale sunt în `role_assignments`, cu domeniu impus prin constrângeri și chei externe compuse | Înlocuiește cele două tabele propuse `user_global_roles`/`user_station_roles`, păstrând distincția funcțională. Rolurile nu provin din metadate JWT editabile |
| D43 | Adoptat în M02 | Mutații administrative prin RPC atomice, motiv și audit; blocare pe instituție și reverificare după blocare | Propriul acces se modifică numai de alt administrator. Revocările reciproce concurente nu pot elimina ambii administratori; scrierile directe sunt interzise și administratorilor aplicației |
| D44 | Adoptat în M02 | M01 rămâne la `/demo`; zona autentificată are rute `/substatia/[id]` și identitate reală | Eșecul autentificării sau lipsa modulelor operaționale nu produce date demonstrative ca fallback. Contractul de proprietar există, entitățile reale de tură urmează în M06 |
| D45 | Confirmat în M03 | Populare cu 10 angajați fictivi în total, dintre care 3 titulari, și 5 mașini | Cerința nouă a beneficiarului înlocuiește cantitățile inițiale din D23. Roșiori este substația demonstrativă aleasă pentru populare; cei 3 titulari au conturi individuale și rol local, cu parole numai în fișier privat |
| D46 | Adoptat în M03 | Starea activă și bifa titular sunt pe apartenența la substație; asocierea contului este rezervată administratorului | Șeful local/adminul gestionează personalul și flota. Logistica/gestionarul consultă. Identitatea comună mai multor substații se modifică numai administrativ; M03 nu introduce transferuri |
| D47 | Adoptat în M03 | Eligibilitatea cere titular activ, cont asociat activ și rol local Șef de tură | Rezolvarea persoanei folosește contul autentificat pe server/DB. Eliminarea eligibilității privește predările noi, fără revocarea implicită a istoricului propriu. M06 reverifică eligibilitatea și disponibilitatea atomic |

Clarificări consemnate la 10 septembrie 2026: discuția despre PHP/MySQL a fost exploratorie; nu a schimbat arhitectura propusă. D21–D24 delimitează scopul imediat al prezentării și amână cerințele exclusiv operaționale.

Implementare M00, 10 septembrie 2026: D07–D08 sunt adoptate tehnic pentru fundație (Next.js App Router și structură modulară); serviciile Supabase se configurează în M02. Tailwind CSS este instalat, componentele comune și shadcn/ui se introduc în M01. Alegerea tehnică nu transformă presupunerile de gestiune în cerințe confirmate. D26 înlocuiește instrucțiunea inițială din promptul M00 de a păstra commiturile numai local. Repository-ul indicat este public; în el intră codul, planul și referința vizuală furnizată, fără date operaționale sau secrete.

## Decizii M04–M06 și publicare anticipată — 10 septembrie 2026

- **D48 — Adoptat M04:** catalogul comun se administrează de administrator și
  logistica centrală. Pragurile, activarea locală și loturile se gestionează de
  rolurile logistice în substația autorizată. Șeful de tură vede doar propriile
  fișe și alocări.
- **D49 — Adoptat M04:** unitatea, precizia și urmărirea sunt fixe după primul
  lot, iar identitatea lotului este fixă de la creare. Regula protejează și toate
  mișcările viitoare. Expirarea se consideră la sfârșitul zilei locale înscrise.
- **D50 — Confirmat:** beneficiarul a cerut continuarea în această conversație
  și cu M05 și M06, urmată de salvarea progresului în Git.
- **D51 — Confirmat:** beneficiarul a cerut un link public pentru incrementul
  disponibil, înainte de M07–M09. Este o publicare demo anticipată; P01 integral
  și circuitul cu dovezi/închidere/rapoarte rămân după M09.
- **D52 — Adoptat M05–M06:** administratorul, logistica și gestionarul execută
  operațiile de magazie. Șeful local consultă; dreptul operațional se acordă prin
  rol gestionar explicit. Blocarea pe instituție serializează comenzile de stoc,
  metadatele, eligibilitatea și revocările pentru volumul demo.
- **D53 — Adoptat M06:** autorul fișei este distinct de titular. Fișele se
  salvează în versiuni noi; ciornele nu sunt vizibile titularului. Rezervarea
  propusă în D35 este implementată, fără rezervarea stocului la trimiterea fișei.
- **D54 — Aplicarea D40 la publicare:** cheia secretă Supabase rămâne exclusiv
  locală. Găzduirea folosește URL-ul și cheia publicabilă; conturile existente
  funcționează, iar crearea conturilor noi se face din mediul local.

## Decizii M07 — 10 septembrie 2026

- **D55 — Adoptat M07:** numai titularul completează declarația proprie; magazia
  poate colecta documente și semnătură pe versiunea salvată. Identitățile
  semnatarului declarat și colectorului autentificat sunt distincte.
- **D56 — Adoptat M07:** ciorne JSONB nemodificabile, cu snapshot pe alocare și
  SHA-256 calculat în DB. Orice versiune nouă cere dovezi noi. Suplimentarea
  acceptată face neactuală ciorna care nu include noile alocări.
- **D57 — Adoptat M07:** limitele propuse sunt 10 MB/fișier, 5 documente și o
  semnătură per versiune; PDF/JPEG/PNG. Politica implicită `at_least_one` se
  configurează de administrator/șeful substației. Eliminarea este logică.
- **D58 — Adoptat M07, completare D54:** atestarea validării fișierelor este
  rezervată serverului, cu cheia secretă locală existentă. Citirile aplică RLS;
  browserul nu are scrieri directe în Storage. D54 rămâne regula transferului
  cheilor: nu trimitem automat cheia către Netlify. Publicarea M07/P01 necesită
  configurarea unui serviciu de validare de încredere pe găzduire și verificarea
  limitei HTTP pentru fișierele de 10 MB. Nu s-a făcut publicare în M07.

## Publicare M07 — 10 septembrie 2026

- **D59 — Confirmat, înlocuiește restricția de găzduire D54/D58:** beneficiarul
  a cerut publicarea și a aprobat explicit configurarea cheii secrete Supabase
  în proiectul Netlify `ambulanta` pentru dovezi. Variabila
  `SUPABASE_EVIDENCE_SECRET_KEY` este secretă, numai în Production, fără prefix
  public. Numele separat păstrează crearea conturilor Auth doar local.
  Planul Free nu permite selectarea individuală a scopurilor: secretul este
  disponibil pentru Builds, Functions și Runtime, fără Post processing.
- **D60 — Adoptat pentru demonstrația Netlify:** limita HTTP efectivă pentru
  încărcări binare este aproximativ 4,5 MB. Demo acceptă maximum 4 MB/fișier,
  verificat în browser și server, cu mesaj explicit. Local rămân 10 MB, iar
  bucketul păstrează plafonul 10 MB. Transportul pentru documente mai mari este
  backlog P01; nu se ocolește validarea și nu se acordă scrieri directe Storage.

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
