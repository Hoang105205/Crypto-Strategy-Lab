# Tasks: Auth + Trade Enhancements + Equity Curve

## Phase 1: Prisma + Shared Types
- [X] **T1.1** Add `userId String?` to StrategyVersion, BacktestResult, LeaderboardEntry in schema.prisma + run migration
- [X] **T1.2** Extend `Trade` interface in libs/shared: add stopLoss?, takeProfit?, transactionCost?, slippage?, volumeUsd?
- [X] **T1.3** Extend `BacktestConfig` interface: add stopLossPercent?, takeProfitPercent?

## Phase 2: Auth Backend
- [X] **T2.1** Install @supabase/supabase-js in backend
- [X] **T2.2** Create `auth/supabase-jwt.guard.ts` — verify Supabase JWT via JWKS
- [X] **T2.3** Create `auth/current-user.decorator.ts` — extract userId from request
- [X] **T2.4** Create `auth/require-auth.guard.ts` — reject if userId is null
- [X] **T2.5** Create `auth/auth.controller.ts` — GET /api/auth/me debug endpoint
- [X] **T2.6** Create `auth/auth.module.ts` — register all components
- [X] **T2.7** Import AuthModule in AppModule

## Phase 3: Auth Frontend
- [X] **T3.1** Install @supabase/ssr in frontend
- [X] **T3.2** Create `lib/supabase-client.ts` — createBrowserClient
- [X] **T3.3** Create `contexts/auth-context.tsx` — session state
- [X] **T3.4** Create `app/login/page.tsx` — email/password login form
- [X] **T3.5** Create `app/register/page.tsx` — email/password register form
- [X] **T3.6** Update `services/api-client.ts` — attach Bearer token from Supabase session
- [X] **T3.7** Wrap layout.tsx with AuthProvider
- [X] **T3.8** Create `components/auth/protected-route.tsx` — redirect to /login if unauthenticated. Wrap `app/page.tsx` with ProtectedRoute

## Phase 4: Trade Detail Table
- [X] **T4.1** Create `components/trade-detail-table.tsx` — table with all Trade fields

## Phase 5: Equity Curve Chart
- [X] **T5.1** Create `components/chart/equity-curve-chart.tsx` — cumulative profit line chart
- [X] **T5.2** Stats panel (win rate, total profit, total trades) included in trade detail table

## Phase 6: Verify
- [X] **T6.1** `tsc --noEmit` clean (backend — 0 auth errors)
- [X] **T6.2** `tsc --noEmit` clean (frontend — 0 errors)
- [X] **T6.3** Shared library rebuilt (Trade type extension propagated)
