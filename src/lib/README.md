# Infrastructură comună

M02 include configurarea Supabase, clientul SSR cu cookie-uri și clientul Auth
privilegiat, marcat `server-only`. Sesiunea și autorizarea sunt în `modules/identity`.
Paginile și acțiunile folosesc sesiunea utilizatorului; cheia secretă este rezervată
creării/compensării conturilor Auth și scripturilor administrative.

Codul privilegiat trebuie izolat pe server; nicio cheie secretă nu folosește
prefixul `NEXT_PUBLIC_`. Fusul de afișare este `Europe/Bucharest`, momentele
persistate vor fi UTC. Configurarea nu conține reguli speciale pentru Roșiori.
