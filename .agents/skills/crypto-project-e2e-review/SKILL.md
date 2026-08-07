---
name: crypto-project-e2e-review
description: "Reviews team members' KB and implementation deliverables for the Crypto Strategy Lab project against the approved plan and requirement spec. Scans plan-overview.md, the requirement doc, kb/, sdd_artifacts/, and source code to audit each member's assigned tasks — completeness, quality, cross-references, and requirement coverage. Use when reviewing weekly progress, auditing KB before architecture review day, checking implementation quality, or preparing for course demo."
allowed-tools: Read, Grep, Glob, Bash(git *), Bash(ls *), Bash(find *), Bash(wc *)
---

# Crypto Strategy Lab — E2E Project Review

Architect-only review tool. Audits team members' deliverables (KB files, contracts, ADRs, source code) against their assignments in `plans/plan-overview.md` and the requirement spec. Produces a per-member findings report plus cross-member consistency checks.

## User Input

```
$ARGUMENTS
```

Optional mode filter:
- *(empty)* = full review (KB + code)
- `kb` = KB-only review (W1 focus)
- `code` = implementation-only review (W2+)
- `week:N` = review only Week N deliverables (e.g. `week:1`)

## Phase 1: Load Project Context

Read in order — skip any that don't exist yet:

1. `plans/plan-overview.md` — approved plan: Section 3 (KB Ownership), Section 4 (Team Assignment), Section 5 (Weekly Plan), Section 6 (Source Code Structure), Section 7 (ADRs), Section 8 (Extensibility)
2. `plans/Crypto_Strategy_Lab_Requirement.md` — requirement spec: Sections 1-47 (MVP in §37, anti-patterns in §44, extensibility in §41-43, central questions in §40)
3. `kb/INDEX.md` → `kb/CONSTITUTION.md` → `kb/ARCHITECTURE.md` → `kb/MODULES.md` → `kb/GLOSSARY.md`
4. `kb/modules/README.md` + all `kb/modules/*.md` (excluding README)
5. `kb/flows/README.md` + all `kb/flows/*.md` (excluding README)
6. `kb/contracts/*.yaml` (all files)
7. `kb/ADR/*.md` (all, excluding template.md)
8. `kb/patterns/README.md`
9. `sdd_artifacts/` — scan directory tree for feature artifacts
10. `agent_learn/INDEX.md` + `agent_learn/lessons/` — check for recorded lessons
11. Source code: `apps/` directory tree (if exists)
12. Git log: `git log --oneline --all -50` to see recent commits per member

## Phase 2: Build Member Assignment Map

From `plan-overview.md` Section 4 (Team Assignment) and Section 3 (KB Ownership), build:

| Member | Module | KB Files | Contracts | ADRs | Flows | Source Dirs |
|--------|--------|----------|-----------|------|-------|-------------|

**Discover real names**: Read the `Owner:` field in each KB file. The plan uses placeholders (Member B/C/D); map them to real names when the KB files reveal them (e.g. `news.yaml` → `Owner: Thuận`). If a file still has a placeholder owner, note it as `[unassigned]`.

**Extract weekly schedule**: From Section 5, determine what each member should have completed by the current week. Only flag missing items as issues if they were due by the review date.

## Phase 3: KB Review Checks

For each member, run these checks against their owned KB files:

### 3a. File Existence
- [ ] All KB files assigned to this member in the plan actually exist
- [ ] No assigned file is empty or only contains the initial template skeleton
- [ ] Owner field in each file matches the member (or is still `[unassigned]`)

### 3b. Template Adherence
- [ ] Module files (`kb/modules/{name}.md`) follow the 10-section template: Overview → Component Architecture → Design Patterns → Internal Data Flow → Sequence Diagrams → Data Model → API Surface → Quality Attributes → Testing Strategy → Open Questions
- [ ] Flow files (`kb/flows/{name}.md`) follow the 8-section template: Overview → Preconditions → Flow Steps → Postconditions → Alternative Paths → Error & Exception Flows → Business Rules → Related
- [ ] Contract files (`.yaml`) have: entities (with typed fields), interfaces (with method signatures), endpoints (method + path + response), events (publisher + subscribers + payload)
- [ ] ADRs have: Status, Context, Decision (or Decision Drivers + Considered Options + Decision Outcome), Consequences

### 3c. Content Completeness
- [ ] No remaining `[TODO]` markers in sections due for the current week
- [ ] Module Section 1 (Overview) is fully filled: responsibility, layer, dependencies, contracts, source files, related ADRs
- [ ] Module Section 2 (Components) lists actual component names with patterns
- [ ] Module Section 3 (Design Patterns) has at least 2 patterns with Where/Why/How
- [ ] Flow Section 3 (Flow Steps) lists concrete steps with `Module X → Module Y via [channel]`
- [ ] Flow Sections 2, 4, 5, 6, 7 are filled (not just `[TODO]`)
- [ ] Contract files define actual field names and types (not empty `{}` or `[]`)
- [ ] ADRs have a real decision and rationale (not placeholder text)

### 3d. Contract Quality
- [ ] All entities have typed fields (e.g. `id: string (uuid)`, not just comments)
- [ ] All interfaces list methods with TypeScript signatures
- [ ] All endpoints specify method, path, queryParams (if any), and response shape
- [ ] Event contracts list publisher, subscribers, and payload structure
- [ ] Internal service calls (e.g. NestJS → Python) are documented with request/response

### 3e. Cross-Reference Integrity
- [ ] Module files reference contracts that actually exist in `kb/contracts/`
- [ ] Module files reference ADRs that actually exist in `kb/ADR/`
- [ ] Flow files reference modules, contracts, and ADRs that exist
- [ ] ADRs link to related ADRs that exist
- [ ] No broken `kb/...` path references (check actual file paths, not just names)
- [ ] File naming is consistent (plan says `.contract.md` but KB uses `.yaml` — flag mismatch)

### 3f. Plan Alignment
- [ ] Module file's components match the plan's component table (Section 4.3) for that member
- [ ] Module file's design patterns match the plan's "Interview Architecture Focus" (Section 4.2) for that member
- [ ] Contract entities match the data groups in the requirement spec (Section 35) and plan
- [ ] Flow files match the plan's event flow description (Section 4.4)
- [ ] ADR topics match the plan's ADR list (Section 7) for that member

### 3g. Requirement Coverage
- [ ] The member's module KB covers all relevant requirement sections:
  - Market Data (Hoàng): §4-5 (Market Data, Multi-Timeframe Chart), §32.3 (Realtime), §32.4 (Reliability)
  - Strategy Engine (Member B): §6-15 (Strategies, Plugin, Composite, Search), §19-20 (Backtesting, Evaluation), §32.1 (Modifiability), §32.6 (Maintainability)
  - News & Sentiment (Member C): §27-30 (News, Sentiment, Sentiment as Strategy), §32.4 (Reliability — service down)
  - Event Infrastructure (Phương): §21-24 (Leaderboard, Loop), §32.2 (Scalability), §32.5 (Performance), §32.7 (Observability), §34 (Events)
- [ ] MVP requirements (§37) for this module are addressed
- [ ] Anti-patterns (§44) are not present in the member's design

## Phase 4: Implementation Review Checks (W2+)

Skip if mode = `kb` or no `apps/` source code exists yet.

### 4a. Code Existence
- [ ] All source files listed in plan Section 6 for this member exist
- [ ] Directory structure matches the plan's source tree
- [ ] NestJS module files (`*.module.ts`) exist for each assigned module

### 4b. Contract Compliance
- [ ] API endpoints in code match `kb/contracts/*.yaml`
- [ ] Interface implementations match contract method signatures
- [ ] Entity fields in Prisma schema match contract entity definitions
- [ ] No undocumented endpoints (endpoints in code but not in contracts)

### 4c. Pattern Implementation
- [ ] Adapter Pattern: interface + at least 1 concrete adapter exist (Market Data, News)
- [ ] Plugin Registry: `register()` method exists and is called for each strategy
- [ ] Composite Pattern: combiner classes exist (MajorityVote, WeightedScore)
- [ ] Observer Pattern: event subscription in Leaderboard
- [ ] Job Queue: enqueue/dequeue/worker exist with retry + dead-letter
- [ ] No `if/else if` strategy dispatch (anti-pattern §44)

### 4d. Module Boundary Compliance
- [ ] No cross-module direct imports (e.g. `strategy/` importing from `news/`)
- [ ] Communication only through shared interfaces and events
- [ ] No direct database access across module boundaries
- [ ] Shared types go in `libs/shared/` not duplicated locally

### 4e. Error Handling
- [ ] Error flows documented in `kb/flows/` are implemented in code
- [ ] External API failures have retry/reconnect logic
- [ ] Service-down scenarios have graceful degradation (e.g. SentimentStrategy returns HOLD)
- [ ] Job failures go to dead-letter queue after max retries

### 4f. Extensibility Verification (W4)
- [ ] Each extensibility scenario (plan Section 8, 10 scenarios) is demonstrable
- [ ] Adding a new strategy requires only 1 file + 1 `register()` call
- [ ] Swapping queue backend is a config change (same `IJobQueue` interface)
- [ ] Adding a new data provider is 1 adapter class

## Phase 5: Cross-Member Consistency

Check alignment between members' work:

### 5a. Contract Alignment
- [ ] Events published by one member's contract appear in another member's contract as subscribed
- [ ] Shared interface signatures are identical across contracts (no drift)
- [ ] Entity field names are consistent across contracts (e.g. `strategyId` not `strategy_id` in one and `strategyId` in another)

### 5b. Flow ↔ Module Alignment
- [ ] Modules listed in flow files match MODULES.md boundaries
- [ ] Flow steps reference modules by their correct names from MODULES.md
- [ ] Flow steps match the event flow in plan Section 4.4

### 5c. ADR Cross-References
- [ ] Co-authored ADRs (e.g. ADR-0003 Hoàng + Member B, ADR-0005 Hoàng + Phương) are consistent
- [ ] No ADR contradicts another member's ADR
- [ ] ADR numbering is sequential with no gaps

### 5d. Requirement Coverage Gaps
- [ ] All MVP requirements (§37) are covered by at least one member's KB/code
- [ ] All central architecture questions (§40, 8 questions) are answerable from the KB
- [ ] All extensibility scenarios (§41-43) are addressed in the plan + KB

## Phase 6: Report

Write the review report to `reviews/review-[YYYY-MM-DD].md`:

```markdown
# E2E Project Review — [DATE]

**Reviewer**: Hoàng (Architect)
**Mode**: [KB-only | Full | Week N]
**Overall Health**: 🟢 Healthy / 🟡 Needs Attention / 🔴 Critical Issues

## Per-Member Summary

| Member | Module | Files Assigned | Complete | Partial | Missing | Health |
|--------|--------|---------------|----------|---------|---------|--------|
| [name] | [module] | N | N | N | N | 🟢/🟡/🔴 |

## Member Details

### [Member Name] — [Module Name]

**Assigned deliverables** (from plan):
- KB files: [list]
- Contracts: [list]
- ADRs: [list]
- Flows: [list]

**Status**: [Complete / In Progress / Not Started]

#### Findings

##### [CRITICAL] [F-001]: [Title]
**File**: `kb/...`
**Check**: [3a-3g or 4a-4f]
**Issue**: [what's wrong]
**Impact**: [what breaks if unfixed]
**Action**: [specific fix needed, addressed to the member]

##### [HIGH/MEDIUM/LOW] [F-00X]: [Title]
[Same structure]

**Member verdict**: [Pass / Pass with notes / Needs revision / Not started]

## Cross-Member Issues

### [Issue Title]
**Members involved**: [list]
**Issue**: [description]
**Action**: [what needs to happen]

## Requirement Coverage Gaps

| Requirement Section | Expected Owner | Status | Gap |
|---------------------|---------------|--------|-----|

## Recommended Actions (Priority Order)
1. [most critical — who needs to do what by when]
2. [next]
3. [etc.]
```

## Rules

- **Architect-only**: This skill is for Hoàng's review use only. It does not modify any project files except creating the review report in `reviews/`.
- **Read-only**: Never modify KB, contracts, ADRs, or source code. Only write the review report.
- **Evidence-based**: Every finding must cite a specific file and section/line.
- **Per-member organization**: Findings are grouped by member, not by file type. Each finding is addressed to the member who owns the file.
- **No false positives**: Only report issues verifiable by reading actual files. Don't speculate.
- **Week-aware**: Only flag missing items as issues if they were due by the current week per the plan schedule. Note future-due items as "upcoming" not "missing".
- **Practical severity**:
  - CRITICAL = breaks module boundaries, violates constitution, or prevents integration
  - HIGH = missing required deliverable that was due, or contract/code mismatch
  - MEDIUM = incomplete sections, missing cross-references, quality issues
  - LOW = style, naming, or nice-to-have improvements
- **Hoàng's own tasks**: If Hoàng's own KB files are incomplete, note them but do not block the review on them (the user reviews their own work separately).
