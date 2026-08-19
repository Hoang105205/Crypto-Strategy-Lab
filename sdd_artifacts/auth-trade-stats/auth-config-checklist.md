# Auth Module — Configuration Checklist

> Read this before testing the auth module tomorrow.

## 1. Get Supabase anon key (2 min)

1. Go to **Supabase Dashboard** → your project (`mwsvlqxouczbgkwmsruk`)
2. **Settings** → **API** → **Project API keys**
3. Copy the `anon` `public` key (starts with `eyJ...`)

## 2. Fill in .env files (1 min)

### Backend (`workspace/apps/backend/.env`)
```
SUPABASE_URL=https://mwsvlqxouczbgkwmsruk.supabase.co
SUPABASE_ANON_KEY=<paste anon key here>
```

### Frontend (`workspace/apps/frontend/.env`)
```
NEXT_PUBLIC_SUPABASE_URL=https://mwsvlqxouczbgkwmsruk.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste same anon key here>
```

## 3. Enable email/password auth (1 min)

1. Supabase Dashboard → **Authentication** → **Providers**
2. Click **Email**
3. Make sure **Enable Email provider** is ON
4. (Optional) Disable "Confirm email" for easier testing:
   - Authentication → Settings → "Confirm email" → OFF
   (Otherwise users need to click a confirmation link before they can log in)

## 4. Test (5 min)

```bash
# Start backend
cd workspace/apps/backend
npm run start:dev

# Start frontend (new terminal)
cd workspace/apps/frontend
npm run dev
```

Then:
1. Open `http://localhost:3000` → should redirect to `/login`
2. Click "Register" → enter email + password (min 8 chars)
3. Should redirect back to dashboard
4. Open browser DevTools → Network tab → any API request should show
   `Authorization: Bearer eyJ...` header
5. Test backend: `curl -H "Authorization: Bearer <token>" http://localhost:3001/api/auth/me`
   → should return `{"id":"your-user-uuid"}`

## 5. What's already done (don't re-do)

| What | Where |
|---|---|
| Prisma schema (userId columns) | `schema.prisma` — `prisma db push` already applied |
| Auth backend (guard, decorator, module) | `src/auth/` — 6 files, imported in AppModule |
| Auth frontend (client, context, pages) | `lib/supabase-client.ts`, `contexts/auth-context.tsx`, `app/login/`, `app/register/` |
| Route protection (server-side) | `src/middleware.ts` — protects ALL routes, exempts /login and /register |
| Route protection (client-side) | `components/auth/protected-route.tsx` — client-side fallback for dashboard |
| API client Bearer header | `services/api-client.ts` — auto-attaches token from session |
| Shared types (Trade extension) | `libs/shared/src/types/strategy.ts` — rebuilt and propagated |

## 6. What teammates need to do (after you push)

Read `plans/new-requirements-summary.md` (MUST READ), then their assignment docs:
- **Huy**: `plans/assignments/huy-tasks.md` — add @CurrentUser() to strategy controller + extend backtester output + wire trade table/equity curve
- **Phương**: `plans/assignments/phuong-tasks.md` — add @CurrentUser() to leaderboard/loop controllers + loop toggle UI
- **Thuận**: No new tasks (news is global)
