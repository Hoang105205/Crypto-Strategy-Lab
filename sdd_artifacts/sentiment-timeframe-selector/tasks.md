# Tasks: Aggregate Mood Score Timeframe Selector

**Input**: Design documents from `sdd_artifacts/sentiment-timeframe-selector/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/sentiment-api.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, etc.)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Verify environment and KB contract synchronization

- [x] T001 Verify project KB contract definitions in `kb/contracts/news.yaml` and `sdd_artifacts/sentiment-timeframe-selector/contracts/sentiment-api.md`
- [x] T002 [P] Verify monorepo dependencies and shared types in `workspace/libs/shared/src/types/news.types.ts`

---

## Phase 2: Foundation

**Purpose**: Core infrastructure that MUST complete before User Stories start

- [x] T003 [Foundation] Ensure backend endpoint `GET /api/sentiment/aggregate` in `workspace/apps/backend/src/news/news.controller.ts` accepts `timeframe` query param with default `'24h'` (`'1h'` | `'24h'` | `'7d'`)

---

## Phase 3: User Story 1 - Aggregate Mood Timeframe Selection (Priority: P1) 🎯 MVP

**Goal**: Support selecting timeframe (`1h`, `24h`, `7d`) on Aggregate Mood Card in `NewsFeed.tsx`
**Independent Test**: Click `1h`, `24h`, `7d` buttons on News Feed Header and verify `GET /api/sentiment/aggregate?timeframe=...` API call and UI badge updates.

### Implementation for User Story 1

- [x] T004 [US1] Add `selectedTimeframe` state (`'1h' | '24h' | '7d'`, default `'24h'`) in `workspace/apps/frontend/src/components/news/NewsFeed.tsx`
- [x] T005 [US1] Update API fetch call in `workspace/apps/frontend/src/components/news/NewsFeed.tsx` to include `timeframe=${selectedTimeframe}` query parameter
- [x] T006 [US1] Render Timeframe Selector pill buttons (`1h`, `24h`, `7d`) with active/hover styling inside Aggregate Mood Header Card in `workspace/apps/frontend/src/components/news/NewsFeed.tsx`
- [x] T007 [US1] Update Aggregate Mood Header label to display active coin and timeframe (e.g. `Aggregate Mood (${activeCoin} · ${selectedTimeframe})`)

---

## Phase 4: Polish & Validation

**Purpose**: End-to-end verification and quality checks

- [x] T008 Run TypeScript compilation check `npx tsc --noEmit` across backend and frontend
- [x] T009 Run quickstart validation scenarios from `sdd_artifacts/sentiment-timeframe-selector/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Setup (Phase 1)**: Start immediately
- **Foundation (Phase 2)**: Depends on Setup
- **User Story 1 (Phase 3)**: Depends on Foundation completion
- **Polish (Phase 4)**: Depends on User Story 1 completion
