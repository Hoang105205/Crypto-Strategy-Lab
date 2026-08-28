# Feature Specification: Split Leaderboard Boxes

**Feature**: `split-leaderboard-boxes`  
**Created**: 2026-08-25  
**Status**: Draft  
**Input**: User description: "Tách `/leaderboard` thành hai card độc lập: System Leaderboard chỉ hiển thị dữ liệu hệ thống và My Strategies chỉ hiển thị dữ liệu của user hiện tại; mỗi scope có Top-K, rank và `updatedAt` riêng, giữ combined behavior mặc định, privacy-safe realtime, identity isolation, responsive layout và không thay đổi database/global loop/socket protocol."

## Requirement Authority and Existing Baseline

Requirements are interpreted in this order:

1. The explicit user requirements in this feature request.
2. `kb/CONSTITUTION.md`, especially contract-driven development, KB authority, simplicity, and explicit app-level authorization.
3. `kb/ARCHITECTURE.md`, `kb/MODULES.md`, and `kb/modules/event-infrastructure.md`.
4. `kb/flows/leaderboard-update.md`, `kb/flows/strategy-search-loop.md`, `kb/GLOSSARY.md`, and `kb/DESIGN.md`.
5. The delivered baseline in `sdd_artifacts/per-user-leaderboard-live-toggle/`.

The existing baseline already provides nullable ownership, caller-scoped combined reads, detail anti-enumeration, system-safe realtime invalidation, a cross-route provider, and identity-transition protection. This feature extends that baseline with independent System and Mine projections; it does not replace or weaken it.

`per-user-leaderboard-live-toggle` still has pending release-validation tasks T041 and T042. Planning for this feature may proceed, but implementation must treat those gates as a prerequisite baseline or explicitly carry equivalent regression evidence forward.

The current KB describes `/leaderboard` as one combined table, while this request requires two independent cards and anonymous access to the System card. After this feature is accepted and validated, the relevant KB design, flow, module, contract, and glossary descriptions must be updated consistently.

## User Scenarios & Testing

### User Story 1 - Browse Separate System and Personal Rankings (Priority: P1)

As a visitor or authenticated user, I can distinguish the system-discovered strategies from my own strategies because `/leaderboard` presents them in separate System Leaderboard and My Strategies cards.

**Why this priority**: Separating the two datasets is the primary user-visible value of the feature. Without a clear ownership boundary, users cannot tell whether a strategy belongs to the global system process or to their own work.

**Independent Test**: Prepare system entries plus private entries for users A and B, open `/leaderboard` as anonymous, A, and B, and verify each card's rows, ranks, timestamp, heading, and empty/sign-in state.

**Acceptance Scenarios**:

1. **Anonymous view**: **Given** system, A, and B entries exist and no user is authenticated, **When** the visitor opens `/leaderboard`, **Then** System Leaderboard shows only system entries and My Strategies shows an accessible sign-in state without exposing A or B data.
2. **User A view**: **Given** the same data and user A is authenticated, **When** A opens `/leaderboard`, **Then** System Leaderboard shows only system entries and My Strategies shows only A entries.
3. **User B view**: **Given** the same data and user B is authenticated, **When** B opens `/leaderboard`, **Then** System Leaderboard shows only system entries and My Strategies shows only B entries.
4. **Independent Top-K**: **Given** combined ranking contains enough high-ranked system entries to displace a user's entries, **When** that user opens the two-card view, **Then** My Strategies still shows its own complete Top-K and is not derived by filtering the combined Top-K.
5. **Independent ranks and timestamps**: **Given** system and private entries have different scores and update times, **When** either card is rendered, **Then** its ranks are contiguous `1..N` and its `updatedAt` reflects only that card's scope.
6. **Backward-compatible combined view**: **Given** an existing consumer requests the leaderboard without selecting a scope, **When** the request is processed, **Then** it receives the existing combined behavior: anonymous receives system data and an authenticated user receives system plus that user's data.

---

### User Story 2 - Preserve Privacy Across List and Detail Reads (Priority: P1)

As an authenticated user, I can inspect system strategies and my own strategies without another user's rows, ranking effects, timestamps, identifiers, metrics, or detail existence being disclosed.

**Why this priority**: Cross-user disclosure is a security failure. Visual separation is acceptable only if the server-authorized projection and detail boundaries remain authoritative.

**Independent Test**: Use one system entry, one A entry, one B entry, and a nonexistent identifier; exercise scoped lists and details as anonymous, A, and B.

**Acceptance Scenarios**:

1. **System scope isolation**: **Given** system and private entries exist, **When** any actor reads the System projection, **Then** only entries with `userId = null` influence rows, best-per-version selection, sorting, Top-K, rank, and `updatedAt`.
2. **Mine scope isolation for A**: **Given** A and B entries exist, **When** A reads the Mine projection, **Then** only entries owned by A influence rows and metadata.
3. **Mine scope isolation for B**: **Given** A and B entries exist, **When** B reads the Mine projection, **Then** only entries owned by B influence rows and metadata.
4. **Anonymous Mine projection**: **Given** private entries exist and the caller is anonymous, **When** the Mine projection is requested, **Then** it is empty and its metadata reveals no private activity.
5. **Owner detail**: **Given** A selects an A-owned row from My Strategies, **When** its detail is requested, **Then** the authorized detail is returned.
6. **System detail**: **Given** any actor selects a system row, **When** its detail is requested, **Then** the authorized system detail is returned.
7. **Detail anti-enumeration**: **Given** a private A strategy and a nonexistent identifier, **When** B or an anonymous visitor requests either identifier, **Then** both responses are indistinguishable not-found results and reveal no A ownership or existence metadata.
8. **Untrusted ownership input**: **Given** B is authenticated, **When** B attempts to request another user's Mine data by supplying an identifier or ownership value, **Then** the visible projection remains B-only because ownership comes from the verified current identity.

---

### User Story 3 - Sort and Inspect Both Rankings Consistently (Priority: P1)

As a leaderboard user, I can change one ranking criterion and compare both independent rankings under that same criterion, then inspect a selected in-scope strategy without losing context.

**Why this priority**: Two cards are useful only if their results are comparable. Divergent sort state would make the view misleading.

**Independent Test**: Populate both scopes with entries whose ordering differs by Score and Sharpe Ratio, change the criterion, select rows from both cards, and verify both ranking projections and detail behavior.

**Acceptance Scenarios**:

1. **Shared criterion**: **Given** both cards are visible, **When** the user changes the ranking criterion, **Then** both cards use the same selected criterion.
2. **Independent re-ranking**: **Given** each scope has multiple entries, **When** the criterion changes, **Then** each scope independently performs best-per-version selection, sorting, Top-K, continuous rank assignment, and timestamp calculation for that criterion without rerunning a backtest.
3. **System selection**: **Given** a system row is visible, **When** it is selected, **Then** the detail view shows that system strategy while both cards retain the selected criterion.
4. **Mine selection**: **Given** an owned row is visible, **When** it is selected, **Then** the detail view shows that private strategy while both cards retain the selected criterion.
5. **Selection becomes invalid**: **Given** the selected strategy becomes out of scope after logout, user switch, or a new projection, **When** the new identity/projection is applied, **Then** the old selection and detail are no longer displayed.
6. **Invalid criterion or scope**: **Given** an unsupported ranking criterion or leaderboard scope is requested, **When** the request is validated, **Then** it is rejected with a stable validation error and no fallback exposes unintended data.

---

### User Story 4 - Remain Correct During Realtime and Identity Changes (Priority: P1)

As anonymous, user A, or user B, I receive fresh System and Mine projections while Live updates is ON, and a prior identity's private data can never render, commit, or remain cached after an identity change.

**Why this priority**: The app-level provider outlives route pages. Adding projection scope must not reintroduce duplicate listeners, stale commits, or A-to-B cache leakage.

**Independent Test**: Exercise live ON/OFF, safe invalidation, reconnect, A-to-B, A-to-anonymous, and a delayed A response while inspecting rendered cards, accepted cache, request outcomes, listener ownership, and loop commands.

**Acceptance Scenarios**:

1. **Safe realtime refresh**: **Given** Live updates is ON and both cards have valid snapshots, **When** a system-safe `leaderboard:update` invalidation arrives, **Then** the provider reconciles the relevant current-identity System and Mine projections through authoritative scoped reads rather than treating event rows as a private snapshot.
2. **Private update privacy**: **Given** A creates or updates a private leaderboard entry, **When** the namespace-wide invalidation is delivered, **Then** its payload discloses no private A row or private result identifier and only A's subsequent authorized Mine projection can expose the change.
3. **Reconnect while ON**: **Given** Live updates is ON and updates may have been missed, **When** the shared connection reconnects, **Then** both relevant projections reconcile for the current identity and the provider retains exactly one leaderboard invalidation owner.
4. **Reconnect while OFF**: **Given** Live updates is OFF, **When** the shared connection reconnects, **Then** the frozen accepted snapshots remain visible, no live-only reconciliation is triggered, and the preference remains OFF.
5. **A to B**: **Given** A's two-card snapshots, selection, cache, and requests exist, **When** the verified identity changes to B, **Then** no A private row, rank, timestamp, selection, detail, cache entry, or delayed response can render or commit for B; B receives only system and B projections.
6. **A to anonymous**: **Given** A's state exists, **When** A signs out, **Then** no A private data renders or commits; the anonymous System card contains only system data and My Strategies shows the sign-in state.
7. **Delayed old-identity response**: **Given** an A-scoped read remains in flight during an identity transition, **When** it completes after B or anonymous becomes current, **Then** it cannot overwrite either new projection or its metadata.
8. **Global loop non-interference**: **Given** the user sorts, navigates, reconnects, toggles Live updates, or changes identity, **When** the two-card state changes, **Then** no global Search Loop lifecycle command is issued and the one global loop continues unchanged.

---

### User Story 5 - Understand Independent UI States on Every Screen Size (Priority: P2)

As a keyboard, assistive-technology, desktop, or mobile user, I can identify and operate each card and understand its loading, stale, error, empty, or sign-in state without confusing it with the other card.

**Why this priority**: The feature must remain usable when one scope has no data or fails independently, and two wide financial tables must not become unreadable on mobile.

**Independent Test**: Render each card in loading, stale, error, empty, and populated states at desktop and mobile widths; inspect accessible names, focus behavior, content order, and horizontal scrolling.

**Acceptance Scenarios**:

1. **Independent loading**: **Given** one projection is still loading while the other is available, **When** the page renders, **Then** the loading card preserves its expected space and the available card remains usable.
2. **Independent error**: **Given** one projection fails and the other succeeds, **When** the page renders, **Then** only the failed card shows a retryable error and the successful card remains visible.
3. **Stale snapshot**: **Given** a card has a last successful current-identity snapshot and its refresh fails or the connection is unavailable, **When** the page renders, **Then** it retains that snapshot, labels it stale with its timestamp, and does not substitute data from the other scope or identity.
4. **No system entries**: **Given** the System projection is empty, **When** the page renders, **Then** System Leaderboard explains that no system strategies are ranked without changing My Strategies.
5. **No owned entries**: **Given** an authenticated user has no ranked entries, **When** the page renders, **Then** My Strategies shows an empty state with one clear CTA to `/strategy`.
6. **Anonymous sign-in state**: **Given** the visitor is anonymous, **When** My Strategies renders, **Then** it has an accessible name, explains that sign-in is required, and provides a keyboard-reachable sign-in action.
7. **Accessible distinction**: **Given** both cards are visible, **When** assistive technology enumerates regions and tables, **Then** System Leaderboard and My Strategies have unique headings and unique accessible table names.
8. **Mobile order**: **Given** a mobile viewport, **When** the page renders, **Then** content appears in the order System Leaderboard, My Strategies, Strategy Detail.
9. **Mobile table access**: **Given** either table has more columns than the mobile viewport, **When** the user navigates the card, **Then** that table has its own horizontal scrolling region and no required financial column is removed.
10. **Desktop composition**: **Given** a desktop viewport, **When** both cards and detail are visible, **Then** each leaderboard card retains enough width for a usable table and the detail remains clearly associated with the selected row.

## Edge Cases

- The combined Top-K can contain zero Mine entries even though the user has ranked entries below the combined cutoff; System and Mine projections must still return their own complete Top-K.
- A strategy version may have multiple backtest entries; each projection exposes only its best entry under the selected criterion according to the existing best-per-version rule.
- A scope with no entries returns an empty `entries` collection, continuous rank invariant over zero rows, and neutral scope-local timestamp metadata that reveals no other scope's activity.
- System and Mine can have equal timestamps or scores; existing deterministic ranking tie rules remain applicable within each projection.
- A private entry with the highest overall score must not affect the System projection's membership, rank, or timestamp.
- A system entry with the highest overall score must not displace a Mine entry from the Mine Top-K.
- A partial failure affects only the failed card. A page-wide failure is appropriate only when no required projection can produce either a current snapshot or a same-identity stale snapshot.
- A retry applies to the failed or stale projection without silently changing the selected ranking criterion or Live updates preference.
- A malformed, missing, expired, or unauthorized identity never falls through to another user's Mine scope.
- Anonymous access to `/leaderboard` must reach the System card and My sign-in state rather than exposing a prior authenticated render.
- An identity transition concurrent with a sort change, invalidation, reconnect, retry, or detail request cannot commit state captured under the prior identity.
- A strategy selected from Mine may disappear after logout or user switch; its private detail must clear before the new identity renders.
- An invalid scope cannot be interpreted as combined implicitly; only omission selects backward-compatible combined behavior.
- Turning Live updates OFF freezes the last accepted projection snapshots but does not stop the global Search Loop or disconnect the shared infrastructure connection.
- A namespace-wide realtime event remains an invalidation only. The client never filters private event rows into System or Mine views.
- Dashboard continues to consume the existing combined Score projection and must not adopt the two-card presentation as part of this feature.

## Requirements

### Functional Requirements

- **FR-001**: `/leaderboard` MUST present two independently identifiable cards named System Leaderboard and My Strategies.
- **FR-002**: `/leaderboard` MUST be readable by an anonymous visitor so the visitor can see System Leaderboard and an accessible My Strategies sign-in state.
- **FR-003**: The System projection MUST include only entries whose `userId` is null.
- **FR-004**: The Mine projection MUST include only entries whose `userId` equals the current verified authenticated user's ID.
- **FR-005**: The Mine projection for an anonymous caller MUST be empty and MUST NOT expose private activity through rows, identifiers, rank effects, counts, or timestamps.
- **FR-006**: The existing leaderboard request with no explicit scope MUST retain combined behavior: anonymous receives system entries; an authenticated caller receives system entries plus only that caller's private entries.
- **FR-007**: The supported leaderboard scopes MUST be explicit `system`, `mine`, and `combined` values, and an unsupported explicit value MUST produce a stable validation failure rather than silently selecting another scope.
- **FR-008**: Scope filtering MUST occur before best-per-version selection, sorting, Top-K truncation, rank assignment, and `updatedAt` calculation.
- **FR-009**: Each System and Mine projection MUST independently return at most the configured Top-K entries even when those entries would be absent from the combined Top-K.
- **FR-010**: Each non-empty projection MUST assign response ranks contiguously from `1` through `N` within that projection.
- **FR-011**: Each projection's `updatedAt` MUST be derived only from entries within that projection and MUST reveal no other user's activity.
- **FR-012**: Ownership for Mine MUST be derived from the verified current identity and MUST NOT be selectable through caller-supplied user ownership data.
- **FR-013**: No caller MUST receive another user's private row, identifier, metric, rank side effect, count side effect, timestamp side effect, cached value, or detail data.
- **FR-014**: System and owned strategy details MUST remain readable only when allowed by the existing server-authorized detail scope.
- **FR-015**: A private detail outside the caller's scope MUST be indistinguishable from a nonexistent detail.
- **FR-016**: System Leaderboard and My Strategies MUST share one active ranking criterion at a time.
- **FR-017**: Changing the ranking criterion MUST independently re-rank both projections without requiring any backtest to run again.
- **FR-018**: A valid selection from either card MUST open the corresponding authorized detail without resetting the active criterion.
- **FR-019**: A selected strategy that becomes out of scope MUST be cleared before the new identity or projection renders its detail state.
- **FR-020**: System and Mine MUST expose independent loading, error, stale, empty, and retry behavior so one projection's failure does not erase a valid projection from the other card.
- **FR-021**: An authenticated user with no Mine entries MUST see an explanatory empty state and one primary action leading to `/strategy`.
- **FR-022**: An anonymous visitor MUST see an accessible My Strategies sign-in state and action rather than an unexplained empty table.
- **FR-023**: Both cards MUST have unique accessible region headings and unique table names; interactive controls MUST be keyboard operable and state MUST not rely on color alone.
- **FR-024**: On mobile, content order MUST be System Leaderboard, My Strategies, then Strategy Detail, and each populated table MUST have its own horizontal scrolling region without dropping required financial columns.
- **FR-025**: On desktop, the two leaderboard cards MUST not be compressed into an unusable side-by-side table layout; the selected detail MUST remain visibly associated with the ranking workspace.
- **FR-026**: `leaderboard:update` MUST remain a system-safe namespace-wide invalidation and MUST NOT become an authoritative private projection.
- **FR-027**: While Live updates is ON, a safe invalidation or reconnect MUST reconcile the relevant current-identity System and Mine projections through authoritative scoped reads.
- **FR-028**: While Live updates is OFF, events and reconnects MUST preserve the frozen current-identity snapshots and MUST NOT silently enable Live updates or trigger live-only reconciliation.
- **FR-029**: The app-level provider MUST remain the single owner of leaderboard invalidation behavior across route navigation; the two cards MUST NOT create independent competing realtime owners.
- **FR-030**: Before A-to-B or A-to-anonymous renders, A-owned rows, metadata, selection, detail, accepted cache, and in-flight results MUST become ineligible to render or commit.
- **FR-031**: A delayed response captured under an old identity or old projection generation MUST NOT overwrite a current System or Mine projection.
- **FR-032**: The explicit Live updates preference MUST survive identity transitions and MUST remain independent from leaderboard scope.
- **FR-033**: Dashboard preview MUST remain outside this feature's UI split and MUST continue using the existing backward-compatible combined Score projection.
- **FR-034**: This feature MUST NOT add or modify Prisma ownership fields, migrations, database entities, Search Loop ownership, socket rooms, socket authentication handshakes, socket namespaces, or private realtime payloads.
- **FR-035**: Sorting, navigation, retry, Live updates changes, reconnect, and identity transitions MUST issue no global Search Loop lifecycle command and MUST NOT change the single global `SearchLoopRun` model.

### Key Entities

- **LeaderboardEntry**: A persisted ranked-result candidate with nullable `userId`; null means System Data and a UUID means User-Private Data. Its persistence model is unchanged by this feature.
- **Leaderboard Scope**: The requested visibility projection: System, Mine, or Combined. It determines which entries may participate before ranking metadata is calculated.
- **Leaderboard Snapshot**: A scope-local full-state projection for one ranking criterion, containing its independently calculated entries and `updatedAt` metadata.
- **System Leaderboard**: The user-facing card backed by the System projection and containing only system-owned entries.
- **My Strategies**: The user-facing card backed by the Mine projection for the current verified user, or an anonymous sign-in state.
- **Current Viewer**: The resolved anonymous or authenticated identity that determines Mine authorization and cache/request eligibility.
- **Selected Strategy**: The currently inspected in-scope strategy version; it is shared across the two-card workspace but cannot survive a transition that makes it unauthorized.
- **Live Updates Preference**: The existing explicit browser preference controlling whether safe invalidations trigger reconciliation; it is not an ownership or Search Loop control.
- **Safe Invalidation**: The existing namespace-wide system-safe notification that prompts authoritative scoped reconciliation while Live updates is ON.

## Success Criteria

- **SC-001**: In an automated three-actor matrix, anonymous renders only System Data, A renders System plus only A in the appropriate cards, and B renders System plus only B, with zero cross-user row or metadata disclosure.
- **SC-002**: For every supported ranking criterion and non-empty scope, returned ranks are exactly `1..N` with no gaps or duplicates.
- **SC-003**: A Mine entry outside the combined Top-K still appears in the Mine Top-K when it qualifies within Mine, proving the card is not produced by filtering combined results.
- **SC-004**: Foreign-existing and nonexistent private detail identifiers produce the same stable not-found outcome for anonymous, A, and B where applicable.
- **SC-005**: Changing the ranking criterion updates both cards consistently while preserving any still-authorized selection.
- **SC-006**: When one projection fails, the other card remains visible and operable in every tested partial-failure scenario.
- **SC-007**: Live ON invalidation and reconnect reconcile both relevant projections without exposing private event data or creating more than one leaderboard invalidation owner.
- **SC-008**: Live OFF preserves the last accepted current-identity System and Mine snapshots across events and reconnect without a live-only read or implicit preference change.
- **SC-009**: Automated A-to-B, A-to-anonymous, and delayed-response scenarios show zero frame, cache, selection, detail, row, rank, or timestamp from A after the identity boundary.
- **SC-010**: At a mobile viewport, automated checks confirm the order System, Mine, Detail and independent horizontal scrolling with every required financial column present.
- **SC-011**: Accessibility checks find unique card/table names, keyboard-reachable sort, selection, retry, sign-in, and CTA controls, and no state communicated by color alone.
- **SC-012**: Existing Dashboard combined preview, global Search Loop behavior, safe WebSocket wire, database schema, and migration history remain unchanged under regression tests and scope audit.

## Assumptions

- The existing default Top-K value and deterministic tie-breaking rules remain authoritative and apply independently within System, Mine, and Combined projections.
- An anonymous Mine read produces an empty, privacy-neutral projection rather than another user's data or combined data; the UI presents a sign-in state and may avoid an unnecessary Mine read.
- `/leaderboard` becomes anonymous-readable because the requested anonymous System view cannot otherwise be delivered. Authentication remains required for private Mine data and private detail access.
- System and Mine share one user-selected ranking criterion. Independent sort controls that can diverge are not part of this feature.
- System and Mine card state is independent: a same-identity stale snapshot may remain visible after refresh failure, while a card with no accepted snapshot shows its own loading or error state.
- The CTA path `/strategy` named by the user is an existing valid entry point to submit or configure a backtest.
- Strategy Detail remains one shared detail area for the workspace rather than one detail panel per card.
- Dashboard preview remains combined and is protected by regression coverage; splitting the Dashboard preview is a separate future feature.
- The feature reuses the existing nullable `userId` ownership data. No data backfill or migration is required.
- Existing pending T041-T042 validation for `per-user-leaderboard-live-toggle` must be completed or explicitly incorporated into this feature's prerequisite validation before release.

## Out of Scope

- Redesigning or splitting the Dashboard leaderboard preview.
- Adding leaderboard history, pagination, search, ownership filters beyond System/Mine/Combined, or per-card ranking criteria.
- Changing the scoring formula, deterministic tie rules, configured Top-K, or best-per-version business rule.
- Changing Strategy Builder behavior beyond the existing `/strategy` CTA destination.
- Adding database fields, migrations, RLS, or per-user persisted rank columns.
- Changing the WebSocket channel, namespace, handshake, authentication, rooms, or event payload to carry private data.
- Making Search Loop runs or candidates user-owned, or adding end-user loop lifecycle controls.
- Resolving unrelated authentication-contract, lint, formatting, or framework-version drift.

## KB Cross-References

- **Modules affected**: Event Infrastructure leaderboard reads and Frontend route/provider consumers from `kb/MODULES.md` and `kb/modules/event-infrastructure.md`; Auth is consumed through its existing verified-identity contract.
- **E2E flows affected**: `kb/flows/leaderboard-update.md`; `kb/flows/strategy-search-loop.md` is regression-only to preserve global non-interference.
- **Architecture constraints**: modular monolith boundaries, REST plus existing WebSocket safe invalidation, app-level authorization, one app-level leaderboard provider, and no cross-module implementation imports from `kb/ARCHITECTURE.md`.
- **Constitution gates**: contract-first API changes, KB as truth, explicit scope values, simplicity over new transport/database mechanisms, and team notification for interface changes.
- **Design constraints**: dark financial table cards, unique accessible states, financial number presentation, full table columns with mobile horizontal scroll, and detail below tables on mobile from `kb/DESIGN.md`.
- **Glossary terms**: Leaderboard, Top-K, System Data, User-Private Data, userId (nullable), Authorization, Current Viewer, Live Updates Preference, Safe Invalidation, and Search Loop.
- **Related decisions**: ADR-0011 Leaderboard as Observer and ADR-0016 app-level `userId` filtering.
- **Related SDD baseline**: `sdd_artifacts/per-user-leaderboard-live-toggle/`, especially its viewer isolation, safe invalidation, provider cache, identity transition, and remaining T041-T042 release gates.
