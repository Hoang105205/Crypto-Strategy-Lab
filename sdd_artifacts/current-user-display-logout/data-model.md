# Data Model: Current User Display and Logout

## Summary
**No new persistent entities and no Prisma schema changes.** Auth owns no tables — Supabase manages `auth.users` (ADR-0015). This feature reads the existing session user on the frontend and returns a transient acknowledgement from the backend.

## Entity Relationship Diagram
```
Supabase auth.users (managed by Supabase — NOT Prisma)
        │  (JWT: sub = id, email, user_metadata)
        ▼
AuthSession  ── read by ──►  AuthProvider (FE context)  ──►  UserNavSection (render)
        │
        │  POST /api/auth/logout  (Bearer JWT)
        ▼
AuthController.logout()  ── verifies via SupabaseJwtGuard ──►  LogoutAcknowledgement { message }
```

## Entities

### AuthUser (existing — `kb/contracts/auth.yaml`)
Read-only on the frontend from `session.user`. No new fields.

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK (Supabase `auth.users.id`) | JWT `sub` claim; extracted by `@CurrentUser()` on the backend |
| email | string | required | Primary display fallback + accessible label |
| user_metadata.display_name / name / full_name | string? | optional | Display-name candidates (D5); often absent for email/password auth |
| createdAt | DateTime | Supabase-managed | Not used by this feature |

### AuthSession (existing — `kb/contracts/auth.yaml`)
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| accessToken | string (JWT) | required | Sent as `Authorization: Bearer <token>` by `apiRequest` |
| refreshToken | string | HttpOnly cookie | Cleared by `supabase.auth.signOut()` |
| expiresAt | DateTime | — | Not directly used |

### LogoutAcknowledgement (new — response-only DTO, no persistence)
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| message | string | required | e.g. `"Logged out successfully"` — returned by `POST /api/auth/logout` |

## Indexes
- None (no new tables/columns).

## Migration Notes
- **No migration required.** No Prisma model changes; no `prisma db push`/`migrate` step.
- The only backend "data" change is the routing path (`@Controller('auth')` → `@Controller('api/auth')`), which is metadata, not storage.
