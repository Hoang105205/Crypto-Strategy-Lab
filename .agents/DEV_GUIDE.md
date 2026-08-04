# hoang-sdd-kit — Developer Guide

> **Version**: 1.0  
> **Author**: Hoang Luu   
> **Last Updated**: 2026-08-04

---

## Table of Contents

1. [What is hoang-sdd-kit?](#1-what-is-hoang-sdd-kit)
2. [Repository Structure](#2-repository-structure)
3. [The SDD Workflow](#3-the-sdd-workflow)
4. [Knowledge Base (kb/)](#4-knowledge-base-kb)
5. [SDD Artifacts (sdd_artifacts/)](#5-sdd-artifacts-sdd_artifacts)
6. [Agent Learn (agent_learn/)](#6-agent-learn-agent_learn)
7. [Skill Reference](#7-skill-reference)
8. [Step-by-Step: Start a New Project](#8-step-by-step-start-a-new-project)
9. [Step-by-Step: Add a New Feature](#9-step-by-step-add-a-new-feature)
10. [Architecture Decisions Behind This Kit](#10-architecture-decisions-behind-this-kit)
11. [Team Conventions](#11-team-conventions)
12. [FAQ](#12-faq)

---

## 1. What is hoang-sdd-kit?

**hoang-sdd-kit** is a Spec-Driven Development (SDD) toolkit, created by Hoang Luu
- **A structured Knowledge Base** (`kb/`) that serves as the single source of truth for your project's business scope, architecture, and design decisions.
- **A set of skills** (in `.agents/`) that guide the SDD workflow from specification through implementation.
- **An artifact system** (`sdd_artifacts/`) that organizes per-feature specifications, plans, tasks, and analysis reports.
- **An agent learning system** (`agent_learn/`) that captures and reuses lessons across features.

### Why SDD?

Traditional development goes: idea → code → (maybe) docs. SDD inverts this: **specifications drive implementation**. You define what you're building before you build it, and the spec becomes the source of truth. Code serves the spec, not the other way around.

### How is this different from spec-kit?

| Aspect | spec-kit (GitHub) | hoang-sdd-kit |
|--------|-------------------|---------------|
| Scale | Production-grade, 30+ agent integrations | University project focus |
| KB | Minimal (constitution only) | Deep KB with architecture, modules, contracts, glossary |
| Workflow engine | YAML pipelines with gates | Lightweight skill-based flow |
| CLI | Python CLI (`specify`) | Agent skills (no install) |
| Extensions | Full extension/hook system | Simple, no extensions needed |
| Agent learning | None | `agent_learn/` captures lessons |
| DESIGN.md | Not included | First-class KB citizen for FE |

---

## 2. Repository Structure

```
project-root/
├── .agents/                                    # hoang-sdd-kit root
│   ├── skills/                                 # All SDD skills live here
│   │   ├── hoang-sdd-on/                       # 🧠 Orchestrator
│   │   │   └── SKILL.md
│   │   ├── hoang-sdd-specify/                  # 📝 Feature specification
│   │   │   └── SKILL.md
│   │   ├── hoang-sdd-plan/                     # 📐 Technical plan
│   │   │   └── SKILL.md
│   │   ├── hoang-sdd-tasks/                    # ✅ Task decomposition
│   │   │   └── SKILL.md
│   │   ├── hoang-sdd-implement/                # 🔨 Implementation
│   │   │   └── SKILL.md
│   │   ├── hoang-sdd-analyze/                  # 🔍 Cross-artifact analysis
│   │   │   └── SKILL.md
│   │   ├── hoang-sdd-converge/                 # 🎯 Gap analysis & remediation
│   │   │   └── SKILL.md
│   │   ├── hoang-sdd-status/                   # 📊 Dashboard
│   │   │   └── SKILL.md
│   │   ├── hoang-kb-init/                      # 🏗️ KB initialization
│   │   │   └── SKILL.md
│   │   ├── hoang-kb-explain/                   # 💡 KB explanation
│   │   │   └── SKILL.md
│   │   └── hoang-kb-update/                    # 🔄 KB updates
│   │       └── SKILL.md
│   └── DEV_GUIDE.md                            # 📖 This guide
│
├── kb/                                  # Knowledge Base (single source of truth)
│   ├── INDEX.md                         # KB sitemap — always read first
│   ├── CONSTITUTION.md                  # Non-negotiable project principles
│   ├── ARCHITECTURE.md                  # High-level system architecture
│   ├── DESIGN.md                        # FE/UX design decisions & component library
│   ├── MODULES.md                       # Module boundaries & responsibilities
│   ├── GLOSSARY.md                      # Domain terms & definitions
│   ├── CONTRIBUTING.md                  # Team conventions & coding standards
│   ├── ADR/                             # Architecture Decision Records (WHY + HOW)
│   │   ├── 0001-record-architecture-decisions.md
│   │   ├── template.md
│   │   └── ...                          # Future ADRs
│   ├── contracts/                       # Shared API/data contracts (SSoT)
│   │   └── {entity}.yaml                # One contract per core entity
│   ├── modules/                         # Per-module detailed architecture
│   │   ├── README.md                    # Index of module architecture docs
│   │   └── {module-name}.md             # One file per module (components, patterns, flows)
│   ├── flows/                           # E2E business use case flows
│   │   ├── README.md                    # Index of all business flows
│   │   └── {flow-name}.md               # One file per E2E flow (cross-module scenarios)
│   └── patterns/                        # Design pattern catalog
│       └── README.md
│
├── sdd_artifacts/                       # Per-feature SDD artifacts
│   ├── {feature-name}/                  # One directory per feature
│   │   ├── spec.md                      # Feature specification (from /hoang-sdd-specify)
│   │   ├── plan.md                      # Implementation plan (from /hoang-sdd-plan)
│   │   ├── research.md                  # Research findings (from /hoang-sdd-plan)
│   │   ├── data-model.md               # Entity definitions (from /hoang-sdd-plan)
│   │   ├── quickstart.md               # Validation scenarios (from /hoang-sdd-plan)
│   │   ├── contracts/                   # Feature-specific API contracts
│   │   ├── tasks.md                     # Executable task list (from /hoang-sdd-tasks)
│   │   ├── checklists/                  # Quality checklists
│   │   │   └── requirements.md
│   │   ├── analysis-report.md           # Cross-artifact analysis (from /hoang-sdd-analyze)
│   │   ├── convergence-report.md        # Gap analysis (from /hoang-sdd-converge)
│   │   └── .intent                      # Workflow intent tracker (YAML)
│   └── .gitkeep
│
├── src/                                 # Source code
│   ├── frontend/                        # Frontend application
│   │   ├── components/                  # Reusable UI components
│   │   ├── pages/                       # Page-level components
│   │   ├── services/                    # API client services
│   │   ├── hooks/                       # Custom React hooks (if React)
│   │   └── utils/                       # Utility functions
│   ├── backend/                         # Backend application
│   │   ├── controllers/                 # Request handlers
│   │   ├── services/                    # Business logic
│   │   ├── models/                      # Data models
│   │   ├── middleware/                   # Auth, logging, etc.
│   │   └── utils/                       # Utility functions
│   └── shared/                          # Shared types and constants
│
├── agent_learn/                         # Agent learning (read-only for agent)
│   ├── INDEX.md                         # Catalog of all lessons
│   └── lessons/                         # Per-feature lesson files
│       └── {feature-name}-{date}.md
│
└── README.md                            # Project overview
```

---

## 3. The SDD Workflow

The SDD workflow in hoang-sdd-kit follows a disciplined phase sequence:

```
┌──────────────┐
│  /hoang-sdd-on │  ← Orchestrator: analyzes feature, proposes workflow
└──────┬───────┘
       │
       ▼
┌───────────────────┐
│ /hoang-sdd-specify  │  ← Phase 1: Define WHAT and WHY (spec.md)
└──────┬────────────┘
       │
       ▼
┌───────────────────┐
│  /hoang-sdd-plan    │  ← Phase 2: Define HOW (plan.md, research.md, data-model.md, contracts/)
└──────┬────────────┘
       │
       ▼
┌───────────────────┐
│  /hoang-sdd-tasks   │  ← Phase 3: Break into executable tasks (tasks.md)
└──────┬────────────┘
       │
       ▼
┌────────────────────┐
│ /hoang-sdd-implement │  ← Phase 4: Implement tasks, write code (src/)
└──────┬─────────────┘
       │
       ▼
┌───────────────────┐
│ /hoang-sdd-analyze  │  ← Phase 5: Cross-artifact consistency check (analysis-report.md)
└──────┬────────────┘
       │
       ▼
┌───────────────────┐
│ /hoang-sdd-converge │  ← Phase 6: Close gaps between spec and code (convergence tasks)
└───────────────────┘
```

### Key Principles

1. **KB first**: Every skill reads the KB before doing anything. The KB is the source of truth.
2. **No skipping phases**: You can't plan without a spec, can't implement without a plan.
3. **Artifacts are immutable intent**: `spec.md` defines what was intended. Code is the expression. If they drift, converge.
4. **Constitution is law**: The constitution in `kb/CONSTITUTION.md` is non-negotiable. If code violates it, that's a bug.

### Also available at any time:

- **/hoang-sdd-status**: Dashboard showing all features, their phase progress, and KB health.
- **/hoang-kb-init**: Initialize or reinitialize the KB.
- **/hoang-kb-explain**: Explain any part of the KB in plain language.
- **/hoang-kb-update**: Update KB files while maintaining cross-reference consistency.

---

## 4. Knowledge Base (kb/)

The KB is the **single source of truth** for your project. It's not documentation that rots — it's living context that every SDD skill reads before acting.

### KB Files

| File | Purpose | When to Read |
|------|---------|--------------|
| `INDEX.md` | Sitemap and reading order | Every skill execution (first file) |
| `CONSTITUTION.md` | Non-negotiable principles | Every skill execution |
| `ARCHITECTURE.md` | System architecture, tech stack, data flow | Planning, implementing |
| `DESIGN.md` | FE/UX design system, component library, routing | FE implementation |
| `MODULES.md` | Module boundaries, responsibilities, dependencies (index) | Planning, task decomposition |
| `modules/` | Per-module detailed architecture (components, patterns, flows) | Planning, implementing, analyzing |
| `flows/` | E2E business use case scenarios (cross-module) | Specifying, planning, implementing, analyzing |
| `GLOSSARY.md` | Domain terms and naming conventions | All skill executions |
| `CONTRIBUTING.md` | Git workflow, code style, review checklist | Implementation |
| `ADR/` | Architecture Decision Records (WHY + HOW) | Planning, when referencing decisions |
| `contracts/` | API/data contracts (SSoT for field names, types) | Implementation, API work |
| `patterns/` | Design pattern catalog | Planning, architecture decisions |

### How Skills Read the KB

Skills follow a **progressive disclosure** pattern:

1. **Always read**: `INDEX.md`, `CONSTITUTION.md`
2. **Read based on task**:
   - Specifying → `ARCHITECTURE.md`, `MODULES.md`, `modules/[feature's modules]`, `flows/`, `GLOSSARY.md`
   - Planning → `ARCHITECTURE.md`, `MODULES.md`, `modules/[feature's modules]`, `flows/`, `DESIGN.md`, `ADR/`
   - Implementing → all of the above + `CONTRIBUTING.md`, `contracts/`, `patterns/`
   - Analyzing → all relevant files including `modules/` and `flows/` for cross-referencing

This means the KB files are **never loaded all at once** — only what's needed for the current task.

### Per-Module Architecture (`kb/modules/`)

Each module gets its own architecture file at `kb/modules/{module-name}.md`. This is where the **detailed internal architecture** lives — components, design patterns, data flows, and sequence diagrams. It works **parallel with ADRs**:

| Document | Answers | Scope |
|----------|---------|-------|
| `kb/ADR/000X-*.md` | **Why** this decision + **How** it was chosen | One decision per file |
| `kb/modules/{name}.md` | **What** the module architecture looks like as a result | One module per file |

**ADR** captures the decision rationale (e.g., "use JWT instead of sessions").
**Module file** captures the resulting architecture (e.g., Auth component diagram, Strategy pattern for token validation, sequence diagram for login flow).

Each module file is owned by the team member responsible for that module. Cross-reference ADRs for the "why" behind each design choice.

**Example `kb/modules/auth.md` structure:**

```markdown
# Module: Auth

> **Owner**: [team member name]
> **Status**: Active | Draft | Deprecated
> **Last Updated**: [DATE]

## 1. Overview
- **Responsibility**: [one sentence]
- **Layer**: [Frontend | Backend | Shared]
- **Depends on**: [module names]
- **Depended by**: [module names]
- **Contracts**: `kb/contracts/user.yaml`
- **Source files**: `src/backend/services/auth.*`, `src/backend/middleware/auth.*`
- **Related ADRs**: `kb/ADR/0003-use-jwt-auth.md`

## 2. Component Architecture
[Internal breakdown — C4 Component level]

### Components
| Component | Responsibility | Pattern | File(s) |
|-----------|---------------|---------|---------|
| AuthController | Handle login/register requests | Controller | `src/backend/controllers/auth.*` |
| AuthService | Token generation & validation | Service | `src/backend/services/auth.*` |
| AuthMiddleware | Protect routes, verify JWT | Middleware | `src/backend/middleware/auth.*` |
| AuthContext | Frontend auth state | Context | `src/frontend/context/AuthContext.*` |

### Component Diagram
[Text-based diagram showing internal structure]

## 3. Design Patterns

### Strategy — Token Validation Strategy
- **Where**: AuthService
- **Why**: [rationale — link to ADR if applicable]
- **How**: [brief implementation]
- **Trade-offs**: [gains vs. costs]

## 4. Internal Data Flow
[How data moves within the module]

## 5. Sequence Diagrams
### [Use Case Name]
[Text-based sequence]

## 6. Data Model
[Entities owned by this module]

## 7. API Surface
[What this module exposes — links to contracts/]

## 8. Quality Attributes
- **Security**: [concerns and mitigations]
- **Performance**: [concerns and mitigations]
- **Error handling**: [strategy]

## 9. Testing Strategy
- **Unit tests**: [what to test]
- **Integration tests**: [what to test]

## 10. Open Questions / TODOs
- [ ] [unresolved items]
```

### Business Flows

While `kb/modules/` captures each module's internal architecture, **`kb/flows/`** captures **end-to-end business use cases** that span multiple modules. These are the "scenarios" view from the 4+1 View Model — the glue that shows how modules work together to deliver business value.

| Document | Perspective | Scope |
|----------|-----------|-------|
| `kb/modules/{name}.md` | Internal — what's inside one module | Single module |
| `kb/flows/{name}.md` | Cross-module — how modules cooperate | Entire system |
| `kb/ADR/000X-*.md` | Decision — why a choice was made | One decision |

Each flow file follows this template:

```markdown
# Business Flow: [Flow Name]

> **Owner**: [team member name]
> **Status**: Active | Draft | Deprecated
> **Last Updated**: [DATE]

## 1. Overview
- **Description**: [one-sentence summary]
- **Primary Actor**: [who/what triggers this flow]
- **Business Value**: [why this flow exists]
- **Modules Involved**: [list all modules touched]

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

### Creating the KB

Run `/hoang-kb-init` with a description of your project:

```
/hoang-kb-init e-commerce platform with product catalog, cart, and checkout
```

This creates all KB files with initial content tailored to your project, including `kb/modules/` files for each module and `kb/flows/` files for each identified E2E business flow. Then customize:
- Update `CONSTITUTION.md` with your team's non-negotiables
- Adjust `ARCHITECTURE.md` tech stack to match your choices
- Fill `DESIGN.md` with your FE design system
- Add domain terms to `GLOSSARY.md`
- Assign module owners and fill `kb/modules/{name}.md` with component architecture, patterns, and flows
- Assign flow owners and fill `kb/flows/{name}.md` with step-by-step cross-module scenarios, preconditions, and business rules

### Understanding the KB

Run `/hoang-kb-explain` with a topic:

```
/hoang-kb-explain architecture
/hoang-kb-explain auth module
/hoang-kb-explain checkout flow
/hoang-kb-explain how does Auth connect to User
/hoang-kb-explain what does "SKU" mean
```

### Updating the KB

Run `/hoang-kb-update` with a description of what changed:

```
/hoang-kb-update add a Payment module that processes payments via Stripe
/hoang-kb-update update architecture to use PostgreSQL instead of MongoDB
/hoang-kb-update new ADR: use JWT for authentication instead of session tokens
/hoang-kb-update add business flow: user checkout and payment
```

The skill automatically updates all cross-referenced files to maintain consistency, including creating or updating the corresponding `kb/modules/{module-name}.md` and `kb/flows/{flow-name}.md` files.

---

## 5. SDD Artifacts (sdd_artifacts/)

Each feature gets its own directory under `sdd_artifacts/`. The artifact lifecycle follows the SDD workflow:

```
sdd_artifacts/user-login/
├── .intent                    # Created by /hoang-sdd-on (workflow tracker)
├── spec.md                    # Phase 1: /hoang-sdd-specify
├── checklists/
│   └── requirements.md        # Phase 1: quality checklist
├── plan.md                    # Phase 2: /hoang-sdd-plan
├── research.md                # Phase 2: technology research
├── data-model.md              # Phase 2: entity definitions
├── quickstart.md              # Phase 2: validation scenarios
├── contracts/                 # Phase 2: API contracts
│   └── auth.md
├── tasks.md                   # Phase 3: /hoang-sdd-tasks
├── analysis-report.md         # Phase 5: /hoang-sdd-analyze
└── convergence-report.md      # Phase 6: /hoang-sdd-converge
```

### Artifact Flow

| Phase | Skill | Creates/Updates | Reads |
|-------|-------|-----------------|-------|
| 0. Orchestrate | `/hoang-sdd-on` | `.intent` | KB, existing artifacts |
| 1. Specify | `/hoang-sdd-specify` | `spec.md`, `checklists/requirements.md` | KB |
| 2. Plan | `/hoang-sdd-plan` | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` | KB, `spec.md` |
| 3. Tasks | `/hoang-sdd-tasks` | `tasks.md` | KB, `spec.md`, `plan.md`, `data-model.md`, `contracts/` |
| 4. Implement | `/hoang-sdd-implement` | Source code in `src/` | KB, ALL artifacts |
| 5. Analyze | `/hoang-sdd-analyze` | `analysis-report.md` | KB, ALL artifacts, `src/` |
| 6. Converge | `/hoang-sdd-converge` | Convergence tasks (appended to `tasks.md`), `convergence-report.md` | KB, ALL artifacts, `src/` |

---

## 6. Agent Learn (agent_learn/)

The `agent_learn/` directory captures lessons from the implementation phase so that future features benefit from past experience.

### Structure

```
agent_learn/
├── INDEX.md                    # Catalog of all lessons
└── lessons/
    ├── user-login-2026-08-04.md    # Lessons from user-login feature
    └── payment-2026-08-10.md       # Lessons from payment feature
```

### How It Works

1. **Written by `/hoang-sdd-implement`**: After implementation, the skill writes a lesson file capturing what worked, what didn't, and any deviations from the plan.
2. **Read by all skills**: Before starting a new feature, skills read `agent_learn/INDEX.md` to check for relevant past lessons.
3. **Read-only for agents**: Agents learn from past experiences but don't modify lessons directly (only `/hoang-sdd-implement` creates them).

### Lesson File Format

```markdown
# Lessons: [FEATURE NAME] — [DATE]

## What Worked
- [Pattern/approach that worked well]

## What Didn't Work
- [Pattern/approach that caused issues]

## Deviations from Plan
- [Where implementation diverged from plan.md and why]

## KB Updates Needed
- [ ] Update kb/ARCHITECTURE.md: [what and why]
- [ ] Update kb/MODULES.md: [what and why]
- [ ] Update kb/modules/{name}.md: [component architecture, patterns, or flows that changed]
- [ ] Update kb/flows/{name}.md: [E2E flow steps, business rules, or alternative paths that changed]
- [ ] New ADR needed: [topic]
```

### When to Review

- Before starting a new feature (read INDEX.md for relevant lessons)
- After `/hoang-sdd-implement` completes (new lesson is written)
- During `/hoang-sdd-status` (lesson count is reported)

---

## 7. Skill Reference

### `/hoang-sdd-on` — Orchestrator 🧠

**Trigger**: "sdd on", "start sdd", "orchestrate", or provide a feature description

**What it does**:
1. Scans the KB to understand project context
2. Checks for existing/in-progress features
3. Analyzes the feature description
4. Proposes a workflow with clear phases
5. Creates a `.intent` file to track progress

**Output**: A workflow proposal table showing which skills to invoke in order.

---

### `/hoang-sdd-specify` — Feature Specification 📝

**Prerequisite**: KB initialized (`/hoang-kb-init`)

**What it does**:
1. Loads KB context (constitution, architecture, modules, glossary)
2. Transforms a natural-language description into a structured spec
3. Generates user stories with acceptance criteria
4. Creates a requirements checklist
5. Handles clarifications (max 3 NEEDS CLARIFICATION markers)

**Output**: `sdd_artifacts/[feature-name]/spec.md`, `checklists/requirements.md`

---

### `/hoang-sdd-plan` — Technical Planning 📐

**Prerequisite**: `spec.md` exists

**What it does**:
1. Loads spec + KB context
2. Validates spec quality against checklist
3. Creates implementation plan with constitution gate check
4. Researches unknowns (Phase 0 → research.md)
5. Designs data model (data-model.md), API contracts (contracts/), and quickstart guide

**Output**: `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

---

### `/hoang-sdd-tasks` — Task Decomposition ✅

**Prerequisite**: `plan.md` exists

**What it does**:
1. Loads plan + spec + data model + contracts + KB
2. Breaks the plan into phased, dependency-ordered, executable tasks
3. Organizes tasks by user story priority (P1 → P2 → P3)
4. Marks parallelizable tasks with `[P]`
5. Generates an implementation strategy (MVP-first, incremental, or parallel)

**Output**: `tasks.md` with format `[ID] [P?] [Story] Description with file paths`

---

### `/hoang-sdd-implement` — Implementation 🔨

**Prerequisite**: `tasks.md` exists

**What it does**:
1. Loads ALL context: KB + ALL artifacts + agent_learn
2. Validates checklists, checks constitution compliance
3. Executes tasks phase by phase, respecting dependencies
4. Marks completed tasks `[X]` in `tasks.md`
5. Writes lessons learned to `agent_learn/`

**Output**: Source code in `src/`, updated `tasks.md`, lesson in `agent_learn/`

---

### `/hoang-sdd-analyze` — Cross-Artifact Analysis 🔍

**Prerequisite**: Feature has spec and some implementation

**What it does**:
1. Loads KB + ALL artifacts + source code
2. Checks consistency across: spec ↔ plan, plan ↔ tasks, tasks ↔ code, contracts ↔ code, data model ↔ code
3. Verifies constitution compliance and glossary consistency
4. Produces a findings report with CRITICAL/HIGH/MEDIUM/LOW severity

**Output**: `analysis-report.md` (read-only skill, never modifies other files)

---

### `/hoang-sdd-converge` — Gap Analysis & Remediation 🎯

**Prerequisite**: Feature has spec and implementation

**What it does**:
1. Compares implemented code against spec/plan/tasks
2. Classifies gaps: `missing`, `partial`, `contradicts`, `unrequested`
3. Assigns severity: CRITICAL (constitution violation or P1 broken), HIGH, MEDIUM, LOW
4. Appends convergence tasks to `tasks.md` (append-only, never modifies existing tasks)

**Output**: Convergence tasks in `tasks.md`, `convergence-report.md`

---

### `/hoang-sdd-status` — Dashboard 📊

**What it does**:
1. Checks KB health (which files exist, last modified)
2. Scans all features in `sdd_artifacts/`
3. Reports phase completion for each feature
4. Calculates task progress (completed/total)
5. Suggests next actions

**Output**: A dashboard view (no files modified)

---

### `/hoang-kb-init` — KB Initialization 🏗️

**What it does**:
1. Takes a business description as input
2. Extracts domain, actors, entities, actions, constraints
3. Creates the entire KB structure (10+ files)
4. Populates initial content based on the description
5. Initializes `agent_learn/` and `sdd_artifacts/`

**Output**: Complete `kb/` directory, `agent_learn/`, `sdd_artifacts/`

---

### `/hoang-kb-explain` — KB Explanation 💡

**What it does**:
1. Parses the user's query to determine which KB file(s) to read
2. Reads and explains in plain language
3. Cross-references related KB files
4. Flags gaps or inconsistencies

**Output**: Markdown explanation (no files modified)

---

### `/hoang-kb-update` — KB Updates 🔄

**What it does**:
1. Analyzes the change request
2. Determines which KB files are affected (primary + secondary)
3. Applies changes while maintaining cross-reference consistency
4. Runs a consistency check
5. Reports all changes made

**Output**: Updated KB files, consistency check results, suggestions for follow-up

---

## 8. Step-by-Step: Start a New Project

### Step 1: Set Up the Repository

```bash
mkdir my-project && cd my-project
git init
# The .agents/skills/ directory (hoang-sdd-kit skills) is already in place
```

### Step 2: Initialize the KB

```
/hoang-kb-init Your project description here
```

Example:
```
/hoang-kb-init Task management app with boards, cards, and team collaboration. React frontend, Express backend, PostgreSQL database.
```

### Step 3: Review and Customize the KB

1. Review `kb/CONSTITUTION.md` — adjust principles to your team's standards
2. Review `kb/ARCHITECTURE.md` — adjust tech stack if needed
3. Fill `kb/DESIGN.md` — add your design system, colors, typography
4. Add domain terms to `kb/GLOSSARY.md`
5. Customize `kb/CONTRIBUTING.md` — team-specific conventions
6. Assign module owners and fill `kb/modules/{name}.md` with component architecture, patterns, and flows

### Step 4: Start Your First Feature

```
/hoang-sdd-on allow users to register and login
```

This proposes the workflow. Then follow the phases:

```
/hoang-sdd-specify allow users to register and login
/hoang-sdd-plan
/hoang-sdd-tasks
/hoang-sdd-implement
/hoang-sdd-analyze
/hoang-sdd-converge
```

---

## 9. Step-by-Step: Add a New Feature

### For a Team Member (Not the Leader)

1. **Read the KB** first: `/hoang-kb-explain` (understand the project context)
2. **Check status**: `/hoang-sdd-status` (see what's in progress)
3. **Start specifying**: `/hoang-sdd-specify Your feature description`
4. **Follow the workflow**: Plan → Tasks → Implement → Analyze

### For the Leader (Review Before Implementation)

1. **Review spec.md** — does it match the business requirements?
2. **Review plan.md** — are the tech choices sound?
3. **Review tasks.md** — is the task breakdown reasonable?
4. **Run analysis**: `/hoang-sdd-analyze` before merging

---

## 10. Architecture Decisions Behind This Kit

### ADR-0001: Skills Over CLI

**Decision**: Use agent skills (`.agents/skills/*/SKILL.md`) instead of a Python CLI.

**Rationale**: For a university project, the team already uses AI coding agents. Skills require zero installation, work in the same environment where coding happens, and can read/write files directly. A CLI adds installation complexity without benefit.

**Consequence**: The kit works with any compatible AI coding agent. Team members must use the same AI tool.

### ADR-0002: Deep KB Over Minimal KB

**Decision**: Maintain a rich Knowledge Base with architecture, modules, contracts, glossary, and ADRs — not just a constitution.

**Rationale**: spec-kit's minimal KB (constitution only) works for production teams with institutional knowledge. For a university project, team members rotate, context is lost, and the KB must encode everything the team knows. The KB becomes the "institutional memory."

**Consequence**: The KB requires more upfront investment (`/hoang-kb-init`). But the payoff is that every skill can make informed decisions without human hand-holding.

### ADR-0003: Agent Learning

**Decision**: `agent_learn/` captures lessons from each implementation.

**Rationale**: In a course project, the same mistakes get repeated across features (e.g., forgetting to handle auth in API routes, always forgetting CORS). The learning system prevents this.

**Consequence**: Lesson files accumulate. The INDEX.md must be kept up-to-date. Skills add a small overhead of reading past lessons before acting.

### ADR-0004: Artifact Per Feature

**Decision**: Each feature gets its own directory under `sdd_artifacts/`.

**Rationale**: Features are independently specifiable, plannable, and implementable. Per-feature directories prevent merge conflicts, make it easy to track progress, and allow parallel work.

**Consequence**: Cross-feature dependencies must be managed through the KB (shared contracts, shared modules) rather than within a single tree.

### ADR-0005: Append-Only Convergence

**Decision**: `/hoang-sdd-converge` appends tasks to `tasks.md` rather than modifying existing tasks.

**Rationale**: Existing tasks represent the team's original plan. Convergence adds remediation work without rewriting history. This preserves auditability and prevents accidental deletion of planned work.

**Consequence**: `tasks.md` grows over time. The convergence section is clearly separated and can be worked through independently.

---

## 11. Team Conventions

### Git Workflow

```
main
├── feature/user-login         ← From /hoang-sdd-on
├── feature/payment            ← From /hoang-sdd-on
└── feature/dashboard          ← From /hoang-sdd-on
```

- **Branch naming**: `feature/[feature-name]` (matches `sdd_artifacts/[feature-name]/`)
- **Commit messages**: Follow Conventional Commits
  - `feat(user-login): add spec.md from /hoang-sdd-specify`
  - `feat(user-login): add plan and contracts from /hoang-sdd-plan`
  - `impl(user-login): complete T001-T005 from tasks.md`
  - `fix(user-login): handle expired token in auth middleware`

### SDD Workflow Discipline

1. **Never skip specify** — even if the feature seems obvious. The spec catches assumptions.
2. **Never implement without tasks** — tasks ensure nothing is forgotten and work is traceable.
3. **Always analyze before converging** — you need to know the gaps before you can close them.
4. **Update the KB when the architecture changes** — if you add a module, run `/hoang-kb-update` and fill `kb/modules/{name}.md` with its architecture. If you add or change a cross-module flow, fill `kb/flows/{name}.md` with the E2E steps.
5. **Review lessons before starting a feature** — run `/hoang-kb-explain` and check `agent_learn/INDEX.md`.

### File Ownership

| Directory | Who Writes | Who Reads |
|-----------|-----------|-----------|
| `kb/` | Team lead (via `/hoang-kb-update`) | All skills, all team members |
| `kb/modules/{name}.md` | Module owner (via `/hoang-kb-update` or direct edit) | All skills, all team members |
| `kb/flows/{name}.md` | Flow owner (via `/hoang-kb-update` or direct edit) | All skills, all team members |
| `sdd_artifacts/[feature]/` | Assigned team member (via skills) | All skills, reviewers |
| `src/` | All team members (via `/hoang-sdd-implement` or direct) | `/hoang-sdd-analyze`, `/hoang-sdd-converge` |
| `agent_learn/` | `/hoang-sdd-implement` (write) | All skills (read) |

---

## 12. FAQ

### Q: Can I skip the orchestrator (`/hoang-sdd-on`) and go straight to `/hoang-sdd-specify`?

**A**: Yes, but you lose the pre-flight checks. The orchestrator verifies the KB is populated, checks for conflicting features, and cross-references with the KB. If you're confident the KB is ready, go straight to `/hoang-sdd-specify`.

### Q: What if the KB doesn't have a file I need?

**A**: Run `/hoang-kb-update "add [missing content]"` or create the file manually following the templates in `kb/`. Missing KB files won't crash the skills — they'll just skip them and may produce less informed results.

### Q: Can I modify artifacts manually (e.g., edit spec.md by hand)?

**A**: Absolutely. The artifacts are Markdown files — edit them however you want. The skills will read whatever is in the files. Just be aware that manual edits aren't validated, so contradictions could emerge.

### Q: What if two features depend on the same module?

**A**: The module is defined once in `kb/MODULES.md`, detailed in `kb/modules/{name}.md`, and its API in `kb/contracts/`. E2E flows that use the module are in `kb/flows/{name}.md`. Both features reference the same contract. If a feature needs to modify a shared module, run `/hoang-kb-update` to update the KB first (including the module architecture and flow files), then the second feature's spec and plan should reference the updated KB.

### Q: Can I use this for solo development?

**A**: Yes. The KB becomes your notes, the artifacts become your plan, and the skills keep you disciplined. It's overkill for a one-file script, but ideal for any project with more than 2 features.

### Q: How do I remove a feature?

**A**: Delete its directory under `sdd_artifacts/`. The source code in `src/` is not affected. If you want to remove the code too, do that separately and run `/hoang-sdd-converge` to detect the spec-code mismatch.

### Q: What's the difference between `kb/contracts/` and `sdd_artifacts/[feature]/contracts/`?

**A**: `kb/contracts/` contains **shared, cross-feature contracts** (e.g., the User API contract used by multiple features). `sdd_artifacts/[feature]/contracts/` contains **feature-specific contracts** that may extend or refine the shared ones. When a feature-specific contract stabilizes and is used by other features, promote it to `kb/contracts/` via `/hoang-kb-update`.

### Q: How does `agent_learn/` differ from the KB?

**A**: The KB is **intentional** (what we decided) and **prescriptive** (what we should do). `agent_learn/` is **empirical** (what actually happened) and **descriptive** (what we learned). The KB is written by the team; agent learn is written by the SDD skills during implementation. Both inform future decisions, but the KB is authoritative.

### Q: What's the difference between module sequence diagrams and E2E flow files?

**A**: Module files (`kb/modules/{name}.md` §5) contain **per-module sequence diagrams** — how components inside one module interact. Flow files (`kb/flows/{name}.md`) contain **cross-module E2E scenarios** — how multiple modules cooperate to fulfill a business use case. The module diagram shows Auth's internal token-issuance sequence; the flow file shows Auth→Cart→Payment→Notification end-to-end.

---

*Built with hoang-sdd-kit — Spec-Driven Development for university projects.*