# Changelog

## 0.2.0 — 2026-09-07

- Added owner/admin Control panel with mandatory-queue override, margins, commissions and weighted voivodeship lead routing.
- Reworked mobile lead cards into expandable inline workspaces with quick statuses, comments and note dictation support.
- Added full `Materiały PH Re-Energy System` Google Drive browser to the knowledge vault.
- Added automatic Google Drive copy for contract PDFs, photos and videos into per-client folders while retaining Supabase Storage as the CRM source of truth.
- Removed the production runtime contract fallback based on customer names.
- Normalized new lead phone numbers to E.164 and kept existing production backfill safeguards.
- Temporarily disabled unused accounting, logistics and installer workspaces without deleting their data.

## 0.1.0

- Added production-like CRM demo with role-aware screens.
- Added lead management, statuses, comments, callbacks, meetings and history.
- Added Supabase SQL files for schema, policies, demo users and sample data.
- Added CSV import/export and offer/PDF-related flows.
- Added documentation, CI plan and initial unit tests.
