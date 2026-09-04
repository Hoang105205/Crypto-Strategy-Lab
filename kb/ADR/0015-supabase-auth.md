# ADR-0015: Supabase Auth for User Authentication

## Status
Accepted

## Context
The original Constitution stated "no user accounts" — the system was single-user.
New requirements (`plans/todo.md` #1) mandate per-user leaderboards and user-scoped
strategy registration. This requires authentication.

The project already uses Supabase (hosted PostgreSQL) as its database. Supabase
provides a built-in Auth service with JWT tokens, email/password registration,
and session management.

## Decision Drivers
- Already using Supabase for PostgreSQL — no new vendor
- Time constraint: 4-week course project, auth is not the graded architecture
- Need JWT tokens that the NestJS backend can verify
- Frontend uses Next.js App Router (needs cookie-based sessions, not localStorage)
- Constitution IV (Simplicity) — don't build auth from scratch if a managed service exists

## Considered Options
1. **Custom JWT auth** — Build AuthModule with bcrypt password hashing, JWT signing,
   register/login endpoints, and session management from scratch in NestJS
2. **Supabase Auth** — Use Supabase's built-in Auth service. Frontend uses `@supabase/ssr`
   for cookie-based sessions. Backend verifies Supabase JWTs via a guard.
3. **NextAuth.js / Auth.js** — Frontend-only auth library. Would still need a backend
   token verification strategy.

## Decision Outcome
Chosen option: "Supabase Auth", because:
- Zero backend auth code (register, login, password hashing, email verification — all handled)
- Same Supabase project as the database (no new service to manage)
- `@supabase/ssr` provides cookie-based sessions compatible with Next.js App Router
- Backend only needs a lightweight JWT verification guard (~20 lines)
- Email/password only (per team decision) — no OAuth complexity
- Saves ~1.5 days compared to custom JWT implementation

### Consequences
- Positive: Fast to implement, production-tested auth, no password storage liability
- Positive: Supabase manages `auth.users` table in `auth` schema — no conflict with Prisma (`public` schema)
- Negative: Vendor lock-in to Supabase for auth (but already locked in for DB)
- Negative: Backend must fetch Supabase JWKS to verify tokens (cached, minimal overhead)
- Risks: If Supabase Auth service is down, users can't log in. Mitigation: Supabase SLA is 99.9%

## Links
- [Relates to ADR-0016 — App-Level userId Filtering]
- [Supabase Auth docs: https://supabase.com/docs/guides/auth]
