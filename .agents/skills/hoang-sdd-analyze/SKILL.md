---
name: hoang-sdd-analyze
description: "hoang-sdd Analyze — cross-artifact consistency analysis. Scans spec.md, plan.md, tasks.md, contracts/, data-model.md, and source code to find gaps, contradictions, and constitution violations. Read-only skill. Use after /hoang-sdd-implement or anytime you want a health check."
allowed-tools: Read, Bash(find *), Bash(ls *), Bash(grep *), Bash(wc *), Bash(cat *)
---

# hoang-sdd Analyze

Cross-artifact consistency analysis. Read-only — produces a findings report, never modifies files.

## User Input

```
$ARGUMENTS
```

Optional: specific feature name. If empty, analyze all features in `sdd_artifacts/`.

## Execution

### 1. Load KB Context

Read: `kb/INDEX.md` → `kb/CONSTITUTION.md` → `kb/ARCHITECTURE.md` → `kb/MODULES.md` → `kb/modules/` (all module files) → `kb/flows/` (all flow files) → `kb/GLOSSARY.md`

### 2. Load Feature Artifacts

For the target feature (or all features), read:
- `sdd_artifacts/[feature]/spec.md`
- `sdd_artifacts/[feature]/plan.md`
- `sdd_artifacts/[feature]/tasks.md`
- `sdd_artifacts/[feature]/data-model.md`
- `sdd_artifacts/[feature]/contracts/` (all files)
- `sdd_artifacts/[feature]/research.md`
- `sdd_artifacts/[feature]/quickstart.md`

### 3. Load Source Code

Scan `src/` directory structure to compare against what the artifacts describe.

### 4. Analysis Checks

Run these checks and report findings:

#### 4a. Spec ↔ Plan Consistency
- Does the plan address ALL functional requirements from the spec?
- Are all user stories from the spec covered in the plan?
- Are there plan sections with no spec backing (scope creep)?

#### 4b. Plan ↔ Tasks Consistency
- Does every plan section have corresponding tasks?
- Are there tasks with no plan backing?
- Are task file paths consistent with the plan's source code structure?

#### 4c. Tasks ↔ Code Consistency
- Are all `[X]` (completed) tasks actually implemented in `src/`?
- Are there source files not covered by any task?
- Are there pending `[ ]` tasks that already have implementations?

#### 4d. Contracts ↔ Code Consistency
- Do API endpoints in code match contracts/?
- Do request/response schemas match?
- Are there undocumented endpoints?

#### 4e. Data Model ↔ Code Consistency
- Do model files in `src/` match `data-model.md`?
- Are all fields, types, and constraints correctly implemented?
- Are there model files not in the data model?

#### 4f. Constitution Compliance
- Does the implementation follow all constitutional principles?
- Are there violations that need justification in plan.md Complexity Tracking?

#### 4g. Glossary Consistency
- Are variable names, API paths, and comments using terms from `kb/GLOSSARY.md`?
- Are there inconsistent names for the same concept?

#### 4h. Module Architecture ↔ Code Consistency
- Do components in `kb/modules/{name}.md` match the actual source code structure?
- Are design patterns documented in module files actually used in the code?
- Are there components in the code not documented in the module architecture file?
- Do sequence diagrams in module files reflect the actual implementation flow?
- Are ADRs referenced in module files still relevant (not superseded)?

#### 4i. E2E Flow ↔ Code Consistency
- Do the flow steps in `kb/flows/{name}.md` match the actual cross-module interactions in the code?
- Are preconditions and postconditions in flow files enforced by the implementation?
- Are alternative paths and error flows in flow files handled in the code?
- Are there implemented cross-module interactions not documented in any E2E flow?
- Do the modules listed in flow files match the actual module boundaries in MODULES.md?
- Are business rules in flow files enforced by the implementation?

### 5. Report

Write findings to `sdd_artifacts/[feature]/analysis-report.md`:

```markdown
# Analysis Report: [FEATURE NAME]

**Date**: [ISO date]
**Scope**: [which artifacts were analyzed]
**Overall Health**: 🟢 Healthy / 🟡 Warning / 🔴 Critical

## Findings

### [CRITICAL] [F-001]: [Title]
**Category**: [spec-plan | plan-tasks | tasks-code | contracts-code | data-model-code | constitution | glossary]
**Location**: [file:line or artifact section]
**Description**: [what's wrong]
**Impact**: [what happens if unfixed]
**Recommendation**: [how to fix]

### [HIGH] [F-002]: [Title]
[Same structure]

### [MEDIUM] [F-003]: [Title]
[Same structure]

### [LOW] [F-004]: [Title]
[Same structure]

## Summary
| Severity | Count |
|----------|-------|
| CRITICAL | X |
| HIGH | X |
| MEDIUM | X |
| LOW | X |

## Constitution Compliance
| Principle | Status | Violations |
|-----------|--------|-----------|
| [Art 1] | ✅/⚠️/❌ | [count] |

## Recommended Actions
1. [most critical action]
2. [next action]
3. [etc.]
```

## Rules

- **Read-only**: This skill NEVER modifies any file except creating the analysis report.
- **Evidence-based**: Every finding must reference a specific file and line/section.
- **No false positives**: Only report findings you can verify by reading the actual artifacts and code.
- **Constitutionality is objective**: Constitution violations are always CRITICAL or HIGH.
- **Be practical**: LOW findings are nice-to-know; don't clutter the report with trivialities.