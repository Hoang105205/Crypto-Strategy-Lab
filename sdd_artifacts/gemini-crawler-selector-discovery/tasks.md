# Tasks: Gemini LLM Web Crawler Selector Discovery & Self-Healing

**Input**: Design documents from `sdd_artifacts/gemini-crawler-selector-discovery/`  
**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/gemini-discovery.md`

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no blocking dependencies)
- **[Story]**: Which user story this task belongs to (`US1`, `US2`, `US3`)

---

## Phase 1: Setup & Shared Contracts

**Purpose**: Shared types, interfaces, and constants in `@crypto-strategy-lab/shared`

- [X] T001 [P] [US1] Define `DiscoveredRule` and `GeminiDiscoveryConfig` interfaces in `workspace/libs/shared/src/types/news.ts`
- [X] T002 [P] [US1] Add constants `DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash'` and `GEMINI_DISCOVERY_TIMEOUT_MS = 10_000` in `workspace/libs/shared/src/constants/news.constants.ts`

---

## Phase 2: Gemini Discovery Client (US1) 🎯 MVP

**Purpose**: Implement dedicated Google Gemini REST AI Client with structured JSON parsing and SLA timeout

- [X] T003 [US1] Create `GeminiDiscoveryClient` in `workspace/apps/backend/src/news/services/gemini-discovery.client.ts` with HTML sanitization, structured prompt, 10s `AbortController` timeout, and direct REST API call
- [X] T004 [P] [US1] Register `GeminiDiscoveryClient` in `workspace/apps/backend/src/news/news.module.ts` providers and exports
- [X] T005 [P] [US1] Create unit test suite `workspace/apps/backend/src/news/services/gemini-discovery.client.spec.ts` covering success, timeout, and structured JSON parsing

---

## Phase 3: Service Integration & Graceful Fallback (US2, US3)

**Purpose**: Integrate Gemini into `CrawlerDiscoveryService` with automatic Cheerio heuristic fallback

- [X] T006 [US2/US3] Update `CrawlerDiscoveryService` in `workspace/apps/backend/src/news/services/crawler-discovery.service.ts` to inject `GeminiDiscoveryClient`, attempt LLM discovery first, and gracefully fallback to Cheerio heuristics on failure
- [X] T007 [P] [US3] Update unit test suite in `workspace/apps/backend/src/news/services/crawler-discovery.service.spec.ts` verifying Gemini integration, DB upsert, and Cheerio fallback behavior

---

## Phase 4: Polish, Testing & Verification

**Purpose**: Full workspace build check, test suite execution, and Quickstart scenario validation

- [X] T008 [P] Execute Jest unit test suite across `apps/backend/src/news` and run backend build check (`npm run build --workspace=@crypto-strategy-lab/backend`)
- [X] T009 Run build check and validate all 4 Quickstart scenarios from `sdd_artifacts/gemini-crawler-selector-discovery/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies
- **Phase 1 (Setup)**: No dependencies — start immediately (T001, T002 in parallel).
- **Phase 2 (Gemini Client)**: Depends on Phase 1 completion (T003, T004, T005).
- **Phase 3 (Service Integration)**: Depends on Phase 2 completion (T006, T007).
- **Phase 4 (Polish & Testing)**: Depends on Phase 3 completion (T008, T009).

### Parallel Opportunities
- T001 and T002 can execute concurrently.
- T004 and T005 can execute concurrently once T003 is drafted.
- T007 can execute in parallel with T006.

---

## Implementation Strategy

### MVP Milestone
1. Complete Phase 1 (Shared Types & Constants)
2. Complete Phase 2 (Gemini Discovery Client & Module Registration)
3. Complete Phase 3 (CrawlerDiscoveryService Integration & Fallback)
4. Execute Phase 4 (Build Verification & Quickstart validation)
