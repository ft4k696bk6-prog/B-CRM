# B-CRM Case Study

## Problem

Sales teams handling inbound leads need one place to control ownership, statuses, callbacks, meetings, comments, files and the next action on each lead.

## Goal

Build a web app that organizes the lead workflow and gives different views to admin, manager and sales users.

## Users and roles

- Admin: manages users, roles, imports, team structure, settings and global lead visibility.
- Manager: manages team leads, assignment, team metrics and operational follow-up.
- Sales representative: works on assigned leads, statuses, comments, callbacks, meetings and offers.

The code also includes finance, viewer, accounting, logistics and installer roles for narrower operational access.

## Key features

- Login and protected screens.
- Role and permission helpers.
- Dashboard views.
- Lead management and lead statuses.
- Comments, callbacks, meetings and activity history.
- CSV import/export.
- Offer/PDF-oriented calculators.
- Admin user management.

## Stack

React, TypeScript, Next.js, Supabase, PostgreSQL, Tailwind CSS and Vercel.

## Technical decisions

- Supabase is used because it combines auth, PostgreSQL, RLS and fast deployment-friendly setup.
- Role logic is centralized in `lib/roles.ts`; permissions are centralized in `lib/permissions.ts`.
- Data is stored in PostgreSQL tables defined in `supabase/`, with policies and helper functions documented as SQL.
- Views are split by route: admin/manager dashboard, sales dashboard, calendar, calculators, users, import and lead details.
- Main limitations are large route components, limited e2e testing and the need for stronger production monitoring.

## What I learned

- Designing role-based application flows.
- Working with PostgreSQL-backed data and Supabase Auth.
- Building dashboards around operational metrics.
- Managing lead statuses and next-action workflow.
- Organizing a larger Next.js app with shared helpers.
- Preparing deployment and technical documentation.

## Next improvements

- Add more unit and e2e tests.
- Add CI checks for every push and pull request.
- Split large components into domain modules.
- Improve error logging and analytics.
- Improve mobile UX for tables.
- Add stronger security review and technical docs around RLS.

## Links

- Live demo: https://b-crm-berni.vercel.app/login
- GitHub: https://github.com/ft4k696bk6-prog/B-CRM
- README: ../README.md
- Screenshots: `docs/screenshots/`
