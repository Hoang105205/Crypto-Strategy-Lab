# Crypto Strategy Lab Constitution

## Core Principles

### I. Architecture Quality Over Trading Profitability
The grading target is modifiability, scalability, and extensibility — not P&L.
Every feature MUST fit within the architecture defined in ARCHITECTURE.md.
New modules require an ADR. No ad-hoc module creation.

### II. Contract-Driven
APIs and data interfaces are defined in contracts/ BEFORE implementation.
Field names, types, and endpoints in contracts/ are the Single Source of Truth.
A module consumes another module only through its contract — never its source.

### III. Extension Points Must Be Demonstrable
Every extension point (new strategy, new search algorithm, new data provider,
new news provider, BullMQ queue behavior) MUST be demonstrable in the final demo.
If it cannot be demonstrated, it does not count as extensible.

### IV. Simplicity Over Cleverness
Start with the simplest solution that works. No premature optimization.
No over-engineering for hypothetical future needs. YAGNI applies — except for
the extension points defined in the extensibility scenarios (see plan).

### V. Knowledge Base as Truth
When in doubt, the KB is authoritative. If code contradicts the KB, the KB wins
until explicitly updated via /hoang-kb-update. Interface changes require a
contract update AND team notification.

### VI. Explicit Over Implicit
Prefer explicit code over magic. Prefer named constants over literals.
Prefer clear naming over comments.

## Constraints
- **Tech Stack**: Modular Monolith — NestJS + Next.js + PostgreSQL/Prisma + EventEmitter2 + BullMQ/Redis + Python FastAPI (sentiment), see ARCHITECTURE.md
- **Scale**: Course project — 4 members, 4 weeks; architecture must support 10 documented extensibility scenarios
- **Security**: No real funds. User authentication via Supabase Auth (ADR-0015) — email/password only. API keys for external data sources stored in env vars, never committed. Per-user data isolation via app-level userId filtering (ADR-0016): `WHERE userId IS NULL OR userId = :currentUserId`

## Governance
- Constitution supersedes all other practices
- Amendments require documentation in ADR/ and team approval (Hoàng approves)
- Use GLOSSARY.md for consistent terminology

**Version**: 1.2 | **Ratified**: 2026-08-05 | **Last Amended**: 2026-08-18 (auth added per ADR-0015/0016)
