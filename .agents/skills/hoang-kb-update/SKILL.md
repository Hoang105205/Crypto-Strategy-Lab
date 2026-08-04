---
name: hoang-kb-update
description: "hoang-kb Update — updates one or more KB files with new information. Takes a description of what changed and updates the relevant KB files while maintaining consistency across all cross-references. Use when user says 'update kb', 'add to architecture', 'new module X', 'update glossary', or describes a change that should be reflected in the KB."
allowed-tools: Read, Write, Edit, Bash(find *), Bash(ls *), Bash(mkdir *)
---

# hoang-kb Update

Update the Knowledge Base with new information, maintaining cross-reference consistency.

## User Input

```
$ARGUMENTS
```

**Required**: Description of what changed or what to add. Examples:
- "add a Payment module that processes payments via Stripe"
- "update architecture to use PostgreSQL instead of MongoDB"
- "add term 'SKU' to glossary: Stock Keeping Unit, a unique identifier for a product variant"
- "new ADR: use JWT for authentication instead of session tokens"
- "update DESIGN.md: we're using Tailwind CSS now"

## Execution

### Step 1: Analyze the Change Request

Determine:
- **Which KB file(s) are affected** (primary target)
- **Which KB file(s) need cross-reference updates** (secondary targets)
- **Change type**: ADD (new content) | UPDATE (modify existing) | ADR (new decision) | RESTRUCTURE (major change)

| Change Request | Primary File | Secondary Files |
|---|---|---|
| "add module X" | MODULES.md, modules/{name}.md | ARCHITECTURE.md, contracts/, GLOSSARY.md |
| "update architecture" | ARCHITECTURE.md | MODULES.md, modules/, CONTRIBUTING.md |
| "add glossary term" | GLOSSARY.md | (usually none) |
| "new ADR" | ADR/XXXX.md | ARCHITECTURE.md (if decision changes arch), modules/ (if affects a module) |
| "update design" | DESIGN.md | (usually none) |
| "update constitution" | CONSTITUTION.md | (propagate to all features) |
| "add contract" | contracts/entity.yaml | MODULES.md, modules/, GLOSSARY.md |
| "update module architecture" | modules/{name}.md | MODULES.md, ADR/ (if new decision) |
| "add business flow" | flows/{name}.md | MODULES.md, modules/, flows/README.md, GLOSSARY.md |
| "update flow" | flows/{name}.md | modules/ (if steps changed), flows/README.md |

### Step 2: Load Affected Files

Read all primary and secondary KB files. If a file doesn't exist, create it.

### Step 3: Apply Changes

#### Adding a New Module (e.g., "Payment module")

1. **MODULES.md**: Add module entry with scope, exposes, dependencies, files, contracts
2. **modules/{name}.md**: Create `kb/modules/payment.md` using the module architecture template (see `/hoang-kb-init` Step 5). Fill in Overview section; mark remaining sections as `[TODO: fill during planning phase]`
3. **modules/README.md**: Add entry to the module index table
4. **ARCHITECTURE.md**: Update source code structure, communication patterns, data flow
5. **contracts/**: Create `contracts/payment.yaml` with the module's API contract
6. **GLOSSARY.md**: Add any new domain terms (e.g., "Payment", "Transaction", "Refund")
7. **INDEX.md**: Update scope coverage section

#### Updating a Module's Architecture (e.g., "update Auth module to use refresh tokens")

1. **modules/{name}.md**: Read existing module file, update relevant sections (Component Architecture, Design Patterns, Data Flow, Sequence Diagrams, Quality Attributes)
2. **ADR/**: If a new architectural decision is involved, create a new ADR and link it in the module file's "Related ADRs" field
3. **MODULES.md**: Update the module's scope/exposes/dependencies if they changed
4. **contracts/**: Update API contracts if the module's API surface changed
5. **flows/**: If the module's API or behavior changed, check `kb/flows/` for any E2E flows that reference this module and update their steps or error flows
6. **INDEX.md**: Update last-updated date

#### Adding a New Business Flow (e.g., "add checkout flow")

1. **flows/{name}.md**: Create `kb/flows/checkout.md` using the business flow template (see `/hoang-kb-init` Step 6). Fill in Overview (description, primary actor, modules involved) and Flow Steps; mark remaining sections as `[TODO: fill during planning phase]`
2. **flows/README.md**: Add entry to the flow index table
3. **MODULES.md**: Ensure all modules listed in the flow's "Modules Involved" are defined here
4. **modules/{name}.md**: For each module involved, verify it exists. If a module doesn't have a `kb/modules/{name}.md` file yet, flag it for creation
5. **GLOSSARY.md**: Add any new domain terms used in the flow
6. **INDEX.md**: Update scope coverage section (add the flow to "Business Flows")

#### Creating a New ADR

1. Determine the next ADR number (scan `kb/ADR/` for the highest number)
2. Create `kb/ADR/[NNNN]-[title].md` using the ADR template
3. If the decision changes the architecture, update `ARCHITECTURE.md`
4. If the decision affects a module, update `modules/{name}.md` (add to "Related ADRs" and update relevant pattern/architecture sections) AND update `MODULES.md`
5. If the decision affects an E2E flow (e.g., changing auth strategy affects the checkout flow), update `flows/{name}.md` to reflect the new behavior
6. Update `INDEX.md` if needed

#### Updating an Existing File

1. Read the current content
2. Apply the change, preserving existing structure and sections
3. Check that cross-references still point to valid content
4. Update the "Last Updated" date in the file header

> **Note**: When updating a module architecture file (`kb/modules/{name}.md`), preserve the section structure (1-10). Add new patterns or components to the appropriate sections rather than creating new top-level sections.

### Step 4: Consistency Check

After making all changes, verify:

- [ ] Glossary terms used in the updated files are defined in GLOSSARY.md
- [ ] Module dependencies in MODULES.md form an acyclic graph (no circular deps)
- [ ] Contracts referenced in MODULES.md exist in contracts/
- [ ] Each module in MODULES.md has a corresponding `kb/modules/{name}.md` file
- [ ] Modules listed in `flows/*.md` exist in MODULES.md and have corresponding `kb/modules/{name}.md` files
- [ ] Contracts referenced in `flows/*.md` exist in `contracts/`
- [ ] ADRs referenced in `modules/*.md` exist in `kb/ADR/`
- [ ] ADRs referenced in `flows/*.md` exist in `kb/ADR/`
- [ ] Architecture in ARCHITECTURE.md matches MODULES.md structure
- [ ] DESIGN.md component library is consistent with MODULES.md frontend modules
- [ ] INDEX.md reading order table is up to date

If any inconsistency is found, fix it or flag it for manual review.

### Step 5: Update INDEX.md

Update the `Last Updated` date and any scope changes in `kb/INDEX.md`.

### Step 6: Report

```markdown
## 🔄 KB Update Complete

### Changes Made
| File | Action | Description |
|------|--------|-------------|
| kb/MODULES.md | ADD | Added Payment module section |
| kb/modules/payment.md | CREATE | New module architecture file (overview filled, sections 2-10 as TODO) |
| kb/modules/README.md | UPDATE | Added Payment to module index |
| kb/flows/checkout.md | CREATE | New E2E flow: user checkout and payment (overview + steps filled, rest as TODO) |
| kb/flows/README.md | UPDATE | Added checkout flow to index |
| kb/ARCHITECTURE.md | UPDATE | Updated source code structure and data flow |
| kb/contracts/payment.yaml | CREATE | New API contract for payment module |
| kb/GLOSSARY.md | ADD | Added terms: Payment, Transaction, Refund |
| kb/INDEX.md | UPDATE | Updated scope and last-updated date |

### Consistency Check
- ✅ No circular dependencies in MODULES.md
- ✅ All contracts referenced in MODULES.md exist
- ✅ Module architecture files exist for all modules in MODULES.md
- ✅ Glossary covers all new terms
- ⚠️ DESIGN.md doesn't mention Payment UI — consider updating
- ✅ All modules referenced in flows/ exist in MODULES.md

### Suggested Follow-ups
1. Run `/hoang-sdd-status` to verify KB health
2. Update `kb/DESIGN.md` with Payment page design
3. Assign a team member as module owner for `kb/modules/payment.md`
4. Assign a team member as flow owner for `kb/flows/checkout.md`
5. Run `/hoang-sdd-on [new feature]` to start SDD workflow for Payment
```

## Rules

- **Never delete existing KB content** — only ADD or UPDATE. If something is deprecated, mark it with a `> ⚠️ **Deprecated**` notice and reference the superseding content.
- **Cross-references are mandatory** — when you add a module, you MUST also create its `kb/modules/{name}.md` file and update any files that reference or are referenced by that module.
- **ADR ↔ Module files are linked** — when you create an ADR that affects a module, add it to that module file's "Related ADRs" field. When you update a module file's patterns, link the relevant ADR for the "why".
- **ADR ↔ Flow files are linked** — when you create an ADR that changes how modules interact in a flow, update the corresponding `kb/flows/{name}.md` to reflect the new behavior.
- **Flow ↔ Module files are linked** — when you add a business flow, verify all modules it references have `kb/modules/{name}.md` files. When you update a module's API or behavior, check `kb/flows/` for flows that reference it and update their steps.
- **ADR numbers are sequential** — always use the next available number.
- **Preserve file structure** — don't reorder sections or change the markdown structure of existing files.
- **Be specific** — "update architecture" is vague; specify exactly what sections changed.
- **After update, existing features in sdd_artifacts/ may need re-analysis** — flag this if the change affects already-specified features.
- **Module files are owned by team members** — when updating `kb/modules/{name}.md`, respect the existing owner assignment. If the owner field is `[unassigned]`, assign it now.
- **Flow files are owned by team members** — when updating `kb/flows/{name}.md`, respect the existing owner assignment. If the owner field is `[unassigned]`, assign it now.