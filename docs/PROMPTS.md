# Mesaje de pornire pentru Codex

Folosește mesajele de mai jos în proiectul care conține acest pachet. O conversație nouă trebuie să aibă acces la repository și la versiunea care include modulul anterior.

## Prima conversație — M00

```text
Începem aplicația de gestiune a substațiilor pe baza documentelor din acest proiect.

Scopul este un MVP funcțional pentru prezentare, cu date fictive și găzduire Netlify Free + Supabase Free în limitele gratuite. Domeniul propriu este opțional. Păstrează această decizie în documentația proiectului.

Citește AGENTS.md, docs/STATUS.md, docs/DECISIONS.md, docs/ARCHITECTURE.md și M00 din docs/ROADMAP.md. Inspectează folderul și starea Git înainte de modificări.

Implementează numai M00 — Fundația proiectului. Folosește arhitectura propusă: Next.js, TypeScript și structură modulară pregătită pentru PostgreSQL, Auth și Storage prin Supabase. Fixează versiunile și managerul de pachete. Creează proiectul minim care pornește, configurările de dezvoltare, verificările de bază, .env.example fără secrete și instrucțiunile de pornire. Păstrează documentele și imaginea de referință în repository.

Suntem în folderul dedicat aplicației. Dacă încă nu există Git și folderul nu aparține altui repository, inițializează-l aici. Dacă aparține altui repository, identifică situația și evită să incluzi fișiere străine. Salvează documentația inițială și fundația în commituri locale coerente, fără să publici pe GitHub sau să configurezi găzduire.

Nu implementa încă autentificarea reală, gestiunea sau paginile complete ale modulelor viitoare. Rulează verificările M00, actualizează docs/STATUS.md și raportează ce funcționează, verificările efective, branchul, commitul final și următorul modul: M01.
```

## Fiecare conversație următoare

Înlocuiește `[MODUL]` cu identificatorul dorit, de exemplu `M03 — Personal, titulari și mașini`.

```text
Continuăm aplicația de gestiune a substațiilor în același proiect. Modulul acestei conversații este [MODUL].

Citește AGENTS.md, docs/STATUS.md, docs/DECISIONS.md și secțiunile relevante din arhitectură și roadmap. Verifică starea Git, codul existent și faptul că versiunea curentă include modulele de care depinde lucrarea.

Implementează modulul cap-coadă, conform criteriilor sale de acceptare. Modifică modulul și numai integrarea necesară în componentele comune; explică pe scurt acele atingeri. Refolosește ce există. Nu rescrie alte module și nu adăuga funcționalități din etapele viitoare.

Folosește deciziile deja documentate pentru alegerile obișnuite. Dacă lipsește ceva esențial, avansează cu partea independentă și spune precis ce informație sau acces este necesar.

Rulează verificările relevante, actualizează docs/STATUS.md și orice decizie schimbată, apoi salvează modificările proprii în Git. Respectă fluxul de branch/integrări deja stabilit în proiect. Nu include munca preexistentă a altcuiva în commitul tău.

La final spune: ce pot folosi acum, ce ai verificat, eventualele limitări, branchul și commitul rezultat, apoi modulul recomandat pentru conversația următoare. Nu începe automat acel modul.
```

## Dacă un modul necesită o conversație suplimentară

```text
Reluăm modulul aflat în lucru din docs/STATUS.md. Citește AGENTS.md, starea, deciziile și codul de pe branchul consemnat. Verifică diferențele locale și commiturile înainte de a continua.

Continuă numai partea rămasă din modul, păstrează implementarea deja verificată și urmărește criteriile sale de acceptare. Actualizează starea reală și salvează progresul în Git. Nu reîncepe proiectul și nu considera modulul complet până când funcționalitatea și verificările necesare sunt gata.
```
