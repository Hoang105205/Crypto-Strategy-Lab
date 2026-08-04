---
name: hoang-kb-explain
description: "hoang-kb Explain — explains any KB file or cross-references between KB files. Reads the KB and provides a human-readable summary of architecture, modules, glossary terms, contracts, or ADRs. Use when user asks 'explain the architecture', 'what does X mean', 'how does module Y work', or 'show me the KB'."
allowed-tools: Read, Bash(find *), Bash(ls *)
---

# hoang-kb Explain

Explain any part of the Knowledge Base in human-readable terms.

## User Input

```
$ARGUMENTS
```

Examples:
- (empty) → explain the entire KB overview
- "architecture" → explain `kb/ARCHITECTURE.md`
- "modules" → explain `kb/MODULES.md`
- "auth module" or "module X" → explain `kb/modules/X.md` (component architecture, patterns, flows)
- "X patterns" → explain design patterns in `kb/modules/X.md`
- "checkout flow" or "X flow" → explain `kb/flows/X.md` (E2E business scenario, steps, business rules)
- "flows" → explain all `kb/flows/` (index of all E2E business scenarios)
- "what does [term] mean" → look up in `kb/GLOSSARY.md`
- "how does [module] connect to [module]" → trace cross-references in `kb/MODULES.md` + `kb/modules/` + `kb/flows/`
- "what decisions were made" → summarize `kb/ADR/`
- "contracts" → explain all `kb/contracts/`
- "design" → explain `kb/DESIGN.md`
- "constitution" → explain `kb/CONSTITUTION.md`

## Execution

### 1. Load KB Index

Always start by reading `kb/INDEX.md` to understand what KB files exist and their reading order.

If `kb/INDEX.md` doesn't exist, tell the user to run `/hoang-kb-init` first.

### 2. Parse the Query

Analyze the user's argument to determine which KB file(s) to read:

| Query Pattern | Files to Read |
|--------------|---------------|
| (empty or "overview") | INDEX.md only → high-level summary |
| "architecture" or "arch" | ARCHITECTURE.md |
| "modules" or "module X" | MODULES.md + `modules/X.md` (if exists) |
| "flows" or "X flow" | `flows/README.md` + `flows/X.md` (if exists) |
| "design" or "frontend" or "UI" | DESIGN.md |
| "glossary" or "what does X mean" | GLOSSARY.md |
| "constitution" or "principles" or "rules" | CONSTITUTION.md |
| "contributing" or "standards" or "conventions" | CONTRIBUTING.md |
| "decisions" or "ADR" or "ADR-N" | ADR/ (specific ADR if number given) |
| "contracts" or "API" | contracts/ (all files) |
| "patterns" | patterns/ (all files) |
| "how does X connect to Y" | MODULES.md + ARCHITECTURE.md + `modules/` + `flows/` + contracts/ |
| "module X architecture" or "X patterns" | `modules/X.md` + cross-ref ADR/ |
| "X flow" or "how does [scenario] work" | `flows/X.md` + `modules/` (referenced) + contracts/ |

### 3. Read and Explain

For each relevant file:
1. Read the full content
2. Summarize in clear, structured language
3. Cross-reference related KB files when relevant
4. Highlight any gaps or inconsistencies found

### 4. Output Format

```markdown
## 📖 KB Explanation: [Topic]

### Source File
`kb/[file].md`

### Summary
[Clear, concise explanation in plain language]

### Key Points
- **Point 1**: [explanation]
- **Point 2**: [explanation]
- **Point 3**: [explanation]

### Cross-References
- Related: `kb/[other-file].md` — [how it's related]
- ADR: `kb/ADR/000X-[title].md` — [relevant decision]

### Gaps Detected (if any)
- ⚠️ [gap description] — consider updating via `/hoang-kb-update`
```

### 5. Special Case: Per-Module Architecture ("module X" or "X patterns")

When the user asks about a specific module's architecture:
1. Read `kb/MODULES.md` to find the module entry (boundaries, dependencies)
2. Read `kb/modules/{name}.md` for the detailed architecture (components, patterns, flows)
3. Read any ADRs listed in the module file's "Related ADRs" field
4. Read `kb/contracts/` for the module's API surface
5. Present:
   - Module responsibility and boundaries (from MODULES.md)
   - Component breakdown (from module file)
   - Design patterns used + rationale (from module file, cross-ref ADRs)
   - Internal data flow and key sequence diagrams
   - Quality attributes (security, performance, error handling)
   - Testing strategy
   - Any open questions / TODOs

If `kb/modules/{name}.md` doesn't exist, say so and suggest running `/hoang-kb-update` to create it.

### 6. Special Case: E2E Business Flow ("X flow" or "how does [scenario] work?")

When the user asks about a specific business flow:
1. Read `kb/flows/README.md` to find the flow entry
2. Read `kb/flows/{name}.md` for the detailed E2E scenario
3. Read `kb/MODULES.md` to understand the modules involved
4. Read `kb/modules/{name}.md` for each module involved (if exists) — to show what each module does in the flow
5. Read any contracts referenced in the flow's steps
6. Read any ADRs referenced in the flow's "Related" section
7. Present:
   - Flow overview (description, primary actor, business value)
   - Preconditions
   - Step-by-step flow with module interactions
   - Postconditions
   - Alternative paths and error/exception flows
   - Business rules governing the flow
   - Cross-references to contracts, ADRs, and module architecture files

If `kb/flows/{name}.md` doesn't exist, say so and suggest running `/hoang-kb-update` to create it.

### 7. Special Case: "How does X connect to Y?"

When the user asks about cross-module relationships:
1. Read `kb/MODULES.md` to find both modules
2. Check their "Depends On" and "Exposes" fields
3. Read `kb/modules/X.md` and `kb/modules/Y.md` for their API surfaces
4. Read `kb/contracts/` for API contracts between them
5. Check `kb/flows/` for any E2E flows that show both modules interacting — read the relevant flow steps
6. Trace the data flow from Module X → Contract → Module Y
7. Present a connection diagram (text-based):

```
[Module X] --[Contract/Interface]--> [Module Y]
   |                                      |
   ├── Exposes: [service]                ├── Exposes: [service]
   └── Depends: [Module Y.service]       └── Depends: [Module X.event]
```

## Rules

- **Always read the actual files** — never fabricate KB content.
- **If a file doesn't exist**, say so explicitly and suggest `/hoang-kb-update` to create it.
- **For module queries**, always check both `kb/MODULES.md` (boundaries) and `kb/modules/{name}.md` (detailed architecture). If the detailed file doesn't exist yet, explain what's in MODULES.md and flag the missing file.
- **For flow queries**, always check both `kb/flows/README.md` (index) and `kb/flows/{name}.md` (detailed flow). If the detailed file doesn't exist yet, explain what's available and flag the missing file.
- **When explaining modules**, also check `kb/flows/` for any E2E scenarios that involve the module — this gives context on how the module participates in business use cases.
- **Use GLOSSARY terms** when explaining — if the glossary defines a term, use that exact definition.
- **Be concise** — the user wants understanding, not a document dump.
- **Flag inconsistencies** — if ARCHITECTURE.md says "microservices" but MODULES.md shows "monolith", flag it.