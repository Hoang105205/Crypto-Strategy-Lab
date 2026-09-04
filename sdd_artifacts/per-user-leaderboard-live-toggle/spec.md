# Feature Specification: Per-User Leaderboard Live Toggle

**Feature**: `per-user-leaderboard-live-toggle`
**Created**: 2026-08-23
**Updated**: 2026-08-24
**Status**: Draft
**Input**: User description: "Update the existing per-user leaderboard feature with cross-route app-level live ownership. Preserve the explicit ON/OFF choice across navigation, reload, and browser restart; default to OFF when no choice exists; keep safe invalidation and viewer-scoped REST/cache behavior across routes and identity transitions."

## Requirement Authority and Conflict Resolution

Requirements are interpreted in this priority order:

1. Current KB architecture and flows updated 2026-08-24: `kb/ARCHITECTURE.md`, `kb/DESIGN.md`, `kb/modules/event-infrastructure.md`, `kb/flows/leaderboard-update.md`, and `kb/flows/strategy-search-loop.md`
2. `kb/contracts/auth.yaml` and `kb/contracts/events.yaml`
3. `plans/new-requirements-summary.md`, global-system-loop decision dated 2026-08-18
4. `plans/assignments/phuong-tasks.md`

The KB is now synchronized: the search loop is a global system process, while Live updates is an app-level browser-view preference. The provider and toggle MUST NOT introduce per-user `SearchLoopRun` data, per-user loop lifecycle control, rooms, socket authentication handshakes, namespace changes, client-side privacy filtering, or a data migration.

## User Scenarios & Testing

### User Story 1 - Read an Isolated Leaderboard (Priority: P1)

As an anonymous visitor or signed-in user, I see shared system leaderboard entries and, when signed in, only my own private entries, so another user's strategies and results remain confidential.

**Why this priority**: Cross-user disclosure is a security failure. Correct isolation of every leaderboard read path is the foundation for both REST and realtime behavior.

**Independent Test**: Seed one system entry, one private entry for user A, and one private entry for user B; exercise list and detail reads as anonymous, user A, and user B.

**Acceptance Scenarios**:

1. **Anonymous list**: **Given** system, user A, and user B entries exist and the request has no authenticated user, **When** the anonymous client requests the leaderboard list, **Then** the response contains only system entries whose `userId` is null.
2. **User A list**: **Given** the same data and user A is authenticated, **When** user A requests the leaderboard list, **Then** the response contains system entries plus user A's private entries and contains no user B private entry.
3. **User B list**: **Given** the same data and user B is authenticated, **When** user B requests the leaderboard list, **Then** the response contains system entries plus user B's private entries and contains no user A private entry.
4. **Anonymous system detail**: **Given** a system entry exists, **When** an anonymous client requests its detail, **Then** the system entry and its allowed detail data are returned.
5. **Anonymous private detail**: **Given** a private entry exists, **When** an anonymous client requests its detail identifier, **Then** the response is not found and reveals neither the entry nor its existence as private data.
6. **Owner detail**: **Given** user A owns a private entry, **When** user A requests its detail, **Then** the entry detail is returned together with any system-scoped data required by that response.
7. **Cross-user detail**: **Given** user B owns a private entry, **When** user A requests that entry's detail identifier, **Then** the response is not found and contains no user B data.
8. **Symmetric cross-user detail**: **Given** user A owns a private entry, **When** user B requests that entry's detail identifier, **Then** the response is not found and contains no user A data.
9. **Scoped ranking metadata**: **Given** entries from multiple owners have different ranks and update times, **When** any actor reads a leaderboard, **Then** Top-K selection, returned ranks, and snapshot timestamp are derived only from entries visible to that actor, with response ranks contiguous from 1 through N.

---

### User Story 2 - Observe the Global System Loop Without Owning It (Priority: P1)

As any client, I can observe the same global search-loop state without my identity changing which `SearchLoopRun` is read or giving me per-user loop ownership.

**Why this priority**: The 2026-08-18 architecture decision makes the always-running search loop system-global. Accidentally applying leaderboard scoping to loop runs would change the product model and fragment system state.

**Independent Test**: Read the same active loop as anonymous, user A, and user B and verify the same global run is returned without a user-based filter.

**Acceptance Scenarios**:

1. **Anonymous global read**: **Given** a global `SearchLoopRun` is active, **When** an anonymous client reads current loop status through a supported read endpoint, **Then** the global run is returned without filtering by `userId`.
2. **User A global read**: **Given** the same active run, **When** user A reads loop status, **Then** user A receives the same global run rather than a user-specific run.
3. **User B global read**: **Given** the same active run, **When** user B reads loop status, **Then** user B receives the same global run rather than a user-specific run.
4. **Auth context without loop scoping**: **Given** a loop controller request is processed with the standard authentication context, **When** the controller delegates the loop read, **Then** the current user identity is not used as a `SearchLoopRun` or `SearchLoopCandidate` filter.
5. **No scope expansion**: **Given** this feature is delivered, **When** the data model and loop behavior are reviewed, **Then** no `userId` ownership, per-user active-loop rule, or per-user loop lifecycle is added to `SearchLoopRun`.

---

### User Story 3 - Toggle Live Leaderboard Updates (Priority: P1)

As a leaderboard viewer, I can turn Live updates off to freeze the last visible snapshot and turn them back on to catch up, without controlling the system loop or disrupting other realtime consumers.

**Why this priority**: This is the user-visible A8 behavior and must preserve both the user's chosen snapshot and the shared connection lifecycle.

**Independent Test**: Start without a stored choice, verify OFF, explicitly toggle ON/OFF, reload/restart/remount, publish updates, and observe snapshot changes, scoped REST calls, socket state, and listener counts.

**Acceptance Scenarios**:

1. **Realtime ON**: **Given** the leaderboard is mounted with Live updates enabled, **When** a permitted `leaderboard:update` arrives, **Then** exactly one owned listener applies the update to the visible scoped snapshot without resetting the user's current sort or selected detail.
2. **Realtime OFF**: **Given** a snapshot is visible and Live updates is enabled, **When** the user turns Live updates off, **Then** the owned `leaderboard:update` listener is removed and the last successful snapshot remains visible unchanged.
3. **Freeze while OFF**: **Given** Live updates is off, **When** one or more leaderboard events occur, **Then** none of those events changes the frozen snapshot and the toggle remains off.
4. **Re-enable and catch up**: **Given** updates were missed while Live updates was off, **When** the user turns Live updates on again, **Then** the client restores exactly one listener and refetches the current REST-scoped snapshot so the view catches up before continuing with live updates.
5. **No loop commands**: **Given** the Live updates toggle is shown, **When** the user turns it on or off, **Then** no loop start, pause, resume, or stop REST operation is called and the global system loop continues unchanged.
6. **Shared socket preservation**: **Given** leaderboard, loop, queue, or other dashboard features share one infrastructure socket, **When** Live updates is turned off, **Then** the shared socket stays connected and only this feature's exact leaderboard listener is removed.
7. **Accessible state**: **Given** the toggle is rendered, **When** a keyboard or assistive-technology user operates or inspects it, **Then** it is keyboard reachable, has the accessible name "Live updates", and exposes its current on/off state without relying on color alone.
8. **No implicit opt-in**: **Given** the browser has no stored Live updates choice, **When** the application loads, **Then** Live updates is OFF, no leaderboard listener is attached, and loading/reloading never silently enables it.
9. **Persist explicit choice**: **Given** the user explicitly selected ON or OFF, **When** the page reloads or the browser restarts, **Then** the same choice is restored before live listener ownership is decided.

---

### User Story 4 - Preserve Isolation in Realtime and Lifecycle Events (Priority: P1)

As user A or user B, I receive only system entries and my own private entries through realtime behavior, including after reconnects, repeated toggles, route-page unmounts, and app-provider cleanup.

**Why this priority**: REST filtering alone is insufficient if a namespace-wide event leaks another user's private Top-K payload or stale listeners continue processing data.

**Independent Test**: Connect anonymous, user A, and user B clients concurrently; publish system and private changes; exercise off/on, reconnect, rerender, route-page unmount, and provider unmount while inspecting received payloads and active listeners.

**Acceptance Scenarios**:

1. **Anonymous realtime isolation**: **Given** an anonymous client has Live updates on, **When** system, user A, and user B leaderboard data changes, **Then** the anonymous client's received or applied realtime data contains only system entries.
2. **User A realtime isolation**: **Given** user A has Live updates on, **When** leaderboard data changes, **Then** user A's received or applied realtime snapshot contains only system entries plus user A private entries and contains no user B private data.
3. **User B realtime isolation**: **Given** user B has Live updates on, **When** leaderboard data changes, **Then** user B's received or applied realtime snapshot contains only system entries plus user B private entries and contains no user A private data.
4. **Explicit non-disclosure**: **Given** user A has private leaderboard data, **When** user B uses either leaderboard REST endpoints or realtime updates, **Then** no identifier, metric, strategy detail, timestamp, rank side effect, or payload belonging only to user A appears in user B's responses or view.
5. **Independent toggles**: **Given** user A turns Live updates off while user B remains on, **When** a permitted update occurs, **Then** user A stays frozen, user B continues updating, and neither user's toggle affects the other's connection or listener.
6. **Reconnect while ON**: **Given** Live updates is on and the socket connection is lost, **When** it reconnects, **Then** exactly one leaderboard listener is active and a REST-scoped refetch reconciles updates missed during disconnection.
7. **Reconnect while OFF**: **Given** Live updates is off and the socket connection is lost, **When** it reconnects, **Then** Live updates remains off, no leaderboard listener is reattached, and the frozen snapshot is preserved.
8. **Repeated toggle cleanup**: **Given** the user repeatedly switches Live updates on and off, **When** listener registrations are inspected, **Then** at most one listener owned by this feature exists and no duplicate handler applies an event more than once.
9. **Provider cleanup**: **Given** the app-level live provider is mounted with Live updates on, **When** the provider itself unmounts, **Then** its exact `leaderboard:update` handler is removed without removing listeners owned by other consumers and without disconnecting the shared socket.

---

### User Story 5 - Preserve Live Ownership Across Routes and Identities (Priority: P1)

As anonymous, user A, or user B, my Live updates choice and authorized leaderboard cache remain correct while I navigate, and another viewer's cached or delayed data can never render after an identity change.

**Why this priority**: A Dashboard-owned listener stops when the route unmounts, misses updates off-route, duplicates ownership when another route subscribes, and can leak A's cached response into B's first render. App-level ownership is required for both continuity and privacy.

**Independent Test**: Use one app session to navigate Dashboard → another route → `/leaderboard` → Dashboard while emitting invalidations, then perform A → B and A → anonymous transitions with delayed A requests and inspect listener count, REST authorization, cache contents, render order, and cleanup.

**Acceptance Scenarios**:

1. **ON survives navigation**: **Given** user A explicitly enabled Live updates, **When** A navigates away from Dashboard through client-side navigation, **Then** ON remains selected and the app-level provider retains exactly one `leaderboard:update` listener.
2. **Off-route invalidation**: **Given** A is on another route with Live updates ON, **When** a system-safe `leaderboard:update` arrives, **Then** the provider refetches REST with A's current session/token and replaces its leaderboard cache only with system + A data even though Dashboard is not mounted.
3. **Return to Dashboard**: **Given** one or more off-route invalidations were reconciled, **When** A returns to Dashboard, **Then** the toggle remains ON and Dashboard immediately renders the maintained current snapshot without adding a second listener.
4. **`/leaderboard` integration**: **Given** the app-level provider already owns live state and cache, **When** A opens `/leaderboard`, **Then** the route consumes the shared preference/snapshot and does not register an independent `leaderboard:update` listener.
5. **OFF survives routes and reloads**: **Given** the user explicitly selected OFF, **When** the user navigates, opens `/leaderboard`, reloads, restarts the browser, or reconnects, **Then** OFF remains selected, no leaderboard listener is attached, and the last valid snapshot stays frozen.
6. **Re-enable ordering**: **Given** updates were missed while OFF, **When** the user explicitly enables Live updates, **Then** the provider attaches exactly one listener before starting the current-session REST catch-up, and an event racing with catch-up cannot be lost or overwritten by an older response.
7. **Page unmount is not cleanup**: **Given** Live updates is ON, **When** Dashboard or `/leaderboard` unmounts because of client-side navigation, **Then** the provider, listener, preference, and authorized cache remain alive.
8. **Provider unmount is cleanup**: **Given** the app-level provider owns a listener, **When** the provider/app shell truly unmounts, **Then** it removes only its exact handler and never disconnects the shared socket or removes other consumers' handlers.
9. **Anonymous cache**: **Given** the current identity is anonymous, **When** an invalidation or catch-up completes, **Then** the provider cache contains system entries only.
10. **A and B cache isolation**: **Given** A or B is current, **When** an invalidation or catch-up completes, **Then** the cache contains system entries plus only that current user's private entries.
11. **A → B transition**: **Given** A's cache and requests exist, **When** the verified identity changes to B, **Then** A's cache is cleared and A-scoped requests are invalidated before B can render; B then receives only system + B.
12. **A → anonymous transition**: **Given** A's cache and requests exist, **When** A signs out, **Then** A's cache is cleared and A-scoped requests are invalidated before anonymous UI renders; the next cache contains system entries only.
13. **Delayed old-identity response**: **Given** an A-scoped REST request remains in flight during A → B or A → anonymous, **When** it resolves after the transition, **Then** it is rejected as stale and cannot commit any A data or metadata to the new viewer cache.
14. **Preference survives identity transition**: **Given** the browser has an explicit ON or OFF choice, **When** identity changes A → B or A → anonymous, **Then** cache/request ownership resets for privacy but the explicit Live updates choice is preserved and never implicitly toggled.

### Edge Cases

- A valid token that expires or becomes invalid is rejected according to the auth contract; it MUST NOT fall back to another user's scope.
- A missing token is treated as anonymous for endpoints that permit anonymous reads, yielding system entries only.
- An empty scoped leaderboard returns an empty list and a scoped snapshot timestamp that does not reveal another user's activity.
- A detail identifier that exists outside the caller's scope is indistinguishable from a nonexistent identifier and returns not found.
- Filtering MUST occur before Top-K selection, rank assignment, and update timestamp calculation; filtering a global Top-K afterward can omit valid owner entries and leak cross-user metadata.
- A realtime event arriving concurrently with re-enable refetch MUST not roll the view back to an older snapshot or create a gap between listener restoration and catch-up.
- Client-side navigation, reconnect, reload, and rerender MUST respect the explicit persisted Live updates choice and MUST not duplicate the handler or silently enable ON.
- Turning Live updates off MUST retain stale-but-valid data and its last-updated indication rather than clearing the table.
- A namespace-wide broadcast MUST contain system entries only and be treated as invalidation; private rows are obtained only through current-session scoped REST.
- Failures during catch-up refetch keep the last successful snapshot visible, expose a retryable error/stale state, and leave listener ownership consistent with the selected toggle state.
- A first-time browser, cleared preference, malformed preference, or unavailable browser storage MUST fail safe to OFF rather than opting the user into live updates.
- A route transition concurrent with invalidation MUST leave one provider listener and one authoritative provider cache; no page-level handler may race or duplicate the update.
- During A → B or A → anonymous, the old cache MUST be cleared before the new viewer renders, and every request started under A MUST be unable to commit after the identity generation changes.

## Requirements

### Functional Requirements

- **FR-001**: `LeaderboardController` and `LoopController` MUST process requests through `SupabaseJwtGuard` and obtain the caller identity through `@CurrentUser()` in accordance with `kb/contracts/auth.yaml`.
- **FR-002**: Every leaderboard list, Top-K, summary projection, ranking timestamp, and other leaderboard read MUST be scoped to entries where `userId` is null or equals the current authenticated user's ID.
- **FR-003**: For an anonymous caller, every leaderboard read MUST be scoped to entries where `userId` is null only.
- **FR-004**: Every leaderboard detail read MUST apply the same scope as list reads before returning entry, backtest, strategy, trade, or metric data.
- **FR-005**: A private detail outside the caller's scope MUST return not found and MUST NOT disclose that the identifier belongs to another user.
- **FR-006**: Top-K membership, ranks, and leaderboard `updatedAt` metadata MUST be calculated from the caller-visible dataset, not from a global dataset filtered after ranking.
- **FR-007**: User identity MUST propagate with user-originated backtest completion data into private leaderboard entries; search-loop-originated entries MUST retain `userId = null`.
- **FR-008**: `SearchLoopRun`, `SearchLoopCandidate`, queue audit data, and global loop status MUST NOT be filtered or partitioned by current user as part of this feature.
- **FR-009**: The feature MUST NOT add `userId` ownership or per-user lifecycle behavior to `SearchLoopRun`.
- **FR-010**: The frontend MUST expose a clearly labeled, accessible Live updates toggle. The explicit browser-local choice MUST persist across navigation, reload, and browser restart; absence of a stored choice MUST default to off.
- **FR-011**: While on, one app-level provider mounted below Auth and Infrastructure MUST own exactly one `leaderboard:update` listener across all client-side routes.
- **FR-012**: Turning Live updates off MUST remove only the exact listener owned by this feature and MUST retain the final visible snapshot.
- **FR-013**: While off, leaderboard events MUST NOT mutate the frozen snapshot, including after a reconnect.
- **FR-014**: Re-enabling Live updates MUST attach one listener before starting the current-session scoped REST catch-up and MUST prevent an older request from overwriting a newer event/refetch result.
- **FR-015**: Reconnecting while Live updates is on MUST restore one listener and refetch; reconnecting while it is off MUST neither re-enable live behavior nor refetch solely because of a leaderboard event.
- **FR-016**: Rerender, repeated toggles, route changes, and page unmounts MUST leave no duplicate or orphaned `leaderboard:update` listener. Page unmount is not the feature cleanup boundary; only app-level provider unmount removes the provider's exact handler.
- **FR-017**: The toggle MUST NOT invoke REST start, pause, resume, or stop operations for the search loop and MUST NOT alter global system-loop execution.
- **FR-018**: The toggle and its cleanup MUST NOT disconnect the shared infrastructure socket or remove listeners owned by other features.
- **FR-019**: Realtime is a system-only safe invalidation. Its application MUST refetch authoritative REST with the current verified session so anonymous cache becomes system-only, A cache becomes system + A, and B cache becomes system + B.
- **FR-020**: Private leaderboard data for user A MUST NOT appear in any REST response, realtime payload, applied snapshot, rank metadata, or update timestamp exposed to user B, and the symmetric rule MUST hold for user B's data relative to user A.
- **FR-021**: The existing global namespace broadcast MUST NOT include private leaderboard entries. Clients MUST obtain private viewer snapshots only through scoped REST refetch triggered by the system-safe event; this feature MUST NOT add recipient rooms or client-side privacy filtering.
- **FR-022**: Existing leaderboard sort choice and selected strategy detail MUST remain stable when a live update is applied, unless the selected entry ceases to be visible under the caller's scope.
- **FR-023**: The app-level provider MUST own the Live updates preference, viewer-scoped Dashboard leaderboard cache, request generation/invalidation state, and listener lifecycle above Dashboard and `/leaderboard` route lifetimes.
- **FR-024**: With Live updates on, every safe invalidation MUST trigger current-session REST reconciliation even when Dashboard and `/leaderboard` are not mounted.
- **FR-025**: Dashboard and `/leaderboard` MUST consume the provider-owned preference/cache and MUST NOT attach competing page-level `leaderboard:update` listeners.
- **FR-026**: Client-side navigation MUST preserve the provider, exact listener count, explicit ON/OFF choice, and current authorized cache. Returning to Dashboard MUST not require a page-mount catch-up when the provider already reconciled off-route updates.
- **FR-027**: Provider/app-shell unmount MUST remove only the provider's exact leaderboard handler and MUST NOT disconnect the shared socket or remove handlers owned by loop, queue, or other consumers.
- **FR-028**: Before B or anonymous UI renders after A's identity ends, the provider MUST clear A's cache, invalidate/abort A-scoped in-flight requests, and advance an identity/request generation boundary.
- **FR-029**: A response created under a prior identity or generation MUST be discarded even if it resolves successfully after the new identity becomes current.
- **FR-030**: The feature MUST preserve the existing event wire fields, authentication semantics, socket namespace, and shared socket connection lifecycle; it MUST add no room protocol, socket-auth handshake, migration, or per-user search-loop entity.

### Key Entities

- **LeaderboardEntry**: A ranked strategy result with nullable `userId`; null denotes system/shared data and a UUID denotes private owner data.
- **Leaderboard Snapshot**: The caller-visible ordered Top-K entries plus ranking criterion and scoped update timestamp; it is the state frozen while Live updates is off.
- **Authenticated User Context**: The verified current user ID or null for an anonymous request, used to determine leaderboard visibility but never to partition the system loop.
- **SearchLoopRun**: One global system search-loop execution. It remains shared and has no per-user ownership in this feature.
- **Live Updates Preference**: Explicit browser-persisted on/off state controlling ownership of the leaderboard update listener; absence defaults off, and it is not a loop execution state.
- **App-Level Leaderboard Live Provider**: Application-lifetime owner of the preference, one listener, viewer-scoped Dashboard leaderboard cache, and identity/request generations across route changes.
- **Identity Generation**: Monotonic viewer boundary used to invalidate cached data and delayed requests created for a prior anonymous/authenticated identity.
- **Leaderboard Update**: Existing system-only realtime safe invalidation; it is never the authoritative private viewer snapshot.

## Success Criteria

- **SC-001**: In a three-actor isolation test (anonymous, user A, user B), 100% of list and detail responses contain only entries allowed by the actor's scope, with zero cross-user private fields or metadata.
- **SC-002**: Requests by user A for user B private detail, and vice versa, return not found in 100% of tested cases.
- **SC-003**: In concurrent realtime tests, zero user A private fields appear in user B's received payloads or applied view, zero user B private fields appear for user A, and anonymous clients receive zero private fields.
- **SC-004**: While Live updates is off, 100% of emitted leaderboard updates leave the stored and displayed snapshot unchanged.
- **SC-005**: Re-enabling after one or more missed updates produces a current scoped snapshot after one catch-up refetch and leaves exactly one active leaderboard listener.
- **SC-006**: Across repeated on/off cycles, reconnects, rerenders, and route-page unmounts, the app provider owns no more than one active leaderboard listener; after provider unmount, it leaves zero owned orphaned listeners.
- **SC-007**: Toggle interaction produces zero search-loop lifecycle REST calls, zero shared-socket disconnects, and no change to the global `SearchLoopRun` state.
- **SC-008**: Anonymous, user A, and user B observe the same global loop status for the same system run, demonstrating that no per-user loop scope was introduced.
- **SC-009**: Across Dashboard → another route → `/leaderboard` → Dashboard navigation with Live updates ON, exactly one provider-owned listener remains active, each invalidation performs current-session REST reconciliation, and the returning Dashboard renders the maintained current snapshot without a second listener.
- **SC-010**: Across navigation, reload, browser restart, and reconnect, 100% of explicit ON/OFF choices are restored; a browser without a valid stored choice is OFF in 100% of cases and never auto-enables.
- **SC-011**: During tested A → B and A → anonymous transitions, zero A cache fields render for the next viewer and zero delayed A requests commit after the transition boundary.
- **SC-012**: Page-route unmounts remove zero provider-owned leaderboard listeners; provider unmount removes exactly its own handler, causes zero shared-socket disconnects, and removes zero foreign handlers.

## Assumptions

- `SupabaseJwtGuard` permits a missing token to continue as anonymous and rejects invalid or expired tokens, as specified by `kb/contracts/auth.yaml`.
- Live updates uses browser-local persistence. A first-time/cleared browser defaults to off; reload and browser restart restore the last explicit choice. Cross-device or server-side user-profile synchronization remains outside scope.
- REST remains the authoritative full-state source; realtime is used for prompt updates and triggers catch-up reconciliation after missed delivery.
- Existing nullable `userId` fields and event fields defined in the active contracts are available; this feature does not require a new user account model or a per-user loop migration.
- The existing infrastructure socket and `leaderboard:update` wire contract remain unchanged. Viewer privacy comes from system-only invalidation plus current-session scoped REST, not from socket identity or client filtering.
- The app-level provider lives below Auth and Infrastructure so verified identity/session and the existing shared socket are available before it owns viewer cache/listener behavior.

## Out of Scope

- Per-user `SearchLoopRun`, `SearchLoopCandidate`, loop workers, stop conditions, or loop lifecycle commands.
- Stopping, pausing, resuming, or starting the system loop from the Live updates toggle.
- Disconnecting or replacing the shared infrastructure socket.
- Synchronizing the Live updates preference across devices or through a server-side user profile.
- Adding socket rooms, socket authentication/handshake behavior, a new namespace, or client-side filtering of private realtime payloads.
- Adding a Prisma/data migration or changing existing event wire fields/authentication semantics for cross-route ownership.
- Changing leaderboard scoring, supported sort criteria, Top-K size, or strategy/backtest business rules except where scoped ranking is necessary for isolation.

## KB Cross-References

- **Modules affected**: Auth (session/current identity), Event Infrastructure (scoped leaderboard reads, safe invalidation, global loop reads), and Frontend (app-level provider plus Dashboard/Leaderboard consumers). No new module is introduced.
- **E2E flows affected**: `kb/flows/leaderboard-update.md` defines cross-route provider ownership, safe invalidation, persistence, reconnect, and identity transition; `kb/flows/strategy-search-loop.md` confirms navigation/toggle/auth transitions never control the global loop.
- **Architecture constraints**: `AuthProvider` → `InfrastructureProvider` → app-level leaderboard live provider → route consumers; REST is authoritative; event payload is system-only; viewer scope is applied server-side before Top-K/rank/`updatedAt`; `SearchLoopRun` stays global.
- **Constitution gates**: KB-as-truth, contract-driven unchanged wire/auth semantics, app-level system-or-current-user isolation, explicit single listener/cache ownership, no ad-hoc module, and simplicity without room/handshake/migration expansion.
- **Glossary terms**: Authentication, Authorization, userId (nullable), System Data, User-Private Data, Leaderboard, Top-K, Search Loop Run, Live Updates Preference, Safe Invalidation, WebSocket Gateway.
- **Contract references**: `kb/contracts/auth.yaml` (`CurrentUser`, `SupabaseJwtGuard`, `data_scoping`) and `kb/contracts/events.yaml` (`LeaderboardEntryPayload`, `LeaderboardUpdated`).
- **Decision references**: ADR-0015 (Supabase Auth), ADR-0016 (app-level userId filtering), the 2026-08-18 global-system-loop decision, and the 2026-08-24 KB cross-route/persisted-choice update.
