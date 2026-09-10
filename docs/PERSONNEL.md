# Personal, titulari și flotă — M03

Modulul folosește Supabase real. Migrarea `202609100002_people_vehicles.sql`
este aplicată și înregistrată cu versiunea `202609100002`, numele `people_vehicles`.
Pe un proiect nou se aplică după migrarea M02. Nu rerula și nu modifica o
migrare deja aplicată.

## Datele demonstrației

În instituția „SAJ — Demonstrație”, substația **Roșiori**, sunt 10 angajați
fictivi, dintre care 3 titulari eligibili, și 5 mașini active/apte de utilizare.
Indicativele `DEMO-AMB-01`–`DEMO-AMB-05` sunt fictive. Alexandria rămâne fără
personal sau flotă adăugate de această populare.

`npm run seed:m03` folosește administratorul din `private/initial-admin.json`,
verifică proiectul și instituția demo și completează numai codurile lipsă.
Rularea repetată nu suprascrie modificările utilizatorului și nu adaugă duplicate.
Nu este un script de resetare a demonstrației.

Cei trei titulari au conturi individuale cu rol `shift_leader` numai în Roșiori.
Datele lor de conectare sunt în `private/m03-demo-accounts.json`, cu parole
aleatorii, fără trimitere de e-mail. Acest fișier, administratorul inițial și
`.env.local` rămân exclusiv local, ignorate de Git. Nu copia parolele în documente
sau în repository.

## Utilizare

- **Personal**: consultare, adăugare, modificare, activ/inactiv și bifă Titular.
  Administratorul poate asocia un cont individual existent. Rolul Șef de tură
  se acordă explicit din Administrare; asocierea contului nu acordă drepturi.
- **Mașini**: indicativ unic în instituție, descriere, stare activă și aptă de
  utilizare. Dezactivarea păstrează înregistrarea și auditul.
- **Logistică / Magazie**: numărul real al angajaților, titularilor eligibili și
  mașinilor disponibile tehnic, plus lista titularilor.
- **Tura mea**: titularul se rezolvă din contul autentificat, fără alegerea altei
  persoane. Sunt afișate mașinile active/apte. Lipsa eligibilității este explicită.

Șeful substației și administratorul modifică personalul și flota; gestionarul și
logistica centrală consultă datele din domeniul lor. Șeful de tură nu accesează
ecranele complete de personal/flotă. Apartenențele altor substații sunt izolate.

## Model și reguli

| Tabel                  | Contract                                                       |
| ---------------------- | -------------------------------------------------------------- |
| `employees`            | Identitate instituțională, cod unic, nume, cont opțional unic  |
| `employee_assignments` | Apartenență unică angajat/substație, funcție, activ, titular   |
| `vehicles`             | Substație, indicativ unic în instituție, descriere, activ, apt |

Starea activă a angajatului aparține substației. Dezactivarea locală nu
dezactivează un cont sau apartenența în altă substație. Un cont poate fi asociat
unei singure identități de angajat. Cheile externe compuse împiedică asocierea
unui cont sau a unei substații din altă instituție.

`save_employee` salvează identitatea și apartenența atomic. `save_vehicle`
salvează mașina. Ambele cer motiv și scriu auditul cu autor, înainte/după și
moment UTC. Blocarea instituției și reverificarea drepturilor folosesc aceeași
ordine ca revocările M02. Browserul nu poate scrie direct în cele trei tabele,
nici cu un cont administrator. Toate au RLS și refuză accesul anonim.

Asocierea/dezasocierea contului este rezervată administratorului, inclusiv la
RPC. Pentru o identitate cu apartenențe multiple, șeful local poate modifica
apartenența sa; schimbarea numelui/codului comun cere administrator. M03 nu
introduce interfață de transfer sau creare a apartenențelor multiple.

`list_eligible_holders(substation)` cere simultan apartenență activă, bifă
Titular, cont asociat activ și rol Șef de tură în substația activă. Logistica
vede candidații locali; un șef de tură vede numai propria persoană.
`resolve_my_holder(substation)` folosește `auth.uid()`, fără parametru de
proprietar. Eliminarea eligibilității blochează predările noi, fără a elimina
contractul de acces la istoricul propriu.

M06 trebuie să reverifice eligibilitatea și disponibilitatea în tranzacția
cererii/predării. M03 oferă numai disponibilitatea tehnică; rezervarea/ocuparea
prin ture și toate modificările de stoc urmează în M05–M06.

## Verificări

Fluxul din [ACCESS](ACCESS.md) rulează atât M02, cât și M03 pe instituții de test
separate de demonstrație. Cele 8 grupuri M03 verifică RLS, eligibilitatea,
dezactivarea/revocarea, protecția asocierii contului, mașinile indisponibile,
rollback inclusiv audit și unicitatea la cereri concurente. Testele de browser
verifică formularele, acțiuni server falsificate, identitatea proprie și
disponibilitatea flotei pe desktop și Pixel 7. Curățarea elimină numai fixturele
verificate, inclusiv personalul și flota lor.
