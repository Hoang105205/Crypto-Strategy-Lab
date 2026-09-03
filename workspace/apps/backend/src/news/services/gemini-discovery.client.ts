// GeminiDiscoveryClient — Google Gemini API Client for LLM-Assisted CSS Selector Discovery
// Owner: Thuan | See: ADR-0014, kb/contracts/news.yaml, kb/modules/news-sentiment.md

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import {
  DiscoveredRule,
  DEFAULT_GEMINI_MODEL,
  GEMINI_DISCOVERY_TIMEOUT_MS,
} from '@crypto-strategy-lab/shared';

@Injectable()
export class GeminiDiscoveryClient {
  private readonly logger = new Logger(GeminiDiscoveryClient.name);
  private readonly apiKey = process.env.GEMINI_API_KEY;
  private readonly model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
  private readonly timeoutMs = process.env.GEMINI_DISCOVERY_TIMEOUT_MS
    ? parseInt(process.env.GEMINI_DISCOVERY_TIMEOUT_MS, 10)
    : GEMINI_DISCOVERY_TIMEOUT_MS;

  /**
   * Check if GEMINI_API_KEY is available in runtime environment
   */
  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Sends an HTML sample to Google Gemini LLM to discover semantic CSS selectors
   * Implements strict 10s timeout via AbortController and structured JSON response parsing.
   */
  async discoverSelectors(
    htmlSample: string,
    domain: string,
    targetUrl: string,
  ): Promise<DiscoveredRule> {
    if (!htmlSample || htmlSample.trim().length === 0) {
      throw new Error(`Empty HTML content provided for domain ${domain}`);
    }

    if (!this.isConfigured()) {
      this.logger.warn(
        `GEMINI_API_KEY is not configured. Falling back to Cheerio semantic heuristics for ${domain}.`,
      );
      throw new Error('GEMINI_API_KEY is missing');
    }

    const cleanHtml = this.sanitizeHtmlSample(htmlSample);
    const prompt = this.buildPrompt(cleanHtml, domain, targetUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    try {
      this.logger.log(
        `Sending DOM sample (${cleanHtml.length} chars) to Gemini LLM (${this.model}) for domain: ${domain}...`,
      );

      const response = await axios.post(
        apiUrl,
        {
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        },
        {
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          timeout: this.timeoutMs,
        },
      );

      clearTimeout(timer);

      const rawText =
        response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!rawText) {
        throw new Error(
          `Empty candidate text received from Gemini API for ${domain}`,
        );
      }

      const parsed = this.parseJsonOutput(rawText);

      const discoveredRule: DiscoveredRule = {
        domain,
        targetUrl,
        containerSelector:
          parsed.containerSelector || 'article, div.article-card',
        titleSelector: parsed.titleSelector || 'h2 a, h3 a, h2, h3',
        contentSelector:
          parsed.contentSelector || 'p.excerpt, p, div.description',
        linkSelector: parsed.linkSelector || 'a[href]',
        dateSelector: parsed.dateSelector || 'time, span.date',
      };

      this.logger.log(
        `Successfully discovered selectors via Gemini 2.5 Flash for ${domain}: container="${discoveredRule.containerSelector}", title="${discoveredRule.titleSelector}"`,
      );

      return discoveredRule;
    } catch (error) {
      clearTimeout(timer);
      const isAbort =
        error.name === 'AbortError' ||
        error.name === 'CanceledError' ||
        error.code === 'ECONNABORTED';

      if (isAbort) {
        this.logger.warn(
          `Gemini API request timed out after ${this.timeoutMs}ms for ${domain}. Fallback active.`,
        );
      } else {
        this.logger.warn(
          `Gemini API request failed for ${domain}: ${error.message}. Fallback active.`,
        );
      }
      throw error;
    }
  }

  /**
   * Sanitizes and truncates HTML document to fit within token budget (~25KB)
   */
  private sanitizeHtmlSample(rawHtml: string): string {
    const stripped = rawHtml
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ');

    return stripped.slice(0, 25000);
  }

  /**
   * Constructs strict prompt for CSS selector discovery
   */
  private buildPrompt(
    htmlSample: string,
    domain: string,
    targetUrl: string,
  ): string {
    return `You are an expert web scraping and CSS selector extraction AI.
Analyze the following HTML sample of the crypto news website "${domain}" (${targetUrl}).
Identify the optimal CSS selectors for extracting repeating news articles.

Return a valid JSON object matching this schema:
{
  "containerSelector": "CSS selector for repeating article cards (e.g. article, div.news-card, div.article-card)",
  "titleSelector": "CSS selector for article headline inside container (e.g. h2 a, h3 a, a.post-title)",
  "contentSelector": "CSS selector for excerpt/summary inside container (e.g. p.excerpt, p, div.description)",
  "linkSelector": "CSS selector for article link (e.g. a[href], a.story-link)",
  "dateSelector": "CSS selector for publish date/time (e.g. time, span.date, span.post-date)"
}

HTML SAMPLE:
${htmlSample}`;
  }

  /**
   * Parses JSON string safely with markdown code-block cleanup
   */
  private parseJsonOutput(raw: string): Partial<DiscoveredRule> {
    const cleaned = raw.replace(/```json\s*|```/g, '').trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      // Fallback regex extraction if JSON is partially corrupted
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      throw new Error('Failed to parse structured JSON from Gemini response');
    }
  }
}
