# ADR-0018: Database-Authoritative Search Loop Bootstrap

## Status
Accepted

## Context
The 24/7 Search Loop needs to start automatically on a new production database, but an operator's later OFF decision must survive backend restart and environment configuration. Reading the environment on every startup without materializing that choice would allow `SEARCH_LOOP_DEFAULT_ENABLED=true` to reactivate a loop that was deliberately disabled.

## Decision Drivers
- A new production deployment can begin 24/7 automation without a manual API call.
- Persisted operator ON/OFF decisions survive restart and deployment.
- Multiple backend instances may bootstrap concurrently without crashing.
- Startup establishes desired state before the first supervisor tick.
- Periodic logs must report meaningful state transitions without 15-second noise.

## Considered Options
1. Treat the environment variable as authoritative on every backend startup.
2. Require an operator to create/enable the control row manually on every new database.
3. Use the environment only to seed a missing singleton row, then make PostgreSQL authoritative.

## Decision Outcome
Chosen option: "One-time environment seed with database authority", because it supports automatic first deployment while preserving explicit operational decisions.

`SearchLoopControlRepository.seedIfAbsent()` runs during `SearchLoopSupervisorService.onApplicationBootstrap()` before the first tick. If `SearchLoopControl(id="system")` is absent, it is created with `enabled=SEARCH_LOOP_DEFAULT_ENABLED`; `nextRunAt` is immediate when enabled and null when disabled. If the row exists, it is returned unchanged. A Prisma `P2002` conflict means another backend won the concurrent seed race, so the losing backend reads and adopts that row.

The precedence rule is:

```text
Missing DB row  -> use SEARCH_LOOP_DEFAULT_ENABLED once
Existing DB row -> use DB enabled value; ignore environment default
```

Production sets the default to `true` for automatic 24/7 operation. Local development and CI may keep the safe example default `false`. Desired state is logged on first observation and only when it transitions between ON and OFF. NestJS shutdown hooks allow the supervisor to release its lease promptly.

### Consequences
- Positive: a new production database starts automation automatically.
- Positive: changing or retaining an environment value cannot override an operator-disabled existing row.
- Positive: concurrent backend startup is idempotent from the application's perspective.
- Positive: logs clearly expose desired-state changes without periodic repetition.
- Negative: changing the bootstrap default has no effect after the singleton exists; allowlisted operators must use the control API or perform an intentional database reset.
- Risk: setting the production default to `true` starts workload immediately on a genuinely new database, so Redis, workers, and market data must be ready.

## Links
- [Refines ADR-0017](./0017-persistent-supervisor-for-24-7-search-loop.md)
- [Strategy Search Loop flow](../flows/strategy-search-loop.md)
- [Event Infrastructure module](../modules/event-infrastructure.md)
- [Operator authorization in ADR-0019](./0019-search-loop-operator-allowlist.md)
