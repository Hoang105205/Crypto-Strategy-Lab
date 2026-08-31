# Data Model: Gemini LLM Web Crawler Selector Discovery

## Entity Relationship Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                    GeminiDiscoveryClient                    │
│ Input: HTML Sample + Domain + Target URL                     │
│ Output: DiscoveredRule DTO                                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   CrawlerDiscoveryService                   │
│ (Orchestrator with Cheerio Heuristics Fallback)              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ Persists in DB
┌─────────────────────────────────────────────────────────────┐
│                 PostgreSQL: `CrawlerRule`                   │
│ • id: UUID (PK)                                             │
│ • domain: String (Unique)                                   │
│ • targetUrl: String                                         │
│ • containerSelector: String                                 │
│ • titleSelector: String                                     │
│ • contentSelector: String                                   │
│ • linkSelector: String                                      │
│ • dateSelector: String                                      │
│ • isActive: Boolean (default: true)                         │
│ • lastDiscoveredAt: DateTime                                │
└─────────────────────────────────────────────────────────────┘
```

## DTO Definitions

### `DiscoveredRule` (In-Memory DTO / Interface)
| Field | Type | Description |
|---|---|---|
| `domain` | `string` | Target domain (e.g. `theblock.co`, `cryptoslate.com`) |
| `targetUrl` | `string` | Target scraping URL (e.g. `https://theblock.co/latest`) |
| `containerSelector` | `string` | CSS selector for the repeating article card element |
| `titleSelector` | `string` | CSS selector for the headline title relative to container |
| `contentSelector` | `string` | CSS selector for the summary/excerpt relative to container |
| `linkSelector` | `string` | CSS selector for the article link `<a>` tag |
| `dateSelector` | `string` | CSS selector for publication date/time element |

### `GeminiDiscoveryConfig` (Environment Configuration)
| Parameter | Env Variable | Default | Description |
|---|---|---|---|
| `apiKey` | `GEMINI_API_KEY` | `undefined` | Google AI Studio Gemini API Key |
| `model` | `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model name |
| `timeoutMs` | `GEMINI_DISCOVERY_TIMEOUT_MS` | `10000` | SLA request timeout in milliseconds |
