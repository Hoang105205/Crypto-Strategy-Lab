# Contract: Gemini LLM Selector Discovery

## Internal Client Contract: `GeminiDiscoveryClient`

### Method: `discoverSelectors(htmlSample: string, domain: string, targetUrl: string): Promise<DiscoveredRule>`

**Inputs**:
- `htmlSample`: `string` (raw HTML document or DOM slice, min 50 chars)
- `domain`: `string` (e.g. `'theblock.co'`)
- `targetUrl`: `string` (e.g. `'https://theblock.co/latest'`)

**Outputs**:
```typescript
interface DiscoveredRule {
  domain: string;
  targetUrl: string;
  containerSelector: string;
  titleSelector: string;
  contentSelector: string;
  linkSelector: string;
  dateSelector: string;
}
```

**External REST Payload sent to Gemini**:
- **Endpoint**: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`
- **Request Body**:
```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "SYSTEM INSTRUCTION & DOM SNIPPET..."
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.1,
    "responseMimeType": "application/json"
  }
}
```

**Error Handling**:
- Missing `GEMINI_API_KEY` $\rightarrow$ Throws `GeminiKeyMissingException` (caught by `CrawlerDiscoveryService` to trigger Cheerio fallback).
- Request Timeout (>10s) $\rightarrow$ `AbortController` triggers abort, caught by service to execute fallback.
- HTTP 429/500/503 $\rightarrow$ Logs warning, caught by service to execute fallback.
