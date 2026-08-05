# Contributing Guide

## Git Workflow
- **Branch naming**: `[feature|fix|chore]/[module]-[short-description]`
  (e.g., `feature/strategy-engine-macd`, `fix/market-data-reconnect`)
- **Commit messages**: Conventional Commits format
  - `feat(strategy): add MACDStrategy`
  - `fix(market-data): handle WebSocket disconnect`
  - `chore(deps): update dependencies`
- **PR process**: Open PR to `develop` → Hoàng reviews architecture-impacting PRs → merge after review

## Code Style
- **Backend (NestJS)**: ESLint + Prettier, TypeScript strict mode
- **Frontend (Next.js)**: ESLint + Prettier, TypeScript strict mode
- **Shared**: All cross-module interfaces live in `shared/` — never redefine locally

## Review Checklist
- [ ] Code follows style guidelines
- [ ] No hardcoded secrets or credentials (API keys in `.env` only)
- [ ] Error handling covers edge cases (adapter failure, service down)
- [ ] Logging is adequate but not verbose
- [ ] `kb/contracts/` updated if any API/interface changed
- [ ] GLOSSARY terms used consistently
- [ ] Cross-references maintained (`kb/modules/`, `kb/flows/`, `kb/ADR/`)

## Testing Standards
- **Unit tests**: Required for business logic (strategies, evaluator, combiners)
- **Integration tests**: Required for API endpoints
- **E2E tests**: Optional — the W4 extensibility scenarios serve as the E2E proof

## Documentation Standards
- Every API endpoint documented in `kb/contracts/`
- Every ADR has Status, Context, Decision, and Consequences sections
- Every module file (`kb/modules/{name}.md`) kept current with implementation
- Every E2E flow (`kb/flows/{name}.md`) reflects the actual cross-module behavior
- GLOSSARY.md is the authority on terminology
