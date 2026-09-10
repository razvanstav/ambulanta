# Interfața comună — M01

Referința vizuală furnizată este inspirație, nu specificație funcțională. Paleta
folosește bleumarin, suprafețe albastre închise, alb pentru text, albastru pentru
informații și roșu pentru acțiunea principală. Stările au text explicit, nu doar
culoare. Titlurile folosesc Bahnschrift/Arial Narrow/Segoe UI, iar corpul Segoe
UI/Arial. Fonturile sunt locale; aspectul lor poate diferi între sisteme.

## Organizare

- `src/components/shell`: layout comun, navigație, selectorul vizual de substație,
  meniul mobil și schimbarea perspectivei. Perspectiva este derivată din rută.
- `src/components/ui`: butoane, badge-uri, panouri, titluri, pictograme SVG și
  stările comune. Controalele de formular sunt elemente HTML native, etichetate.
- `src/modules/demo`: date fictive, context vizual, dashboard, stoc, formularul
  „Tura mea” și ecranele explicative. Nu este un model de date pentru backend.
- `src/app`: rute subțiri și fallback-uri de încărcare, eroare și pagină negăsită.
- `src/app/globals.css`: variabilele paletei, componente și praguri responsive.

## Pagini

| Rută                                                           | Conținut M01                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `/`                                                            | Dashboard Logistică / Magazie, cereri și alerte demonstrative                                     |
| `/stocuri`                                                     | Tabel, căutare fără diacritice, categorie și stare; parametru `stare=sub-prag` sau `stare=expira` |
| `/distribuire`                                                 | Exemple de cereri/fișe/ture, fără pregătire sau trimitere                                         |
| `/receptii`, `/inchidere`, `/rapoarte`, `/personal`, `/masini` | Pagini de prezentare cu acțiuni viitoare dezactivate                                              |
| `/setari`                                                      | Prezentarea accesului viitor și previzualizarea stărilor standard                                 |
| `/tura-mea`                                                    | Selecția mașinii, lipsa mașinilor, așteptarea fișei și fișa de acceptat                           |
| `/tura-mea/istoric`                                            | Starea fără ture proprii salvate                                                                  |

Roșiori conține exemple; Alexandria ilustrează lipsa datelor. Contextul se păstrează
doar în memoria paginii, în navigarea client. Reîncărcarea revine la Roșiori.
Schimbarea substației remontează conținutul pentru a elimina selecțiile anterioare.
Snapshotul demonstrativ este `2026-09-10T07:30:00Z`, afișat în Europe/Bucharest.
Numărul produselor înseamnă repere distincte, nu suma cantităților.

## Integrare ulterioară

M02 trebuie să înlocuiască selectorul/profilul demonstrativ cu identitate și
substații autorizate pe server. Schimbarea meniului nu este control de acces.
Datele din `demo/data.ts` nu trebuie utilizate ca fallback la eșecul autentificării.
Legătura cont–angajat aparține M03; M06 implementează cererea și acceptarea atomică
prin motorul de stoc. Fișa vizuală rămâne fără câmpuri editabile pentru titular.

Formularul curent previzualizează doar selecția, fără cereri HTTP de scriere,
rezervări sau schimbări de sold. Selectorul „Previzualizează o stare” este un
instrument demonstrativ și trebuie eliminat când se integrează starea reală.

## Verificări

`npm run check` și `npm run test:e2e` sunt comenzile proiectului. Cele opt scenarii
E2E rulează pe desktop și Pixel 7 (16 teste). Ele verifică interfața și lipsa
salvărilor simulate, nu drepturi sau tranzacții. Tabelele late se derulează în
containerul propriu, accesibil din tastatură. Meniul mobil folosește un dialog
modal nativ, cu focus, Escape și buton de închidere. Mișcarea este redusă când
utilizatorul preferă acest lucru.
