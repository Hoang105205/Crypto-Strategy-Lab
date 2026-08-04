---
name: hoang-sdd-implement
description: "hoang-sdd Implement — executes the task list in tasks.md phase by phase, respecting dependencies and [P] parallel markers. Reads KB, spec, plan, contracts before coding. Marks tasks [X] as completed. Use after /hoang-sdd-tasks completes."
allowed-tools: Read, Write, Edit, Bash(mkdir *), Bash(ls *), Bash(find *), Bash(wc *), Bash(cat *), Bash(grep *), Bash(node *), Bash(npm *), Bash(npx *), Bash(python3 *), Bash(pip3 *), Bash(go *), Bash(cargo *), Bash(dotnet *)
---

# hoang-sdd Implement

Execute the implementation plan by processing tasks defined in `tasks.md`.

## User Input

```
$ARGUMENTS
```

Optional: specific task IDs to execute (e.g., "T001 T002 T003"). If empty, execute all pending tasks in order.

## Pre-Execution

### 1. Load KB Context

Read (skip missing):
1. `kb/INDEX.md` → `kb/CONSTITUTION.md` → `kb/ARCHITECTURE.md` → `kb/MODULES.md` → `kb/modules/` (relevant module files for component architecture and patterns) → `kb/flows/` (relevant E2E flows for cross-module context) → `kb/DESIGN.md`
2. `kb/GLOSSARY.md` (for correct naming during implementation)
3. `kb/CONTRIBUTING.md` (for coding standards)

### 2. Load Feature Artifacts

Read:
1. `sdd_artifacts/[feature-name]/spec.md` (REQUIRED)
2. `sdd_artifacts/[feature-name]/plan.md` (REQUIRED)
3. `sdd_artifacts/[feature-name]/tasks.md` (REQUIRED)
4. `sdd_artifacts/[feature-name]/data-model.md` (if exists)
5. `sdd_artifacts/[feature-name]/contracts/` (all files, if exists)
6. `sdd_artifacts/[feature-name]/research.md` (if exists)
7. `sdd_artifacts/[feature-name]/quickstart.md` (if exists)
8. `agent_learn/INDEX.md` (if exists — past lessons)

If `tasks.md` doesn't exist, **STOP** and tell the user to run `/hoang-sdd-tasks` first.

### 3. Validate Checklist Status

If `sdd_artifacts/[feature-name]/checklists/requirements.md` exists:
- Count total vs. completed items
- If any are incomplete, warn the user: "Some spec checklists are incomplete. Proceed? (yes/no)"
- Wait for confirmation before continuing

## Execution

### 4. Parse Tasks

From `tasks.md`, extract:
- All task IDs, descriptions, phases, [P] markers, [Story] labels
- Phase boundaries (Setup → Foundation → US1 → US2 → ... → Polish)
- Dependencies (which tasks must complete before others)
- Already-completed tasks (marked `[X]`)

### 5. Execute Phase by Phase

For each phase, in order:

1. **Setup**: Create directories, initialize dependencies, configure tooling
2. **Foundation**: Database, auth, routing, logging (MUST complete before user stories)
3. **User Stories**: P1 first, then P2, P3...
4. **Polish**: Cross-cutting concerns

Within each phase:
- Tasks marked `[P]` can be executed in parallel (conceptually — the agent executes sequentially but knows they're independent)
- Sequential tasks must follow dependency order
- After each task, mark it `[X]` in `tasks.md`

### 6. Implementation Rules

- **Read before write**: Before creating any file, check if it already exists in `src/`. If yes, edit; if no, create.
- **Contracts are SSoT**: When implementing API endpoints, field names and types MUST match `contracts/` exactly.
- **Data model is SSoT**: When implementing models, fields and constraints MUST match `data-model.md` exactly.
- **Constitution gates**: If the constitution mandates test-first, write tests before implementation.
- **DESIGN.md compliance**: For FE code, follow `kb/DESIGN.md` component library and styling conventions.
- **Glossary terms**: Use exact terms from `kb/GLOSSARY.md` in comments, variable names, and API paths.
- **Minimal, focused changes**: Each task touches only the files specified in its description.
- **No scope creep**: If a task reveals additional work needed, note it in `agent_learn/` but don't implement it outside the task scope.

### 7. Progress Tracking

After completing each task:
1. Mark it `[X]` in `tasks.md`
2. Report brief progress: "✅ T001 — Create project structure"
3. If a task fails: report the error, skip to the next independent task, note the blocker

### 8. Agent Learning

After implementation, write lessons learned to `agent_learn/`:

```
agent_learn/
├── INDEX.md                    # Catalog of all lessons
└── lessons/
    └── [feature-name]-[date].md  # Feature-specific lessons
```

Each lesson file:
```markdown
# Lessons: [FEATURE NAME] — [DATE]

## What Worked
- [pattern/approach that worked well]

## What Didn't Work
- [pattern/approach that caused issues]

## Deviations from Plan
- [where implementation diverged from plan.md and why]

## KB Updates Needed
- [ ] Update kb/ARCHITECTURE.md: [what and why]
- [ ] Update kb/MODULES.md: [what and why]
- [ ] Update kb/modules/{name}.md: [component architecture, patterns, or flows that changed]
- [ ] Update kb/flows/{name}.md: [E2E flow steps, business rules, or alternative paths that changed]
- [ ] New ADR needed: [topic]
```

Update `agent_learn/INDEX.md` to add an entry for this lesson file.

## Completion Report

Report:
- Total tasks completed vs. total tasks
- Any tasks skipped or blocked (with reasons)
- Files created/modified (summary)
- Lessons learned (key takeaways)
- Recommended next step: `/hoang-sdd-analyze` or `/hoang-sdd-converge`

## Error Handling

- **Missing artifact**: If a required artifact (e.g., `contracts/api.md`) is referenced in tasks but doesn't exist, stop and report. Suggest running `/hoang-sdd-plan` to regenerate.
- **Constitution violation during implementation**: If you discover a violation while coding, stop the task, document it, and ask the user how to proceed.
- **Task dependency not met**: Skip the task, report the blocker, continue with independent tasks.