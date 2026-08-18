# Research & Technical Decisions: `adaptive-news-crawler`

## 1. Decisions & Rationale

### D1: HTML Parsing Library — Cheerio vs Puppeteer/Playwright
- **Options Considered**:
  1. *Headless Browser (Puppeteer/Playwright)*: Can execute client-side JavaScript, but has enormous memory overhead (>150MB per process), slow cold boot (1–3s), and requires heavy browser binaries.
  2. *Lightweight DOM Parser (`cheerio`)*: Fast C++/Node parser implementing jQuery-like syntax. Extremely lightweight (<1MB), parse time < 5ms for standard HTML documents.
- **Decision**: **Cheerio** (`cheerio`).
- **Rationale**: Crypto news index pages (like `decrypt.co/news`, `coindesk.com`) provide fully server-rendered HTML for search engine indexing. Cheerio provides sub-50ms extraction with minimal CPU/RAM footprint, perfectly aligning with our high-frequency cron scheduler.

### D2: LLM Discovery Integration Pattern
- **Options Considered**:
  1. *External API call to Gemini 2.5 Flash / OpenAI*: Fast semantic reasoning, excellent at structured JSON output for CSS selectors.
  2. *Self-contained Heuristic Discovery Engine with LLM Fallback*: Uses semantic heuristics for standard semantic tags (`article`, `h1-h3`, `time`, `a[href]`) combined with configurable LLM prompt.
- **Decision**: **Heuristic + LLM Provider Strategy**.
- **Rationale**: Provides robust zero-config offline discovery with intelligent fallback, while supporting live LLM API keys via environment variables (`GEMINI_API_KEY` / `OPENAI_API_KEY`).

### D3: Database Selector Schema (`CrawlerRule`)
- **Decision**: Persist individual selector fields (`containerSelector`, `titleSelector`, `contentSelector`, `linkSelector`, `dateSelector`) as string columns in PostgreSQL.
- **Rationale**: Avoids opaque JSON string parsing in queries and allows granular inspection and admin overrides via Prisma Studio if needed.

### D4: Self-Healing Trigger Condition
- **Decision**: Trigger self-healing re-discovery when an active `CrawlerRule` produces 0 articles from a non-empty HTML response (status 200).
- **Rationale**: A successful HTTP 200 response returning 0 items is the classic signature of an upstream HTML/CSS class redesign.
