---
name: hoang-sdd-converge
description: "hoang-sdd Converge — compares implemented code against spec/plan/tasks to find gaps (missing, partial, contradicts, unrequested). Appends convergence tasks to tasks.md. Use after /hoang-sdd-implement or on brownfield features."
allowed-tools: Read, Write, Edit, Bash(find *), Bash(ls *), Bash(grep *), Bash(wc *), Bash(cat *)
---

# hoang-sdd Converge

Compare what was implemented against what was specified. Find and resolve the gap.

## User Input

```
$ARGUMENTS
```

Optional: feature name. If empty, prompt user to choose from `sdd_artifacts/`.

## Execution

### 1. Load KB Context

Read: `kb/INDEX.md` → `kb/CONSTITUTION.md` → `kb/ARCHITECTURE.md` → `kb/MODULES.md` → `kb/modules/` (relevant module files) → `kb/flows/` (relevant E2E flows)

### 2. Load Feature Artifacts

Read all artifacts for the target feature:
- `sdd_artifacts/[feature]/spec.md`
- `sdd_artifacts/[feature]/plan.md`
- `sdd_artifacts/[feature]/tasks.md`
- `sdd_artifacts/[feature]/data-model.md`
- `sdd_artifacts/[feature]/contracts/`
- `sdd_artifacts/[feature]/research.md`

### 3. Scan Source Code

Read the `src/` directory tree. For each relevant file, compare its content against what the artifacts prescribe.

### 4. Gap Classification

For each discrepancy found, classify:

| Classification | Definition |
|---|---|
| **missing** | Spec requires it, but no implementation exists |
| **partial** | Implementation exists but doesn't fully meet the spec |
| **contradicts** | Implementation conflicts with the spec/plan/contracts |
| **unrequested** | Implementation exists with no spec/plan/task backing |

### 5. Severity Assignment

| Severity | Criteria |
|---|---|
| **CRITICAL** | Constitution violation OR P1 user story broken |
| **HIGH** | Spec requirement not met, affects core functionality |
| **MEDIUM** | Partial implementation, non-critical gap |
| **LOW** | Minor inconsistency, cosmetic issue |

### 6. Generate Convergence Tasks

**Append-only**: Add a "Phase N: Convergence" section to the END of `tasks.md`. Do NOT modify existing task content.

```markdown
---

## Phase N: Convergence

**Purpose**: Close gaps between specification and implementation
**Generated**: [ISO date] by /hoang-sdd-converge

### Critical Gaps
- [ ] CV001 ❌ [missing] Implement [FR-XXX] — spec requires but no code exists in src/[path]
- [ ] CV002 ❌ [contradicts] Fix [endpoint] response — contracts/ prescribes [schema] but code returns [actual]

### High Gaps
- [ ] CV003 ⚠️ [partial] Complete [feature] — spec requires [behavior] but only [partial behavior] is implemented

### Medium Gaps
- [ ] CV004 ⚠️ [partial] Add [validation] — data-model.md requires [constraint] but code doesn't enforce it

### Unrequested Code
- ℹ️ [unrequested] src/[path] has no spec/plan/task backing. Remove or add spec coverage?

### Low Gaps
- [ ] CV005 ℹ️ [missing] Add [minor item] — nice-to-have from quickstart.md
```

### 7. Write Convergence Report

Create `sdd_artifacts/[feature]/convergence-report.md`:

```markdown
# Convergence Report: [FEATURE NAME]

**Date**: [ISO date]
**Overall Status**: 🟢 Converged / 🟡 Partial / 🔴 Diverged

## Gap Summary
| Classification | Critical | High | Medium | Low | Total |
|---|---|---|---|---|---|
| missing | X | X | X | X | X |
| partial | X | X | X | X | X |
| contradicts | X | X | X | X | X |
| unrequested | - | - | X | X | X |

## Constitution Compliance
| Principle | Status | Gaps |
|---|---|---|
| [Art 1] | ✅/❌ | [description] |

## Recommendations
1. [most critical action]
2. [next action]
```

## Rules

- **Append-only to tasks.md**: Never modify or delete existing tasks. Only add a new "Phase N: Convergence" section at the bottom.
- **No code changes**: This skill does NOT implement fixes. It only identifies gaps and generates remediation tasks.
- **Evidence-based**: Every gap must reference a specific spec requirement AND a specific code file.
- **Constitution first**: Constitution violations are always CRITICAL regardless of functional impact.
- **Unrequested code is a question, not a verdict**: Flag it, but let the team decide whether to remove or add spec coverage.