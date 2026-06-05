# B-CRM DEMO

B-CRM DEMO is a production-like CRM demo for sales teams that need to manage leads, statuses, callbacks, meetings, comments, offers and role-based workflows in one web app.

PL: B-CRM DEMO to aplikacja CRM do obsługi leadów i procesu sprzedażowego, z rolami użytkowników, dashboardami, historią działań i bazą demo.

## Live demo

https://b-crm-demo-berni.vercel.app/login

Demo accounts are available on the login screen.

## Screenshots

Screenshots should be added to `docs/screenshots/`. The README does not link placeholder images until real screenshots are committed.

## Features

- Supabase Auth login and protected application screens.
- Roles and permissions for owner, admin, manager, sales, finance, viewer, accounting, logistics and installer workflows.
- Lead management with ownership, statuses, comments, activity history, files and reminders.
- Callback, meeting and calendar flows.
- Admin dashboard, sales dashboard, management metrics and user management.
- CSV import, filtered export and example lead CSV.
- Offer/PDF-related calculators and print-ready offer view.
- Supabase SQL files for tables, RLS, policies, demo users and sample data.

## Tech stack

- Next.js App Router
- React
- TypeScript
- Supabase Auth
- PostgreSQL / Supabase Database
- Tailwind CSS
- Vercel
- Vitest

## Project structure

- `app/` — routes, dashboards, auth screens and API route handlers.
- `components/` — reusable UI and CRM-specific components.
- `lib/` — roles, permissions, constants, Supabase client, pricing and helper logic.
- `supabase/` — schema, RLS, policies, functions and seed/demo SQL files.
- `examples/` — CSV import example.
- `docs/` — case study, architecture notes, roadmap, testing and issue backlog.

## Getting started

```bash
git clone https://github.com/ft4k696bk6-prog/B-CRM.git
cd B-CRM
npm install
npm run dev
```

Local URL:

```text
http://localhost:3000
```

Quality checks:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Environment variables

Create `.env.local` from `.env.example`.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_APP_URL=

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_CALLER_ID=

OPENAI_API_KEY=
OPENAI_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_SUMMARY_MODEL=gpt-4.1-mini
```

`SUPABASE_SERVICE_ROLE_KEY` must stay server-side only. If a real service role key is ever committed, rotate it in Supabase immediately.
Twilio variables enable real click-to-call. Without them, demo accounts use a safe simulated call flow. `OPENAI_API_KEY` enables transcription and AI summaries for recorded calls.

## Database

SQL files are stored in `supabase/`. Apply them in order when creating a fresh Supabase project. The most important files are:

- `supabase/01_tables.sql` — main tables.
- `supabase/02*_*.sql` — security, history and RLS policies.
- `supabase/05_roles_users_demo.sql` — demo roles and users.
- `supabase/06_manager_hierarchy.sql` — manager/team hierarchy.
- `supabase/07_roles_permissions_security.sql` — role and permission hardening.
- `supabase/sample-data.sql` and `supabase/seed_demo_users.sql` — optional demo data.

## Documentation

- `docs/CASE_STUDY.md`
- `docs/OVERVIEW.md`
- `docs/ARCHITECTURE.md`
- `docs/ROADMAP.md`
- `docs/TESTING.md`
- `docs/DECISIONS.md`
- `docs/CHANGELOG.md`
- `docs/ISSUES_TO_CREATE.md`

## What I learned

- Designing role-based CRM screens and permission helpers.
- Working with Supabase Auth, PostgreSQL data and RLS-oriented SQL.
- Building lead status workflows, callbacks, meetings and activity history.
- Organizing a larger Next.js application with shared CRM helpers.
- Preparing production-like documentation, CI and tests for a portfolio project.

## Roadmap

- Expand Vitest coverage around lead workflows and validation.
- Add Playwright smoke tests for login and dashboard navigation.
- Split the largest route components into smaller domain modules.
- Improve Supabase error states and logging.
- Add analytics for key demo flows.
- Improve mobile UX for dense CRM tables.

## Status

Production-like CRM demo.

## License

MIT.
