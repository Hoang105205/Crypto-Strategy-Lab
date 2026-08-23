# Feature Specification: Per-User Leaderboard Live Toggle

**Feature**: `per-user-leaderboard-live-toggle`
**Created**: 2026-08-23
**Status**: Draft
**Input**: User description: "Complete Phuong tasks A7 and A8 by scoping leaderboard list/detail and realtime data to system entries plus the current user's private entries, while keeping SearchLoopRun global and making the frontend Live updates toggle control only the leaderboard listener."

## Requirement Authority and Conflict Resolution

Requirements are interpreted in this priority order:

1. `plans/assignments/phuong-tasks.md`
2. `plans/new-requirements-summary.md`, decision dated 2026-08-18
3. `kb/contracts/auth.yaml` and `kb/contracts/events.yaml`

`kb/flows/strategy-search-loop.md` is stale where it says an end user starts, pauses, resumes, or stops the search loop. The 2026-08-18 decision supersedes that behavior: the search loop is a global system process, and the user-facing toggle controls only whether the current browser view receives live leaderboard updates. This feature MUST NOT introduce per-user `SearchLoopRun` data or per-user loop lifecycle control.

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

**Independent Test**: Start with Live updates on, publish updates while toggling off and on, and observe snapshot changes, network calls, socket state, and listener counts.

**Acceptance Scenarios**:

1. **Realtime ON**: **Given** the leaderboard is mounted with Live updates enabled, **When** a permitted `leaderboard:update` arrives, **Then** exactly one owned listener applies the update to the visible scoped snapshot without resetting the user's current sort or selected detail.
2. **Realtime OFF**: **Given** a snapshot is visible and Live updates is enabled, **When** the user turns Live updates off, **Then** the owned `leaderboard:update` listener is removed and the last successful snapshot remains visible unchanged.
3. **Freeze while OFF**: **Given** Live updates is off, **When** one or more leaderboard events occur, **Then** none of those events changes the frozen snapshot and the toggle remains off.
4. **Re-enable and catch up**: **Given** updates were missed while Live updates was off, **When** the user turns Live updates on again, **Then** the client restores exactly one listener and refetches the current REST-scoped snapshot so the view catches up before continuing with live updates.
5. **No loop commands**: **Given** the Live updates toggle is shown, **When** the user turns it on or off, **Then** no loop start, pause, resume, or stop REST operation is called and the global system loop continues unchanged.
6. **Shared socket preservation**: **Given** leaderboard, loop, queue, or other dashboard features share one infrastructure socket, **When** Live updates is turned off, **Then** the shared socket stays connected and only this feature's exact leaderboard listener is removed.
7. **Accessible state**: **Given** the toggle is rendered, **When** a keyboard or assistive-technology user operates or inspects it, **Then** it is keyboard reachable, has the accessible name "Live updates", and exposes its current on/off state without relying on color alone.

---

### User Story 4 - Preserve Isolation in Realtime and Lifecycle Events (Priority: P1)

As user A or user B, I receive only system entries and my own private entries through realtime behavior, including after reconnects, repeated toggles, and component cleanup.

**Why this priority**: REST filtering alone is insufficient if a namespace-wide event leaks another user's private Top-K payload or stale listeners continue processing data.

**Independent Test**: Connect anonymous, user A, and user B clients concurrently; publish system and private changes; exercise off/on, reconnect, rerender, and unmount while inspecting received payloads and active listeners.

**Acceptance Scenarios**:

1. **Anonymous realtime isolation**: **Given** an anonymous client has Live updates on, **When** system, user A, and user B leaderboard data changes, **Then** the anonymous client's received or applied realtime data contains only system entries.
2. **User A realtime isolation**: **Given** user A has Live updates on, **When** leaderboard data changes, **Then** user A's received or applied realtime snapshot contains only system entries plus user A private entries and contains no user B private data.
3. **User B realtime isolation**: **Given** user B has Live updates on, **When** leaderboard data changes, **Then** user B's received or applied realtime snapshot contains only system entries plus user B private entries and contains no user A private data.
4. **Explicit non-disclosure**: **Given** user A has private leaderboard data, **When** user B uses either leaderboard REST endpoints or realtime updates, **Then** no identifier, metric, strategy detail, timestamp, rank side effect, or payload belonging only to user A appears in user B's responses or view.
5. **Independent toggles**: **Given** user A turns Live updates off while user B remains on, **When** a permitted update occurs, **Then** user A stays frozen, user B continues updating, and neither user's toggle affects the other's connection or listener.
6. **Reconnect while ON**: **Given** Live updates is on and the socket connection is lost, **When** it reconnects, **Then** exactly one leaderboard listener is active and a REST-scoped refetch reconciles updates missed during disconnection.
7. **Reconnect while OFF**: **Given** Live updates is off and the socket connection is lost, **When** it reconnects, **Then** Live updates remains off, no leaderboard listener is reattached, and the frozen snapshot is preserved.
8. **Repeated toggle cleanup**: **Given** the user repeatedly switches Live updates on and off, **When** listener registrations are inspected, **Then** at most one listener owned by this feature exists and no duplicate handler applies an event more than once.
9. **Unmount cleanup**: **Given** the leaderboard feature is mounted with Live updates on, **When** it unmounts, **Then** its exact `leaderboard:update` handler is removed without removing listeners owned by other consumers and without disconnecting the shared socket.

### Edge Cases

- A valid token that expires or becomes invalid is rejected according to the auth contract; it MUST NOT fall back to another user's scope.
- A missing token is treated as anonymous for endpoints that permit anonymous reads, yielding system entries only.
- An empty scoped leaderboard returns an empty list and a scoped snapshot timestamp that does not reveal another user's activity.
- A detail identifier that exists outside the caller's scope is indistinguishable from a nonexistent identifier and returns not found.
- Filtering MUST occur before Top-K selection, rank assignment, and update timestamp calculation; filtering a global Top-K afterward can omit valid owner entries and leak cross-user metadata.
- A realtime event arriving concurrently with re-enable refetch MUST not roll the view back to an older snapshot or create a gap between listener restoration and catch-up.
- A reconnect or rerender MUST respect the current Live updates state and MUST not duplicate the handler.
- Turning Live updates off MUST retain stale-but-valid data and its last-updated indication rather than clearing the table.
- A namespace-wide broadcast MUST NOT contain private entries unless server-side recipient isolation guarantees that only the owning user can receive them.
- Failures during catch-up refetch keep the last successful snapshot visible, expose a retryable error/stale state, and leave listener ownership consistent with the selected toggle state.

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
- **FR-010**: The frontend MUST expose a clearly labeled, accessible Live updates toggle whose default state is on for a newly mounted view.
- **FR-011**: While on, the frontend MUST own exactly one `leaderboard:update` listener that applies permitted scoped updates.
- **FR-012**: Turning Live updates off MUST remove only the exact listener owned by this feature and MUST retain the final visible snapshot.
- **FR-013**: While off, leaderboard events MUST NOT mutate the frozen snapshot, including after a reconnect.
- **FR-014**: Re-enabling Live updates MUST restore one listener and refetch the current scoped REST snapshot to catch up with missed updates while preventing older data from overwriting newer data.
- **FR-015**: Reconnecting while Live updates is on MUST restore one listener and refetch; reconnecting while it is off MUST neither re-enable live behavior nor refetch solely because of a leaderboard event.
- **FR-016**: Rerender, repeated toggles, and unmount MUST leave no duplicate or orphaned `leaderboard:update` listener.
- **FR-017**: The toggle MUST NOT invoke REST start, pause, resume, or stop operations for the search loop and MUST NOT alter global system-loop execution.
- **FR-018**: The toggle and its cleanup MUST NOT disconnect the shared infrastructure socket or remove listeners owned by other features.
- **FR-019**: Realtime delivery and application MUST enforce the same visibility rule as REST: anonymous receives system entries only; user A receives system plus A; user B receives system plus B.
- **FR-020**: Private leaderboard data for user A MUST NOT appear in any REST response, realtime payload, applied snapshot, rank metadata, or update timestamp exposed to user B, and the symmetric rule MUST hold for user B's data relative to user A.
- **FR-021**: A global namespace broadcast MUST NOT include private leaderboard entries; any private realtime delivery MUST be restricted to the authenticated owner, or clients MUST obtain their private snapshot through a scoped REST refetch triggered without exposing the private payload globally.
- **FR-022**: Existing leaderboard sort choice and selected strategy detail MUST remain stable when a live update is applied, unless the selected entry ceases to be visible under the caller's scope.

### Key Entities

- **LeaderboardEntry**: A ranked strategy result with nullable `userId`; null denotes system/shared data and a UUID denotes private owner data.
- **Leaderboard Snapshot**: The caller-visible ordered Top-K entries plus ranking criterion and scoped update timestamp; it is the state frozen while Live updates is off.
- **Authenticated User Context**: The verified current user ID or null for an anonymous request, used to determine leaderboard visibility but never to partition the system loop.
- **SearchLoopRun**: One global system search-loop execution. It remains shared and has no per-user ownership in this feature.
- **Live Updates Preference**: Client-side on/off state controlling ownership of the leaderboard update listener; it is not a loop execution state.
- **Leaderboard Update**: A realtime notification or scoped snapshot change that may affect only recipients authorized to see its entries.

## Success Criteria

- **SC-001**: In a three-actor isolation test (anonymous, user A, user B), 100% of list and detail responses contain only entries allowed by the actor's scope, with zero cross-user private fields or metadata.
- **SC-002**: Requests by user A for user B private detail, and vice versa, return not found in 100% of tested cases.
- **SC-003**: In concurrent realtime tests, zero user A private fields appear in user B's received payloads or applied view, zero user B private fields appear for user A, and anonymous clients receive zero private fields.
- **SC-004**: While Live updates is off, 100% of emitted leaderboard updates leave the stored and displayed snapshot unchanged.
- **SC-005**: Re-enabling after one or more missed updates produces a current scoped snapshot after one catch-up refetch and leaves exactly one active leaderboard listener.
- **SC-006**: Across repeated on/off cycles, reconnects, rerenders, and unmount, the feature owns no more than one active leaderboard listener and leaves zero orphaned listeners after cleanup.
- **SC-007**: Toggle interaction produces zero search-loop lifecycle REST calls, zero shared-socket disconnects, and no change to the global `SearchLoopRun` state.
- **SC-008**: Anonymous, user A, and user B observe the same global loop status for the same system run, demonstrating that no per-user loop scope was introduced.

## Assumptions

- `SupabaseJwtGuard` permits a missing token to continue as anonymous and rejects invalid or expired tokens, as specified by `kb/contracts/auth.yaml`.
- The default Live updates state for a newly mounted view is on. A normal page reload may reset to this default; persistence of the preference across browser sessions is outside scope.
- REST remains the authoritative full-state source; realtime is used for prompt updates and triggers catch-up reconciliation after missed delivery.
- Existing nullable `userId` fields and event fields defined in the active contracts are available; this feature does not require a new user account model or a per-user loop migration.
- Socket authentication or recipient rooms may be selected during planning only if needed to meet FR-019 through FR-021 and accompanied by the necessary contract and verification work. The specification does not assume a room protocol already exists.
- Updating stale KB flows is a follow-up governance action after the implementation is approved; this feature records the conflict rather than silently following the stale flow.

## Out of Scope

- Per-user `SearchLoopRun`, `SearchLoopCandidate`, loop workers, stop conditions, or loop lifecycle commands.
- Stopping, pausing, resuming, or starting the system loop from the Live updates toggle.
- Disconnecting or replacing the shared infrastructure socket.
- Persisting the Live updates preference across browser sessions or devices.
- Changing leaderboard scoring, supported sort criteria, Top-K size, or strategy/backtest business rules except where scoped ranking is necessary for isolation.
- Updating `kb/flows/strategy-search-loop.md` within this specification step.

## KB Cross-References

- **Modules affected**: Auth (guard and current-user context), Event Infrastructure (leaderboard reads, global loop reads, realtime gateway), and Frontend (leaderboard/dashboard live-view state).
- **E2E flows affected**: `kb/flows/leaderboard-update.md` for scoped REST/realtime snapshots; `kb/flows/strategy-search-loop.md` is referenced as stale where it grants user loop control and is superseded by the 2026-08-18 decision for this feature.
- **Architecture constraints**: Modular-monolith boundaries remain unchanged; modules communicate through active contracts; Supabase authentication and application-level `userId` filtering apply only to nullable user-owned leaderboard data; `SearchLoopRun` stays global.
- **Constitution gates**: Contract-driven behavior; app-level data isolation using system-or-current-user scope; no ad-hoc module; explicit listener ownership; simple global-loop model; KB conflict recorded rather than hidden.
- **Glossary terms**: Authentication, Authorization, SupabaseJwtGuard, `@CurrentUser()`, userId (nullable), System Data, User-Private Data, Leaderboard, Top-K, Search Loop Run, WebSocket Gateway.
- **Contract references**: `kb/contracts/auth.yaml` (`CurrentUser`, `SupabaseJwtGuard`, `data_scoping`) and `kb/contracts/events.yaml` (`LeaderboardEntryPayload`, `LeaderboardUpdated`).
- **Decision references**: ADR-0015 (Supabase Auth), ADR-0016 (app-level userId filtering), and the global-system-loop decision in `plans/new-requirements-summary.md` dated 2026-08-18.
