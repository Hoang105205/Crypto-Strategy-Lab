# Research: Gemini LLM Web Crawler Selector Discovery & Self-Healing

## Decisions

### D1: Gemini API Communication Method (Direct REST vs SDK)
- **Chosen**: Direct REST API via `axios` (`POST https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`)
- **Rationale**:
  - `axios` is already a core dependency in `@crypto-strategy-lab/backend`.
  - Avoids adding `@google/genai` or `@google/generative-ai` package overhead or peer dependency conflicts.
  - Direct control over payload truncation, headers, and strict 10s request abort timeout via standard `AbortController`.
- **Alternatives considered**:
  - `@google/genai` or `@google/generative-ai`: Heavier package footprint, unnecessary for a single focused endpoint call.
- **KB reference**: `kb/CONSTITUTION.md` Art IV (Simplicity over cleverness).

### D2: Prompt Engineering & Structured Output Format
- **Chosen**: JSON Mode / Strict Structured Output system prompt requesting strict JSON adhering to `DiscoveredRule` interface without markdown code fences (````json...````).
- **Prompt Details**:
  - Instructions: "Analyze this HTML sample of a crypto news website. Identify the CSS selectors for news articles."
  - Keys required: `containerSelector`, `titleSelector`, `contentSelector`, `linkSelector`, `dateSelector`.
  - Provide fallback cleansing (`jsonString.replace(/```json|```/g, '').trim()`) in case LLM wraps response in code blocks.
- **KB reference**: `kb/contracts/news.yaml` (`DiscoveredRule`).

### D3: HTML Truncation & Token Optimization
- **Chosen**: Clean and truncate the input HTML sample (remove `<script>`, `<style>`, `<svg>`, comments) and take the first 25,000 characters before sending to Gemini.
- **Rationale**: Keeps request latency under 1.5s, reduces token cost to negligible amounts, while preserving full semantic DOM tree structure of article cards.

### D4: Graceful Degradation Strategy
- **Chosen**: Multi-tier fallback in `CrawlerDiscoveryService`:
  1. If `GEMINI_API_KEY` is present and valid, call `GeminiDiscoveryClient.discoverSelectors()`.
  2. If `GeminiDiscoveryClient` fails (missing key, network timeout >10s, rate limit 429, or invalid JSON), log a warning and delegate directly to internal `cheerio` semantic heuristic discovery.
  3. Return a fully populated `DiscoveredRule` in all circumstances.
- **KB reference**: `kb/modules/news-sentiment.md` Section 8 (AI Resilience & Graceful Fallback).
