# B-CRM Architecture

## Stack

- Next.js App Router, React and TypeScript.
- Tailwind CSS for responsive UI.
- Supabase Auth and PostgreSQL database.
- Supabase SQL files for schema, RLS, policies, history and seed data.
- Vercel deployment.

## Application structure

- `app/` contains route-level screens and API route handlers.
- `components/` contains reusable CRM UI.
- `lib/` contains role helpers, permissions, constants, pricing logic and Supabase setup.
- `supabase/` contains database schema, functions, policies and demo data.

## Data flow

The UI reads and writes CRM data through the Supabase client and selected Next.js route handlers. The route handlers are used where server-side validation or admin operations are needed.

## Auth and roles

Supabase Auth handles identity. Application roles are normalized in `lib/roles.ts` and permissions are centralized in `lib/permissions.ts`. SQL files in `supabase/` document the database side of security and RLS.

## Deploy

The app is deployed on Vercel. Supabase project URL, anon key and server-only service role key are configured through environment variables.

## Known risks

- Several route components are large and should be split gradually.
- End-to-end coverage is still missing.
- Error logging and analytics are basic.
- Dense CRM tables need additional mobile UX work.
