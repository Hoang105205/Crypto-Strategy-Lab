# Auth Module

> **Owner**: Hoàng | **Layer**: Backend (infrastructure) + Frontend | **Related ADRs**: ADR-0015, ADR-0016
> **Contract**: `kb/contracts/auth.yaml`

## 1. Overview

The Auth module provides authentication infrastructure for the entire system. It does NOT
handle user management (register/login/logout) — that is delegated to Supabase Auth.
The module's responsibility is: **verify Supabase JWTs on the backend and expose the
authenticated userId to other modules via a decorator.**

- **Responsibility**: JWT verification, userId extraction, frontend session management
- **Layer**: Cross-cutting infrastructure (all modules consume)
- **Dependencies**: Supabase Auth service (JWKS endpoint)
- **Contract**: `kb/contracts/auth.yaml`
- **Related ADRs**: ADR-0015 (Supabase Auth), ADR-0016 (app-level filtering)

## 2. Component Architecture

### Backend (NestJS)

| Component | File | Pattern | Description |
|---|---|---|---|
| `SupabaseJwtGuard` | `auth/supabase-jwt.guard.ts` | Guard | Verifies Supabase JWT from Authorization header. Fetches JWKS (cached). Attaches `userId` to `request.user`. |
| `RequireAuth` | `auth/require-auth.guard.ts` | Guard | Companion guard — rejects if `userId` is null. Use after `SupabaseJwtGuard` for protected routes. |
| `@CurrentUser()` | `auth/current-user.decorator.ts` | Parameter Decorator | Extracts `userId` from `request.user`. Returns `string | null`. |
| `AuthController` | `auth/auth.controller.ts` | Controller | `@Controller('api/auth')`. `GET /api/auth/me` (debug profile) + `POST /api/auth/logout` (JWT-guarded logout acknowledgement; logs userId, returns `{ message }`). |
| `AuthModule` | `auth/auth.module.ts` | Module | Registers guard, decorator, controller. Exports nothing — guards are used directly. |

### Frontend (Next.js)

| Component | File | Description |
|---|---|---|
| Supabase client | `lib/supabase-client.ts` | `createBrowserClient` from `@supabase/ssr` |
| AuthContext | `contexts/auth-context.tsx` | React context wrapping Supabase session state |
| Login page | `app/login/page.tsx` | Email/password form — calls `supabase.auth.signInWithPassword()` |
| Register page | `app/register/page.tsx` | Email/password form — calls `supabase.auth.signUp()` |
| API client update | `services/api-client.ts` | Attaches `Authorization: Bearer <token>` from Supabase session |
| ProtectedRoute | `components/auth/protected-route.tsx` | Client-side fallback — redirects to /login if unauthenticated |
| UserNavSection | `components/auth/user-nav-section.tsx` | Far-right top-nav profile section — shows current user's display name/email (avatar-initials chip) and an accessible dropdown with **Log Out**. Logout calls `POST /api/auth/logout` best-effort, then `supabase.auth.signOut()`, then `router.replace('/login')`. Rendered by `AppShell`; renders nothing when anonymous and a placeholder while the session resolves. |
| Middleware | `src/middleware.ts` | **Server-side route protection** — checks Supabase session cookie on every request, redirects to /login if no session. Protects ALL routes automatically. Exempts /login and /register. |

## 3. Design Patterns

### Guard + Decorator Pattern
**Where**: Backend — `SupabaseJwtGuard` + `@CurrentUser()`
**Why**: Separates authentication (guard) from authorization (decorator + query filter).
Each module owner controls their own authorization by adding `@CurrentUser()` and
filtering queries. The guard is infrastructure — applied once per controller.
**How**: 
```typescript
@UseGuards(SupabaseJwtGuard)
@Controller('strategies')
export class StrategyController {
  @Get()
  async list(@CurrentUser() userId: string | null) {
    return this.service.findAll(userId); // service filters: WHERE userId IS NULL OR userId = ?
  }
}
```

## 4. Internal Data Flow

```
Frontend                    Backend
─────────                   ───────
Browser                     NestJS
  │                           │
  │ supabase.auth.signIn()    │
  ├──────────────────► Supabase Auth
  │                           │ (returns JWT)
  │◄──────────────────        │
  │                           │
  │ GET /api/strategies       │
  │ Authorization: Bearer JWT │
  ├──────────────────────────►│
  │                    SupabaseJwtGuard
  │                    ├── verify JWT signature (JWKS cached)
  │                    ├── check expiry
  │                    └── attach userId to request.user
  │                           │
  │                    @CurrentUser() userId
  │                    StrategyService.findAll(userId)
  │                    └── WHERE userId IS NULL OR userId = ?
  │                           │
  │◄──────────────────────────│
  │ 200 OK + strategies       │
```

## 5. Data Model

Auth does NOT own any Prisma models. Supabase manages `auth.users` in the `auth` schema.

Application tables that gain a `userId` column (nullable String):

| Table | userId semantics |
|---|---|
| StrategyVersion | null = system-discovered, non-null = user-created |
| BacktestResult | null = system backtest, non-null = user-initiated |
| LeaderboardEntry | null = system entry, non-null = user entry |

## 6. API Surface

See `kb/contracts/auth.yaml` for full endpoint documentation.

Note: Register and login are handled by Supabase Auth directly from the frontend.
The backend implements `GET /api/auth/me` (debugging) and `POST /api/auth/logout`
(a JWT-guarded acknowledgement that logs the userId and returns `{ message }`).
Because Supabase JWTs are stateless and the backend holds no session store,
`POST /api/auth/logout` does NOT revoke the token — authoritative session
invalidation is `supabase.auth.signOut()` on the frontend (clears the refresh
token + `@supabase/ssr` cookies). The frontend calls the endpoint best-effort and
tolerates failure, then always signs out locally and redirects to `/login`
(Constitution IV — no token denylist).

## 7. Quality Attributes

- **Security**: JWT verified via Supabase JWKS (cached 10 min). No password storage in app.
- **Performance**: JWKS caching — first request fetches, subsequent requests use cache.
- **Reliability**: If Supabase Auth is down, existing JWTs remain valid until expiry.
  New logins fail — users see a login error, not a crash.
- **Testability**: Guard can be mocked in tests by setting `request.user = { id: 'test-uuid' }`.

## 8. Testing Strategy

- Unit test: `@CurrentUser()` decorator extracts userId from mock request
- Unit test: `SupabaseJwtGuard` accepts valid JWT, rejects invalid/expired
- Integration: protected endpoint returns 401 without token, 200 with valid token
- E2E: register → login → call protected API → get scoped data

## 9. Open Questions

None — all decisions resolved in ADR-0015 and ADR-0016.
