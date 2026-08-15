# Research: Fix Strategy Engine Bugs

## Decisions

### D1: Injection Tokens for Shared Interfaces
- **Chosen**: Use string tokens `'IJobQueue'` and `'IEventBus'`.
- **Rationale**: Interfaces cannot be used as injection tokens in TypeScript/NestJS natively after compilation. String tokens are the standard way to inject interface-based providers across module boundaries when the actual implementation is decoupled.
- **Alternatives considered**: Class-based injection (e.g. injecting `BullMqJobQueue`), but this violates the Dependency Inversion principle and couples the Strategy module to a specific infrastructure implementation, which is explicitly prohibited by the modular monolith design.
- **KB reference**: ADR-0005 (Event-Driven Communication), ADR-0006 (Job Queue Worker for Backtesting)
