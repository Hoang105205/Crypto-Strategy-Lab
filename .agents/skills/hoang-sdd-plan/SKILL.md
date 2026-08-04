---
name: hoang-sdd-plan
description: "hoang-sdd Plan — creates a technical implementation plan from a spec, grounded by KB context (constitution, architecture, modules, design). Produces plan.md, research.md, data-model.md, contracts/, and quickstart.md. Use after /hoang-sdd-specify completes."
allowed-tools: Read, Write, Bash(find *), Bash(ls *), Bash(mkdir *)
---

# hoang-sdd Plan

Create a technical implementation plan from a feature specification, grounded by project KB context.

## User Input

```
$ARGUMENTS
```

Optional: tech stack hints (e.g., "Use React + Express + PostgreSQL"). If empty, derive from `kb/ARCHITECTURE.md`.

## Pre-Execution

### 1. Locate Feature Directory

Read `sdd_artifacts/[feature-name]/.intent` if it exists to find the feature context.
Otherwise, list `sdd_artifacts/` and ask the user which feature to plan.

### 2. Load Required Artifacts

Read in order:
1. `kb/INDEX.md` → `kb/CONSTITUTION.md` → `kb/ARCHITECTURE.md` → `kb/MODULES.md` → `kb/modules/` (relevant module files) → `kb/flows/` (relevant E2E flows) → `kb/DESIGN.md` → `kb/GLOSSARY.md`
2. `agent_learn/INDEX.md` (if exists)
3. `sdd_artifacts/[feature-name]/spec.md` (REQUIRED — if missing, tell user to run `/hoang-sdd-specify` first)
4. `sdd_artifacts/[feature-name]/checklists/requirements.md`

If `spec.md` doesn't exist, **STOP** and tell the user to run `/hoang-sdd-specify` first.

### 3. Validate Spec Quality

Check `requirements.md` checklist. If more than 2 items are incomplete, warn the user and suggest running `/hoang-sdd-specify` again to fix before planning.

## Execution

### 4. Write plan.md

```markdown
# Implementation Plan: [FEATURE NAME]

**Feature**: `[feature-name]` | **Date**: [DATE] | **Spec**: spec.md

## Summary
[Extract from spec: primary requirement + technical approach from KB architecture]

## Technical Context
**Language/Version**: [from kb/ARCHITECTURE.md]
**Primary Dependencies**: [from kb/ARCHITECTURE.md]
**Storage**: [if applicable]
**Testing**: [from kb/CONSTITUTION.md or defaults]
**Target Platform**: [from kb/ARCHITECTURE.md]
**Project Type**: [web-app / library / API / mobile]
**Performance Goals**: [domain-specific]
**Constraints**: [from kb/CONSTITUTION.md]

## Constitution Check
*GATE: Must pass before Phase 0 research.*

| Principle | Status | Notes |
|-----------|--------|-------|
| [Constitution Art 1] | ✅ PASS / ⚠️ WARN / ❌ FAIL | [explanation] |
| [Constitution Art 2] | ✅ PASS / ⚠️ WARN / ❌ FAIL | [explanation] |

## Architecture Decision
[Based on kb/ARCHITECTURE.md, describe where this feature fits]

**Approach**: [chosen pattern — monolith addition / new module / new service / extension]
**Rationale**: [why this approach, referencing KB architecture decisions]
**Modules affected**: [from kb/MODULES.md + kb/modules/]
**E2E flows affected**: [from kb/flows/ — which business scenarios this feature touches]
**New modules needed**: [if any]

## Source Code Structure
[Map the feature to the src/ directory structure]

## Complexity Tracking
> Fill ONLY if Constitution Check has violations that must be justified

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., new DB] | [reason] | [why not sufficient] |
```

### 5. Phase 0: Research → research.md

Resolve all `NEEDS CLARIFICATION` markers and technology questions:

```markdown
# Research: [FEATURE NAME]

## Decisions

### D1: [Decision Title]
- **Chosen**: [option]
- **Rationale**: [why]
- **Alternatives considered**: [list]
- **KB reference**: [link to kb/ARCHITECTURE.md or kb/ADR/ if applicable]

### D2: [Next decision]
...
```

### 6. Phase 1: Design Artifacts

#### data-model.md
```markdown
# Data Model: [FEATURE NAME]

## Entity Relationship Diagram
[Text-based or Mermaid diagram]

## Entities

### [Entity1]
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | UUID | PK, auto-generated | |
| ... | ... | ... | |

## Indexes
- idx_[entity]_[field] ON [table]([field])

## Migration Notes
- [any migration considerations from existing data]
```

#### contracts/
Create one file per API/interface contract:

```markdown
# Contract: [Entity] API

## Endpoints

### POST /api/v1/[resource]
**Request**: [schema]
**Response**: [schema]
**Errors**: [error codes]

### GET /api/v1/[resource]/:id
**Response**: [schema]
**Errors**: [error codes]

## Events (if applicable)
### [EventName]
**Publisher**: [module]
**Payload**: [schema]
**Subscribers**: [module list]
```

#### quickstart.md
```markdown
# Quickstart: [FEATURE NAME]

## Prerequisites
- [list]

## Setup
[commands]

## Validation Scenarios
### Scenario 1: [Happy path]
1. [step]
2. [step]
3. ✅ Expected: [result]

### Scenario 2: [Edge case]
1. [step]
2. ✅ Expected: [result]
```

### 7. Re-check Constitution

After Phase 1 design, re-evaluate all constitution gates. If any FAIL, document the violation in plan.md Complexity Tracking and provide mitigation.

## Completion Report

Report:
- Feature directory
- Artifacts generated (plan.md, research.md, data-model.md, contracts/, quickstart.md)
- Constitution check result
- Recommended next step: `/hoang-sdd-tasks`

## Rules

- **Never skip KB loading** — all decisions must reference KB architecture and constitution.
- **No speculative technology** — if the KB doesn't mention a tech, justify WHY it's being introduced in research.md.
- **Keep contracts as the SSoT** — field names, types, and endpoints defined in contracts/ are the single source of truth for implementation.
- **Be concrete** — no "TBD" or "TODO" in plan.md; resolve everything in research.md.