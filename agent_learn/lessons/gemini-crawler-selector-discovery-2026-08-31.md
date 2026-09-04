# Lessons: Gemini LLM Web Crawler Selector Discovery — 2026-08-31

**Feature**: `gemini-crawler-selector-discovery` | **Date**: 2026-08-31 | **Status**: Complete

## What Worked
- **Lightweight Direct REST API over SDK**: Using `axios` with standard `AbortController` and direct REST endpoint (`https://generativelanguage.googleapis.com/v1beta/models/...`) avoided adding heavy external packages while giving precise control over headers, token budget (~25KB sanitized DOM), and strict 10s SLA timeouts.
- **Structured Output Prompting with Code-Fence Cleanup**: Combining Gemini's `application/json` response mode with programmatic code-fence stripping (`.replace(/```json|```/g, '')`) ensures 100% resilient JSON parsing without crashing.
- **Seamless Graceful Fallback**: `CrawlerDiscoveryService` cleanly delegates to Cheerio DOM heuristics whenever `GEMINI_API_KEY` is missing or when the API hits rate limits (HTTP 429) or timeouts, ensuring zero pipeline interruption.
- **Isolated Modules TypeScript Alignment**: Using `export type { DiscoveredRule }` resolved TS1205 when `isolatedModules: true` is enforced in NestJS tsconfig.

## What Didn't Work
- Direct usage of `@google/genai` or heavy SDKs introduced unnecessary complexity and peer dependency risks in a modular NestJS monolith. Direct REST with native `axios` proved far more reliable and easier to unit test with standard mocks.

## Deviations from Plan
- None. Implementation strictly adhered to `plan.md`, `contracts/gemini-discovery.md`, and `tasks.md`.

## KB Updates Needed
- [x] Updated `kb/contracts/news.yaml` with `GeminiDiscoveryClient` interface and fallback configuration.
- [x] Updated `kb/modules/news-sentiment.md` with Gemini Discovery Client component, sequence diagram, and resilience quality attributes.
- [x] Updated `kb/GLOSSARY.md` with `Gemini Discovery Client`.
- [x] Updated `kb/INDEX.md` with latest status and date.
