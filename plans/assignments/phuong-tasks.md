# Phương — New Requirements Assignment

> **Date**: 2026-08-18 | **From**: Hoàng (Architect)
> **Prerequisite**: Hoàng must ship `SupabaseJwtGuard` + `@CurrentUser()` first (Task A2)

## Your Tasks

### A7: Add userId filtering to Leaderboard + Loop controllers

**What**: Add `@CurrentUser()` to your leaderboard and loop controller methods.
Filter LeaderboardEntry queries by userId.

**Why**: Users should only see system leaderboard entries (shared) + their own
user entries (private). System data has `userId = null`.

**How**:
1. Read `kb/contracts/auth.yaml` — especially §decorators and §data_scoping
2. Add `@UseGuards(SupabaseJwtGuard)` to your controller classes
3. Add `@CurrentUser() userId: string | null` parameter to each controller method
4. Filter LeaderboardEntry queries: `where: { OR: [{ userId: null }, { userId: userId }] }`
5. SearchLoopRun is **global** (system loop runs 24/7) — no userId filter needed on loop runs

**Important**: The search loop is NOT per-user. It runs as a system process.
Users cannot start/stop the system loop — they can only subscribe/unsubscribe
to live leaderboard updates (see A8).

### A8: Loop toggle button on frontend

**What**: Add a start/stop toggle button to the LoopStatusPanel component.
When ON: frontend subscribes to `leaderboard:update` WebSocket events (live updates).
When OFF: frontend unsubscribes (leaderboard view freezes).

**Why**: Users want control over whether their leaderboard view is live-updating or frozen.

**How**:
1. Add a toggle button to `LoopStatusPanel` (or create a new `LeaderboardToggle` component)
2. When user clicks "Start": join the `leaderboard:update` WebSocket room
3. When user clicks "Stop": leave the WebSocket room (view freezes at last state)
4. The system loop continues running regardless — this is just a subscription toggle

**Files to modify**: Leaderboard controller, loop controller, `LoopStatusPanel.tsx` or new component

## How to Start

```bash
# 1. Pull latest code from dev branch (Hoàng's auth infra must be merged first)
git pull origin dev

# 2. Read the updated KB
cat kb/contracts/auth.yaml       # Auth contract — guards, decorators, data scoping
cat kb/contracts/events.yaml     # Updated LeaderboardEntryPayload with userId

# 3. Run SDD cycle for your tasks
/hoang-sdd-specify
# Feature: "Add userId filtering to Leaderboard and Loop controllers, add leaderboard live-update toggle UI"
```

## Estimated effort: 1.5 days (A7: 1d + A8: 0.5d)
