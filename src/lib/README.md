# Infrastructură comună

Loc pentru configurări și clienții serviciilor introduși când sunt necesari.
Clienții Supabase pentru browser și server, validarea configurației și sesiunea
autentificată se implementează în M02. Pagina M00 nu necesită variabile de mediu.

Codul privilegiat trebuie izolat pe server; nicio cheie secretă nu folosește
prefixul `NEXT_PUBLIC_`. Fusul de afișare este `Europe/Bucharest`, momentele
persistate vor fi UTC. Configurarea nu conține reguli speciale pentru Roșiori.
