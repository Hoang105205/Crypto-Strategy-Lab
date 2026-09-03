# Quickstart: Current User Display and Logout

## Prerequisites
- `workspace/.env` with `SUPABASE_URL`, `SUPABASE_ANON_KEY` (backend) and `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` (frontend)
- Redis not required for this feature; no Prisma migration required
- A registered Supabase test user (email/password)

## Setup
```powershell
cd "f:\Software Architecture\project\workspace"
npm install            # if deps changed (none expected for this feature)
npm run dev:backend    # NestJS on http://localhost:3001
npm run dev:frontend   # Next.js on http://localhost:3000
```

## Validation Scenarios

### Scenario 1: Identity is visible (US1 / SC-001)
1. Open `http://localhost:3000/login`, sign in with a test user.
2. Land on `/` (Dashboard).
3. ✅ Expected: top-right of the 64px nav shows an avatar chip with the user's display name (or email). Opening the dropdown shows the email and a **Log Out** row.

### Scenario 2: Logout happy path (US2 / SC-002, SC-003)
1. While signed in, open DevTools → Network.
2. Click the avatar chip → click **Log Out**.
3. ✅ Expected: a `POST http://localhost:3001/api/auth/logout` fires with `Authorization: Bearer …` and returns `200 { "message": "Logged out successfully" }`; then the browser navigates to `/login`; the avatar chip is gone.
4. Press Back. ✅ Expected: `/login` (replace, not push) — cannot return to the authed route; middleware keeps protected routes guarded.

### Scenario 3: Backend endpoint contract (SC-003)
```powershell
# No token → 401
curl -i -X POST http://localhost:3001/api/auth/logout
# Valid Supabase access token → 200 { message }
curl -i -X POST http://localhost:3001/api/auth/logout -H "Authorization: Bearer <ACCESS_TOKEN>"
```
✅ Expected: first returns `401`; second returns `200` with `{ "message": "Logged out successfully" }`.

### Scenario 4: Graceful degradation (US2 AS-3/AS-5 / SC-004)
1. Stop the backend (`npm run dev:backend` → Ctrl+C), stay signed in on the frontend.
2. Click **Log Out**.
3. ✅ Expected: the failed `POST` is swallowed; `supabase.auth.signOut()` still clears the session and the app redirects to `/login`. No half-logged-out state.

### Scenario 5: Accessibility (US3 / SC-005)
1. Tab to the avatar chip. ✅ Expected: visible focus ring; screen reader announces "Account menu for <email>".
2. Press `Enter`/`Space` to open; `Escape` to close. ✅ Expected: `aria-expanded` toggles; focus returns to the chip.

### Scenario 6: Automated checks (SC-006)
```powershell
cd "f:\Software Architecture\project\workspace"
npx turbo run test --filter=backend --filter=frontend   # or per-app: npm run test
npx tsc --noEmit -p apps/backend/tsconfig.json
npx tsc --noEmit -p apps/frontend/tsconfig.json
```
✅ Expected: new `auth.controller.spec.ts` + `user-nav-section.spec.tsx` pass; existing `app-shell.spec.tsx` still green; `tsc --noEmit` clean for both apps.
