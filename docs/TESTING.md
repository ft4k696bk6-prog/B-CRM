# Testing

## Commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Current coverage

- Role normalization and role-based helper behavior.
- Permission matrix expectations for admin, manager, sales and viewer users.
- Lead status constants coverage.

## Missing coverage

- Playwright smoke tests for login and dashboards.
- Route handler tests for Supabase-backed API endpoints.
- Form validation and lead mutation tests.
- Visual checks for dense dashboard tables and mobile layouts.
