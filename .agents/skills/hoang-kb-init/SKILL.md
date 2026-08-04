---
name: hoang-kb-init
description: "hoang-kb Init — initializes or expands the project knowledge base from a feature description. Takes a description like 'allow user to login' and creates multi-file KB structure covering architecture, modules, contracts, glossary, and more. Use when starting a new project or adding major business scope to the KB."
allowed-tools: Read, Write, Bash(find *), Bash(ls *), Bash(mkdir *)
---

# hoang-kb Init

Initialize or expand the project Knowledge Base from a feature/business description.

## User Input

```
$ARGUMENTS
```

**Required**: A description of the business scope or feature. Examples:
- "allow user to login"
- "e-commerce platform with product catalog, cart, and checkout"
- "task management app with boards, cards, and team collaboration"

## Execution

### Step 1: Analyze the Description

Extract from the input:
- **Domain**: What business domain is this? (e-commerce, social, fintech, etc.)
- **Actors**: Who are the users? (customer, admin, manager, etc.)
- **Core Entities**: What are the main data objects? (User, Product, Order, etc.)
- **Actions**: What do users do? (browse, purchase, manage, etc.)
- **Constraints**: Any specific requirements? (security, scale, compliance)
- **Tech hints**: Any technology mentioned? (if not, leave for plan phase)

### Step 2: Check Existing KB

If `kb/` directory exists:
- Read `kb/INDEX.md` to understand current KB state
- Ask: "KB already exists. Do you want to UPDATE it with new scope, or REINITIALIZE from scratch?"
- If UPDATE: Merge new scope into existing KB files
- If REINITIALIZE: Overwrite all KB files

### Step 3: Create KB Directory Structure

```
kb/
├── INDEX.md              # KB sitemap — always read first by all skills
├── CONSTITUTION.md       # Non-negotiable project principles
├── ARCHITECTURE.md       # High-level system architecture
├── DESIGN.md             # FE/UX design decisions and component library
├── MODULES.md            # Module boundaries and responsibilities (index)
├── GLOSSARY.md           # Domain terms and definitions
├── CONTRIBUTING.md       # Team conventions and coding standards
├── ADR/                  # Architecture Decision Records (WHY + HOW)
│   ├── 0001-record-architecture-decisions.md
│   └── template.md
├── contracts/            # Shared API/data contracts (SSoT)
├── modules/              # Per-module detailed architecture (WHAT)
│   ├── README.md         # Index of module architecture docs
│   └── {module-name}.md  # One file per module
├── flows/                # E2E business use case flows (cross-module)
│   ├── README.md         # Index of all business flows
│   └── {flow-name}.md    # One file per E2E flow
└── patterns/             # Design pattern catalog
```

### Step 4: Write Each KB File

#### INDEX.md — KB Sitemap

```markdown
# Knowledge Base Index

> **Last Updated**: [DATE]
> **Status**: Active / Draft

## Purpose
This KB is the single source of truth for the project's business scope,
architecture, design decisions, and conventions. All SDD skills read from
here before generating any artifacts or code.

## Quick Reference

| File | Purpose | Read When |
|------|---------|-----------|
| CONSTITUTION.md | Non-negotiable principles | Every skill execution |
| ARCHITECTURE.md | System architecture overview | Planning, implementing |
| DESIGN.md | FE/UX design and component library | FE implementation |
| MODULES.md | Module boundaries (index) | Planning, task decomposition |
| modules/ | Per-module detailed architecture | Planning, implementing, analyzing |
| flows/ | E2E business use case scenarios (cross-module) | Specifying, planning, implementing, analyzing |
| GLOSSARY.md | Domain terms | All skill executions |
| CONTRIBUTING.md | Coding standards | Implementation |
| ADR/ | Architecture Decision Records (WHY + HOW) | Planning, when referencing decisions |
| contracts/ | API/data contracts (SSoT) | Implementation, API work |
| patterns/ | Design pattern catalog | Planning, architecture decisions |

## Reading Order for Skills
1. INDEX.md (this file)
2. CONSTITUTION.md (always)
3. Then based on task:
   - Specifying → ARCHITECTURE.md, MODULES.md, modules/[relevant], flows/, GLOSSARY.md
   - Planning → ARCHITECTURE.md, MODULES.md, modules/[relevant], flows/, DESIGN.md, ADR/
   - Implementing → all of the above + CONTRIBUTING.md, contracts/, patterns/
   - Analyzing → all relevant files including modules/ and flows/ for cross-referencing

## Scope Coverage
- **Domain**: [domain from description]
- **Core Entities**: [list from analysis]
- **Modules**: [list from analysis]
- **Business Flows**: [list of E2E flows from analysis]
```

#### CONSTITUTION.md — Project Principles

```markdown
# [PROJECT_NAME] Constitution

## Core Principles

### I. Architecture-First
Every feature MUST fit within the defined architecture in ARCHITECTURE.md.
New modules require an ADR. No ad-hoc service creation.

### II. Contract-Driven
APIs and data interfaces are defined in contracts/ BEFORE implementation.
Field names, types, and endpoints in contracts/ are the Single Source of Truth.

### III. Test-First (When Constitutionally Required)
[Adjust based on project needs — for a university project, consider: ]
Core business logic MUST have unit tests. API endpoints SHOULD have contract tests.
Tests are written alongside or before implementation.

### IV. Simplicity Over Cleverness
Start with the simplest solution that works. No premature optimization.
No over-engineering for hypothetical future needs. YAGNI principle applies.

### V. Knowledge Base as Truth
When in doubt, the KB is authoritative. If code contradicts the KB, the KB wins
until explicitly updated via /hoang-kb-update.

### VI. Explicit Over Implicit
Prefer explicit code over magic. Prefer named constants over literals.
Prefer clear naming over comments.

## Constraints
- **Tech Stack**: [from ARCHITECTURE.md]
- **Scale**: [project-specific scale targets]
- **Security**: [project-specific security requirements]

## Governance
- Constitution supersedes all other practices
- Amendments require documentation in ADR/ and team approval
- Use GLOSSARY.md for consistent terminology

**Version**: 1.0 | **Ratified**: [DATE] | **Last Amended**: [DATE]
```

#### ARCHITECTURE.md — System Architecture

```markdown
# System Architecture

## Architecture Style
[Monolith / Modular Monolith / Microservices / Serverless]

> Rationale: [why this style, considering team size, project scope, timeline]

## High-Level Architecture Diagram
[Text-based diagram or Mermaid]

## Technology Stack
| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| Frontend | [tech] | [version] | [notes] |
| Backend | [tech] | [version] | [notes] |
| Database | [tech] | [version] | [notes] |
| Auth | [tech] | [version] | [notes] |
| Testing | [tech] | [version] | [notes] |
| Deployment | [tech] | [version] | [notes] |

## Source Code Structure
```
src/
├── frontend/          # Frontend application
│   ├── components/    # Reusable UI components
│   ├── pages/         # Page-level components
│   ├── services/      # API client services
│   ├── hooks/         # Custom React hooks (if React)
│   └── utils/         # Utility functions
├── backend/           # Backend application
│   ├── controllers/   # Request handlers
│   ├── services/      # Business logic
│   ├── models/        # Data models
│   ├── middleware/    # Middleware (auth, logging, etc.)
│   └── utils/         # Utility functions
└── shared/            # Shared types and constants
```

## Communication Patterns
- **Client → Server**: REST API (JSON)
- **Server → Server**: [if applicable]
- **Real-time**: [if applicable — WebSocket, SSE, etc.]

## Data Flow
[Describe the main data flow for the primary use case]

## Security Model
- **Authentication**: [method]
- **Authorization**: [model — RBAC, ABAC, etc.]
- **Data protection**: [encryption, sanitization, etc.]

## Deployment Topology
[How and where this gets deployed — local, cloud, containerized, etc.]
```

#### DESIGN.md — FE/UX Design

```markdown
# Frontend Design System

## Design Principles
1. [principle — e.g., "Mobile-first responsive design"]
2. [principle — e.g., "Consistent spacing using 4px grid"]
3. [principle — e.g., "Accessible by default (WCAG 2.1 AA)"]

## Component Library
| Component | Library | Custom? | Notes |
|-----------|---------|---------|-------|
| Button | [library] | No | Use default variant |
| Input | [library] | Partial | Custom validation styling |
| Card | [library] | No | - |
| Modal | [library] | Yes | Custom close behavior |
| Table | [library] | Yes | Sorting, pagination, filtering |

## Color Palette
| Name | Hex | Usage |
|------|-----|-------|
| Primary | #... | CTA buttons, links |
| Secondary | #... | Supporting elements |
| Success | #... | Success states |
| Warning | #... | Warning states |
| Error | #... | Error states |
| Background | #... | Page background |
| Surface | #... | Card/modal background |
| Text Primary | #... | Main text |
| Text Secondary | #... | Supporting text |

## Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| H1 | [font] | 24px | 700 |
| H2 | [font] | 20px | 600 |
| H3 | [font] | 16px | 600 |
| Body | [font] | 14px | 400 |
| Caption | [font] | 12px | 400 |

## Spacing System
4px base grid: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64

## Layout Patterns
- **Page layout**: [describe — sidebar + content, stacked, etc.]
- **Form layout**: [describe — stacked, grid, etc.]
- **List/Grid**: [describe — when to use each]

## Routing Structure
| Path | Page | Auth Required |
|------|------|--------------|
| / | Home | No |
| /login | Login | No |
| /dashboard | Dashboard | Yes |
| ... | ... | ... |
```

#### MODULES.md — Module Boundaries

```markdown
# Module Boundaries

## Module Overview

| Module | Responsibility | Layer | Depends On |
|--------|---------------|-------|------------|
| Auth | User authentication & authorization | Backend | User |
| User | User profile & management | Backend + Frontend | - |
| [Module3] | [responsibility] | [layer] | [deps] |

## Module Details

### Auth Module
- **Scope**: Login, logout, token management, role checking
- **Exposes**: AuthService (backend), AuthContext (frontend)
- **Dependencies**: User module (for user data)
- **Files**:
  - Backend: `src/backend/services/auth.*`, `src/backend/middleware/auth.*`
  - Frontend: `src/frontend/context/AuthContext.*`, `src/frontend/services/auth.*`
- **Contracts**: `contracts/auth.yaml`

### User Module
- **Scope**: CRUD operations on user profiles
- **Exposes**: UserService (backend), UserAPI (frontend)
- **Dependencies**: None
- **Files**:
  - Backend: `src/backend/models/user.*`, `src/backend/services/user.*`, `src/backend/controllers/user.*`
  - Frontend: `src/frontend/pages/Profile.*`, `src/frontend/services/user.*`
- **Contracts**: `contracts/user.yaml`

## Cross-Module Communication
- Auth → User: Auth checks user credentials
- [ModuleA] → [ModuleB]: [relationship description]

## Module Boundary Rules
1. Modules communicate through defined contracts only
2. No direct database access across module boundaries
3. Shared types go in `src/shared/`
4. Circular dependencies are forbidden
```

#### GLOSSARY.md — Domain Terms

```markdown
# Glossary

Domain-specific terms used across the project. Use these terms consistently
in code, documentation, and communication.

| Term | Definition | Used In |
|------|-----------|---------|
| [Term1] | [precise definition] | [modules/files] |
| [Term2] | [precise definition] | [modules/files] |

## Naming Conventions
- **API paths**: kebab-case (e.g., `/api/user-profile`)
- **Database tables**: snake_case (e.g., `user_profile`)
- **Code variables**: camelCase (e.g., `userProfile`)
- **Code constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRY_COUNT`)
- **React components**: PascalCase (e.g., `UserProfile`)
- **Files**: [convention — e.g., kebab-case for all files]
```

#### CONTRIBUTING.md — Team Conventions

```markdown
# Contributing Guide

## Git Workflow
- **Branch naming**: `[feature|fix|chore]/[ticket]-[short-description]`
- **Commit messages**: Conventional Commits format
  - `feat: add user login endpoint`
  - `fix: handle expired token gracefully`
  - `chore: update dependencies`
- **PR process**: [describe]

## Code Style
- **Frontend**: [linter + formatter config]
- **Backend**: [linter + formatter config]
- **Shared**: [API design guidelines]

## Review Checklist
- [ ] Code follows style guidelines
- [ ] No hardcoded secrets or credentials
- [ ] Error handling covers edge cases
- [ ] Logging is adequate but not verbose
- [ ] Contracts/ are updated if API changed
- [ ] GLOSSARY terms used consistently

## Testing Standards
- **Unit tests**: Required for business logic
- **Integration tests**: Required for API endpoints
- **E2E tests**: Optional, for critical user flows

## Documentation Standards
- Every API endpoint documented in contracts/
- Every ADR has a Decision, Rationale, and Consequences section
- GLOSSARY.md is the authority on terminology
```

#### ADR/0001-record-architecture-decisions.md

```markdown
# ADR-0001: Record Architecture Decisions

## Status
Accepted

## Context
We need to record the architectural decisions made on this project.

## Decision
We will use Architecture Decision Records (ADR) as described by Michael Nygard.

## Consequences
- Every significant architecture decision gets an ADR
- ADRs are immutable once accepted — create a new ADR to supersede
- ADRs live in `kb/ADR/`
- ADRs are numbered sequentially (0001, 0002, etc.)
```

#### ADR/template.md

```markdown
# ADR-{NNNN}: {Title}

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-XXXX]

## Context
[What is the issue motivating this decision?]

## Decision Drivers
- {driver 1}
- {driver 2}

## Considered Options
1. {option 1}
2. {option 2}

## Decision Outcome
Chosen option: "{option N}", because {justification}.

### Consequences
- Positive: ...
- Negative: ...
- Risks: ...

## Links
- [Relates to ADR-XXXX]
```

### Step 5: Create kb/modules/ — Per-Module Architecture Files

For each module identified in Step 1 analysis, create `kb/modules/{module-name}.md` using the template below. Also create `kb/modules/README.md` as an index.

**`kb/modules/README.md`**:
```markdown
# Module Architecture Index

This directory contains detailed architecture for each module. Each file is owned by the team member responsible for that module.

| Module | File | Owner | Status |
|--------|------|-------|--------|
| [Module Name] | `modules/{name}.md` | [owner] | Draft |

> ADRs (`kb/ADR/`) capture **why** decisions were made.
> Module files capture **what** the architecture looks like as a result.
```

**`kb/modules/{module-name}.md`** (one per module):
```markdown
# Module: [Module Name]

> **Owner**: [team member name]
> **Status**: Draft
> **Last Updated**: [DATE]

## 1. Overview
- **Responsibility**: [one sentence — what this module does]
- **Layer**: [Frontend | Backend | Shared]
- **Depends on**: [list of module names]
- **Depended by**: [list of module names]
- **Contracts**: `kb/contracts/{entity}.yaml`
- **Source files**: `src/...`
- **Related ADRs**: `kb/ADR/000X-...`

## 2. Component Architecture

### Components
| Component | Responsibility | Pattern | File(s) |
|-----------|---------------|---------|---------|
| [Component] | [what it does] | [pattern] | `src/...` |

### Component Diagram
[Text-based diagram showing internal structure — C4 Component level]

## 3. Design Patterns

### [Pattern Name] — [e.g., Strategy, Observer, Repository]
- **Where**: [which component uses it]
- **Why**: [rationale — link to ADR if applicable]
- **How**: [brief implementation description]
- **Trade-offs**: [what we gain, what we lose]

## 4. Internal Data Flow
[How data moves within the module — request lifecycle]

## 5. Sequence Diagrams

### [Use Case Name]
[Text-based sequence diagram]

## 6. Data Model
[Entities owned by this module]

| Entity | Fields | Relationships |
|--------|--------|---------------|

## 7. API Surface
[What this module exposes — link to `kb/contracts/`]

## 8. Quality Attributes
- **Security**: [concerns and mitigations]
- **Performance**: [concerns and mitigations]
- **Error handling**: [strategy — retry, fallback, etc.]

## 9. Testing Strategy
- **Unit tests**: [what to test]
- **Integration tests**: [what to test]

## 10. Open Questions / TODOs
- [ ] [unresolved items]
```

**Fill initial content**: For each module file, fill in:
- Section 1 (Overview) with the module's responsibility, layer, dependencies, and contract references (from Step 1 analysis)
- Sections 2-10 as placeholders marked `[TODO: fill during planning phase]`
- The `Owner` field left as `[unassigned]` for the team to fill

### Step 6: Create kb/flows/ — E2E Business Flow Files

For each E2E business use case identified in Step 1 analysis, create `kb/flows/{flow-name}.md` using the template below. Also create `kb/flows/README.md` as an index.

**`kb/flows/README.md`**:
```markdown
# Business Flows Index

This directory contains end-to-end business use case flows. Each file shows how multiple modules cooperate to fulfill a business scenario.

| Flow | File | Owner | Status | Modules |
|------|------|-------|--------|---------|
| [Flow Name] | `flows/{name}.md` | [owner] | Draft | [modules involved] |

> Module files (`kb/modules/`) capture **what's inside** each module.
> Flow files capture **how modules cooperate** end-to-end.
> ADRs (`kb/ADR/`) capture **why** decisions were made.
```

**`kb/flows/{flow-name}.md`** (one per E2E flow):
```markdown
# Business Flow: [Flow Name]

> **Owner**: [team member name]
> **Status**: Draft
> **Last Updated**: [DATE]

## 1. Overview
- **Description**: [one-sentence summary of this flow]
- **Primary Actor**: [who/what triggers this flow]
- **Business Value**: [why this flow exists]
- **Modules Involved**: [list all modules touched by this flow]

## 2. Preconditions
- [what must be true before this flow starts]

## 3. Flow Steps
1. [Step description] — [Module X] → [Module Y] via [contract/API]
2. [Step description] — [Module Y] → [Module Z] via [contract/API]
3. [Step description] — [Module Z] → [external system] via [integration]

## 4. Postconditions
- [what must be true after this flow completes successfully]

## 5. Alternative Paths
### [Path Name]
- [variation of the main flow and when it triggers]

## 6. Error & Exception Flows
### [Error Scenario]
- [what goes wrong, which module detects it, how it's handled]

## 7. Business Rules
- **BR-1**: [rule that governs this flow]
- **BR-2**: [another rule]

## 8. Related
- **Contracts**: `kb/contracts/{entity}.yaml`
- **ADRs**: `kb/ADR/000X-...`
- **Module files**: `kb/modules/{name}.md`
```

**Fill initial content**: For each flow file, fill in:
- Section 1 (Overview) with the flow's description, primary actor, modules involved (from Step 1 analysis)
- Section 3 (Flow Steps) with a high-level step outline (from Step 1 actions analysis)
- Sections 2, 4-8 as placeholders marked `[TODO: fill during planning phase]`
- The `Owner` field left as `[unassigned]` for the team to fill

### Step 7: Create contracts/ and patterns/ directories

Create placeholder files if the description implies specific entities:

```
kb/contracts/{entity}.yaml   — One per core entity
kb/patterns/README.md        — Empty pattern catalog for future use
```

### Step 8: Initialize agent_learn/

```
agent_learn/
├── INDEX.md              # Catalog of all lessons (starts empty)
└── lessons/              # Directory for lesson files (starts empty)
```

`agent_learn/INDEX.md`:
```markdown
# Agent Learn Index

This directory stores what the agent has learned during SDD workflow execution.
It is for agent read-only reference — do not modify manually unless you are updating lessons.

## Lessons
*(No lessons recorded yet — lessons are added by /hoang-sdd-implement)*
```

### Step 9: Initialize sdd_artifacts/

```
sdd_artifacts/
└── .gitkeep
```

## Completion Report

Report:
- KB files created (list with paths)
- Core entities identified
- Modules identified
- Suggested next steps:
  1. Review and customize `kb/CONSTITUTION.md` principles
  2. Review and adjust `kb/ARCHITECTURE.md` tech stack
  3. Fill `kb/DESIGN.md` with your design system choices
  4. Assign module owners and fill `kb/modules/{name}.md` with component architecture, patterns, and flows
  5. Assign flow owners and fill `kb/flows/{name}.md` with step-by-step scenarios, business rules, and alternative paths
  6. Run `/hoang-sdd-on [feature description]` to start your first SDD workflow