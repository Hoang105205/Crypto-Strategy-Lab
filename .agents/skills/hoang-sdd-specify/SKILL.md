---
name: hoang-sdd-specify
description: "hoang-sdd Specify — transforms a natural-language feature description into a structured specification (spec.md). Reads KB (constitution, architecture, modules) before writing. Use when user says 'sdd specify', '/hoang-sdd-specify', or wants to create a feature specification."
allowed-tools: Read, Write, Bash(find *), Bash(ls *), Bash(mkdir *)
---

# hoang-sdd Specify

Transform a feature description into a structured, KB-grounded specification.

## User Input

```
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution

### 1. Load KB Context

Read these files in order (skip missing):
1. `kb/INDEX.md`
2. `kb/CONSTITUTION.md`
3. `kb/ARCHITECTURE.md`
4. `kb/MODULES.md`
5. `kb/modules/` (read files relevant to the feature's modules)
6. `kb/flows/` (read E2E flows relevant to the feature's scenarios)
7. `kb/GLOSSARY.md`
8. `kb/DESIGN.md` (for FE features)

### 2. Check for Existing Feature

- Look in `sdd_artifacts/` for a directory matching the feature name.
- If one exists with `spec.md` already, ask: "A spec already exists at `sdd_artifacts/[name]/spec.md`. Update it, or create a new feature variant?"

### 3. Scan agent_learn/

Read `agent_learn/INDEX.md` (if exists) for past lessons relevant to this feature's domain.

## Execution

### 4. Generate Feature Name

From the user description, generate a 2-4 word kebab-case name:
- "allow user to login" → `user-login`
- "implement OAuth2 integration" → `oauth2-integration`
- "create analytics dashboard" → `analytics-dashboard`

### 5. Create Feature Directory

```
sdd_artifacts/[feature-name]/
├── spec.md
└── checklists/
    └── requirements.md
```

### 6. Write spec.md

Use this template, filling from the user description + KB context:

```markdown
# Feature Specification: [FEATURE NAME]

**Feature**: `[feature-name]`
**Created**: [DATE]
**Status**: Draft
**Input**: User description: "[ORIGINAL DESCRIPTION]"

## User Scenarios & Testing

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain value and priority level]
**Independent Test**: [How to test independently]

**Acceptance Scenarios**:
1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)
[Same structure]

---

### Edge Cases
- What happens when [boundary condition]?
- How does system handle [error scenario]?

## Requirements

### Functional Requirements
- **FR-001**: System MUST [specific capability]
- **FR-002**: System MUST [specific capability]
- *(Max 3 [NEEDS CLARIFICATION: question] markers for critical unknowns)*

### Key Entities
- **[Entity 1]**: [What it represents, key attributes]
- **[Entity 2]**: [What it represents, relationships]

## Success Criteria
- **SC-001**: [Measurable, technology-agnostic outcome]
- **SC-002**: [Measurable outcome]

## Assumptions
- [Assumption with reasonable default chosen]
- [Assumption about scope boundaries]

## KB Cross-References
- **Modules affected**: [from kb/MODULES.md and kb/modules/]
- **E2E flows affected**: [from kb/flows/ — which business scenarios this feature participates in or modifies]
- **Architecture constraints**: [from kb/ARCHITECTURE.md]
- **Constitution gates**: [from kb/CONSTITUTION.md]
- **Glossary terms**: [from kb/GLOSSARY.md]
```

### 7. Write requirements checklist

Create `sdd_artifacts/[feature-name]/checklists/requirements.md`:

```markdown
# Specification Quality Checklist: [FEATURE NAME]

## Content Quality
- [ ] No implementation details (languages, frameworks, APIs)
- [ ] Focused on user value and business needs
- [ ] All mandatory sections completed

## Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous
- [ ] Success criteria are measurable
- [ ] Edge cases are identified

## KB Alignment
- [ ] Feature respects constitutional principles
- [ ] Module boundaries are respected
- [ ] Glossary terms are used correctly
- [ ] No conflicts with existing architecture
```

### 8. Handle Clarifications

If the spec has [NEEDS CLARIFICATION] markers:
- Max 3 markers allowed
- Present options to the user as a table with implications
- Wait for user response, update spec, re-validate

## Completion Report

Report to the user:
- Feature directory path
- Spec file path
- Checklist pass/fail summary
- Recommended next step: `/hoang-sdd-plan` or `/hoang-sdd-specify` (to clarify first)