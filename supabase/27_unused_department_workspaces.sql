-- No destructive schema changes are required when accounting/logistics/installer
-- workspaces are disabled. Historical data is intentionally preserved.
--
-- Active CRM state continues to live in leads/contracts/contract_tasks. The
-- application routes for the currently unused departments redirect to the
-- contract process until those workspaces are deliberately re-enabled.
select 1;
