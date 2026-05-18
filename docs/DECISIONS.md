# Technical Decisions

## Decision: Use Supabase for auth and database

Context: B-CRM needs authentication, role-aware data access and PostgreSQL-backed lead data.

Decision: Use Supabase Auth and Supabase PostgreSQL, with SQL files committed under `supabase/`.

Consequences: The project can move quickly and remain inspectable, but production use requires careful RLS review and secret handling.

## Decision: Centralize role and permission logic

Context: Admin, manager, sales and operational roles need different views and actions.

Decision: Keep role normalization in `lib/roles.ts` and permission checks in `lib/permissions.ts`.

Consequences: Tests can cover access rules without rendering full pages. Route components still need gradual cleanup.

## Decision: Treat the app as a production-like portfolio demo

Context: The app demonstrates real CRM patterns but is not positioned as a fully production-managed system.

Decision: Document the project honestly as a production-like CRM demo.

Consequences: The portfolio stays credible while making room for roadmap items like e2e tests, monitoring and security review.
