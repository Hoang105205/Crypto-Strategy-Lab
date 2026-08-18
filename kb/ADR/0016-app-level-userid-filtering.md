# ADR-0016: App-Level userId Filtering (No RLS)

## Status
Accepted

## Context
With user authentication (ADR-0015), data must be scoped per-user. Some data is
shared (system loop-discovered strategies, market data, news), while other data
is private (user-created strategies, user-initiated backtests, user leaderboard entries).

Supabase supports Row Level Security (RLS) — database-enforced per-user data isolation.
Prisma connects via a single connection string and doesn't natively support RLS
per-request.

## Decision Drivers
- Prisma doesn't support per-request RLS (single connection, single role)
- Constitution IV (Simplicity) — don't fight the ORM
- The `userId` scoping logic is simple: `WHERE userId IS NULL OR userId = :currentUserId`
- System data (loop-discovered) has `userId = null` — shared across all users

## Considered Options
1. **App-level filtering** — Backend extracts `userId` from JWT via `@CurrentUser()`
   decorator, adds `WHERE userId IS NULL OR userId = :currentUserId` to Prisma queries
2. **Supabase RLS** — Enable Row Level Security on tables, set `request.jwt.claim.sub`
   per request. Would require raw SQL or Supabase client for auth-gated queries
   (Prisma can't set per-request JWT claims)
3. **Hybrid** — RLS for defense-in-depth + app-level filtering for Prisma compatibility

## Decision Outcome
Chosen option: "App-level filtering", because:
- Works naturally with Prisma — no raw SQL needed
- Simple filter logic: `WHERE userId IS NULL OR userId = :currentUserId`
  (null = system/shared data, non-null = user-private data)
- Each module owner adds the filter to their own queries — clean separation
- Constitution IV (Simplicity) — don't add RLS complexity that Prisma can't leverage

### Data Scoping Model
| Data Type | userId value | Visibility |
|---|---|---|
| System loop-discovered strategies | `null` | All users |
| User-created strategies | `<user UUID>` | Owner only |
| System backtests (from loop) | `null` | All users |
| User-initiated backtests | `<user UUID>` | Owner only |
| System leaderboard entries | `null` | All users |
| User leaderboard entries | `<user UUID>` | Owner only |
| Market data (candles, pairs) | N/A (no userId column) | All users |
| News + sentiment | N/A (no userId column) | All users |

### Consequences
- Positive: Simple, Prisma-native, each module owner controls their own filters
- Positive: No database-level policy complexity
- Negative: If a backend bug misses a filter, data could leak between users
- Mitigation: The `@CurrentUser()` decorator + guard pattern makes it hard to forget.
  A code review checklist item: "Every query on userId-scoped tables must include the filter."
- Future hardening: RLS can be added later as defense-in-depth without changing app code

## Links
- [Relates to ADR-0015 — Supabase Auth]
