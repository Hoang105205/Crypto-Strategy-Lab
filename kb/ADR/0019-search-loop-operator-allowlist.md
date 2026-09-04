# ADR-0019: Deny-by-Default Search Loop Operator Allowlist

## Status
Accepted

## Context
The Search Loop and its desired state are singleton global resources. The optional-auth controller previously allowed anonymous lifecycle mutations, while desired-state mutations required only a logged-in user. Either behavior lets a caller change automation for every user and can interrupt the 24/7 workload.

## Decision Drivers
- Anonymous and ordinary authenticated users must not mutate global loop state.
- The safe default must deny mutations when deployment configuration is missing.
- Existing Supabase JWT verification should remain the identity source.
- Read-only global status must remain available to the dashboard.
- The course project does not yet have an application-managed admin/RBAC model.

## Considered Options
1. Keep optional authentication for lifecycle endpoints and `RequireAuth` for control endpoints.
2. Let any authenticated user mutate every global loop endpoint.
3. Require authenticated identity plus membership in a deployment-configured operator UUID allowlist.
4. Add a database-backed admin role model and management UI.

## Decision Outcome
Chosen option: "Authenticated operator UUID allowlist", because it closes the global mutation boundary now without introducing a new role-management subsystem outside the approved project scope.

`SupabaseJwtGuard` continues to verify an optional bearer token and populate `request.user`. `SearchLoopOperatorGuard` is then applied to `start`, `pause`, `resume`, `stop`, `control/enable`, `control/disable`, and `control/config`. It returns 401 when identity is absent and 403 when the authenticated UUID is not present in `SEARCH_LOOP_OPERATOR_USER_IDS`.

`SEARCH_LOOP_OPERATOR_USER_IDS` is a comma-separated list of valid UUIDs. Environment validation trims and de-duplicates entries. Missing or empty configuration means no caller can mutate the loop. Status/detail/control reads remain optional-auth because they expose global operational state and do not change it.

### Consequences
- Positive: anonymous and ordinary user accounts cannot interrupt or reconfigure the global 24/7 process.
- Positive: configuration mistakes fail closed instead of exposing global mutation access.
- Positive: no schema migration or admin UI is required.
- Negative: operator membership changes require environment configuration and backend restart.
- Risk: this allowlist is intentionally simpler than RBAC; if the project later needs delegated administration or audit-managed roles, replace it with database-backed authorization while retaining the same mutation boundary.

## Links
- [Relates to ADR-0015](./0015-supabase-auth.md)
- [Relates to ADR-0017](./0017-persistent-supervisor-for-24-7-search-loop.md)
- [Strategy Search Loop flow](../flows/strategy-search-loop.md)
- [Event Infrastructure module](../modules/event-infrastructure.md)
