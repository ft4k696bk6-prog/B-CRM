# Hosting B-CRM

Aktualny układ pozostaje rekomendowany:

- Next.js: Vercel,
- baza/Auth: Supabase,
- pliki aplikacyjne: Supabase Storage / object storage,
- firmowa poczta i domena mogą pozostać u cyber_Folks.

Przeniesienie aplikacji na zwykły hosting współdzielony tylko po to, aby wszystko było u jednego dostawcy, nie jest celem architektonicznym. Migracja wymagałaby mierzalnej korzyści kosztowej lub operacyjnej oraz pełnej zgodności z aktualnym Node/Next.js SSR, deploymentami i monitoringiem.
