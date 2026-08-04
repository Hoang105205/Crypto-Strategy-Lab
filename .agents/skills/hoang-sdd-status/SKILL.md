---
name: hoang-sdd-status
description: "hoang-sdd Status — shows the current state of all SDD features and artifacts. Scans sdd_artifacts/ and reports which phases are complete, in-progress, or pending. Use when user asks 'sdd status', 'project status', or wants a dashboard view."
allowed-tools: Read, Bash(find *), Bash(ls *), Bash(grep *), Bash(wc *)
---

# hoang-sdd Status

Show the current state of all SDD features and artifacts.

## Execution

### 1. Scan KB Health

Quick check: does the KB exist and is it populated?

| File | Exists? | Last Modified |
|------|---------|---------------|
| `kb/INDEX.md` | ✅/❌ | [date] |
| `kb/CONSTITUTION.md` | ✅/❌ | [date] |
| `kb/ARCHITECTURE.md` | ✅/❌ | [date] |
| `kb/DESIGN.md` | ✅/❌ | [date] |
| `kb/MODULES.md` | ✅/❌ | [date] |
| `kb/modules/` | ✅/❌ (N modules) | [date] |
| `kb/flows/` | ✅/❌ (N flows) | [date] |
| `kb/GLOSSARY.md` | ✅/❌ | [date] |

### 2. Scan Artifacts

For each directory in `sdd_artifacts/`:

```
Feature: [name]
├── Phase 1 - Specify:  ✅ spec.md exists / ❌ missing
├── Phase 2 - Plan:     ✅ plan.md exists / ❌ missing
│   ├── research.md:    ✅/❌
│   ├── data-model.md:  ✅/❌
│   ├── contracts/:     ✅ (N contracts) / ❌
│   └── quickstart.md:  ✅/❌
├── Phase 3 - Tasks:    ✅ tasks.md exists / ❌ missing
├── Phase 4 - Implement: [X/N tasks completed]
├── Phase 5 - Analyze:  ✅ analysis-report.md / ❌
└── Phase 6 - Converge: ✅ convergence-report.md / ❌
```

### 3. Task Progress

For each feature with `tasks.md`:
- Count total tasks: `- [ ]` + `- [X]`
- Count completed: `- [X]`
- Calculate percentage

### 4. Agent Learn

Check `agent_learn/INDEX.md` for lesson count.

### 5. Report

Output a single dashboard view:

```markdown
## 📊 SDD Kit Dashboard

### KB Health
| Component | Status | Last Updated |
|-----------|--------|-------------|
| INDEX | ✅ | - |
| CONSTITUTION | ✅ | 2026-08-01 |
| ARCHITECTURE | ❌ (missing) | - |
| DESIGN | ✅ | 2026-08-03 |
| MODULES | ✅ | 2026-08-01 |
| modules/ | ✅ (3 modules) | 2026-08-02 |
| flows/ | ✅ (2 flows) | 2026-08-03 |
| GLOSSARY | ❌ (missing) | - |

### Features Overview
| Feature | Specify | Plan | Tasks | Implement | Analyze | Converge |
|---------|---------|------|-------|-----------|---------|----------|
| user-login | ✅ | ✅ | ✅ | 8/12 (67%) | ❌ | ❌ |
| oauth2 | ✅ | ✅ | ❌ | - | ❌ | ❌ |
| dashboard | ✅ | ❌ | ❌ | - | ❌ | ❌ |

### Agent Learn
📚 3 lessons recorded (last: 2026-08-03)

### Suggested Actions
1. `user-login`: Run `/hoang-sdd-implement` to complete remaining 4 tasks
2. `oauth2`: Run `/hoang-sdd-tasks` to generate task list
3. `dashboard`: Run `/hoang-sdd-plan` to create implementation plan
4. KB: Update `kb/ARCHITECTURE.md` and `kb/GLOSSARY.md` (missing)
```

## Rules

- **Read-only**: Never modify any file.
- **Fast**: Only read directory listings and file headers, not full file contents.
- **Actionable**: Every suggestion must reference a specific skill command the user can run.