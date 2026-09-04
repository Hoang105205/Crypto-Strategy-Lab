# Contract: Auth Logout API (feature-local)

> SSoT for this feature. The authoritative KB contract is `kb/contracts/auth.yaml`, which is updated during implementation (FR-011). Field names/paths here MUST match the KB after convergence.

## Endpoints

### POST /api/auth/logout
Terminates the current session from the client's perspective. The backend performs a JWT-guarded **acknowledgement** (audit hook + future denylist extension point); authoritative revocation is `supabase.auth.signOut()` on the frontend (D3).

**Guard**: `@UseGuards(SupabaseJwtGuard, RequireAuth)` (class-level on `AuthController`)
**Controller path**: `@Controller('api/auth')` (renamed from `auth` — D2)

**Request**:
- Headers: `Authorization: Bearer <supabase_access_token>` (attached automatically by `apiRequest`)
- Body: none

**Response** `200 OK`:
```json
{ "message": "Logged out successfully" }
```
Type: `LogoutAcknowledgement { message: string }`

**Errors**:
- `401 UNAUTHORIZED` — missing, invalid, or expired JWT (thrown by `RequireAuth`). The frontend MUST still complete `signOut()` + redirect (FR-009, US2 AS-5).

**Side effects**: Backend logs the `userId` (audit). No DB write. No token store mutation.

## Frontend API Client

### `apiClient.logout(): Promise<LogoutResponse>`
```ts
export interface LogoutResponse { message: string }
// services/api-client.ts
async logout(): Promise<LogoutResponse> {
  return apiRequest<LogoutResponse>("/api/auth/logout", { method: "POST" });
}
```
Reuses `apiRequest` (auto Bearer token, unified error → `ApiClientError`). Callers treat rejection as non-fatal (D4).

## Frontend Component Contract

### `<UserNavSection />` (`components/auth/user-nav-section.tsx`, `'use client'`)
Consumes `useAuth()` (`user`, `loading`, `signOut`) + `useRouter()`.

| State | Render |
|-------|--------|
| `loading === true` | Subtle placeholder chip (avatar skeleton), no identifying text, no logout control |
| `user === null` (anonymous) | `null` (renders nothing) |
| authenticated | Avatar-initials chip + primary label (`display_name ?? email`) [+ muted email line when a display name exists] + dropdown toggle |

**Dropdown** (when open): account header (name + email) + full-width **Log Out** `<button>`.
- ARIA: toggle has `aria-haspopup="menu"`, `aria-expanded`, `aria-label="Account menu for <email>"`; Log Out has an accessible name.
- Keyboard: `Enter`/`Space` toggle, `Escape` closes, outside-click closes; visible focus ring (`ring-info`).

**Logout handler** (idempotent, disabled while in flight):
```
setLoggingOut(true)
try { await apiClient.logout() } catch { /* graceful degradation — never block logout */ }
await signOut()            // supabase.auth.signOut() → clears cookies + local auth state
router.replace('/login')   // replace (not push) so Back cannot return to an authed route
```

## Events
- None published. `supabase.auth.signOut()` triggers `AuthProvider.onAuthStateChange('SIGNED_OUT')`, which the existing leaderboard-live provider already handles for the A→anonymous identity transition (DESIGN.md). This feature adds **no** new event.
