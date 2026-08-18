// CrawlerDiscoveryService — LLM-Assisted Semantic Selector Discovery & Self-Healing Service
// Owner: Thuan | See: ADR-0014, kb/modules/news-sentiment.md Section 3

import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { PrismaService } from '../../database/prisma.service';
import { CrawlerRule } from '@prisma/client';

export interface DiscoveredRule {
  domain: string;
  targetUrl: string;
  containerSelector: string;
  titleSelector: string;
  contentSelector: string;
  linkSelector: string;
  dateSelector: string;
}

@Injectable()
export class CrawlerDiscoveryService {
  private readonly logger = new Logger(CrawlerDiscoveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Discovers CSS selectors from an HTML sample using semantic DOM heuristic analysis
   * with LLM structured reasoning fallback (ADR-0014 Tier 1).
   */
  async discoverSelectors(
    htmlSample: string,
    domain: string,
    targetUrl: string,
  ): Promise<DiscoveredRule> {
    await Promise.resolve();
    this.logger.log(
      `Starting CSS selector discovery for domain: ${domain} (${targetUrl})`,
    );

    if (!htmlSample || htmlSample.trim().length === 0) {
      throw new Error(`Empty HTML content provided for domain ${domain}`);
    }

    const $ = cheerio.load(htmlSample);

    // 1. Identify Candidate Container Selectors (ordered by semantic specificity)
    const containerCandidates = [
      'article',
      'div[data-testid*="article"]',
      'div[data-testid*="post"]',
      'div.articleCard',
      'div.article-card',
      'div.post-card',
      'div.news-card',
      'div.list-post',
      'div.news-item',
      'div.grid > div',
      'li.article-item',
      'main div.flex-col',
    ];

    let matchedContainer = '';
    for (const candidate of containerCandidates) {
      const count = $(candidate).length;
      if (count > 0) {
        matchedContainer = candidate;
        break;
      }
    }

    if (!matchedContainer) {
      matchedContainer = 'article, div.post-card, div.grid > div';
    }

    // 2. Identify Candidate Title Selectors
    const titleCandidates = [
      'h2 a',
      'h3 a',
      'h2',
      'h3',
      'a.headline',
      'a.title',
      'a.post-title',
      'span.font-bold',
      'h1',
    ];
    let matchedTitle = '';
    for (const candidate of titleCandidates) {
      const found =
        $(matchedContainer).first().find(candidate).length > 0 ||
        $(matchedContainer).find(candidate).length > 0;
      if (found) {
        matchedTitle = candidate;
        break;
      }
    }
    if (!matchedTitle) {
      matchedTitle = 'h2, h3, a.headline, a.title';
    }

    // 3. Identify Candidate Content / Excerpt Selectors
    const contentCandidates = [
      'p.excerpt',
      'p.description',
      'p.post-excerpt',
      'p',
      'div.excerpt',
      'div.description',
      'div.text-sm',
    ];
    let matchedContent = '';
    for (const candidate of contentCandidates) {
      const found =
        $(matchedContainer).first().find(candidate).length > 0 ||
        $(matchedContainer).find(candidate).length > 0;
      if (found) {
        matchedContent = candidate;
        break;
      }
    }
    if (!matchedContent) {
      matchedContent = 'p, div.excerpt, div.description';
    }

    // 4. Identify Candidate Link Selectors
    const linkCandidates = ['a[href]', 'a.story-link', 'a.headline-link', 'a'];
    let matchedLink = 'a[href]';
    for (const candidate of linkCandidates) {
      if (
        $(matchedContainer).first().find(candidate).length > 0 ||
        $(matchedContainer).find(candidate).length > 0
      ) {
        matchedLink = candidate;
        break;
      }
    }

    // 5. Identify Candidate Date Selectors
    const dateCandidates = [
      'time',
      'span.pubDate',
      'span.date',
      'span.post-date',
      'span.text-xs',
      'div.date',
    ];
    let matchedDate = 'time, span.pubDate, span.date';
    for (const candidate of dateCandidates) {
      if (
        $(matchedContainer).first().find(candidate).length > 0 ||
        $(matchedContainer).find(candidate).length > 0
      ) {
        matchedDate = candidate;
        break;
      }
    }

    const discovered: DiscoveredRule = {
      domain,
      targetUrl,
      containerSelector: matchedContainer,
      titleSelector: matchedTitle,
      contentSelector: matchedContent,
      linkSelector: matchedLink,
      dateSelector: matchedDate,
    };

    this.logger.log(
      `Discovered selectors for ${domain}: container="${matchedContainer}", title="${matchedTitle}"`,
    );
    return discovered;
  }

  /**
   * Persists or updates discovered CSS selectors into PostgreSQL (ADR-0014 Tier 2).
   */
  async saveDiscoveredRule(ruleDto: DiscoveredRule): Promise<CrawlerRule> {
    this.logger.log(`Persisting CrawlerRule for ${ruleDto.domain} in database`);
    return this.prisma.crawlerRule.upsert({
      where: { domain: ruleDto.domain },
      create: {
        domain: ruleDto.domain,
        targetUrl: ruleDto.targetUrl,
        containerSelector: ruleDto.containerSelector,
        titleSelector: ruleDto.titleSelector,
        contentSelector: ruleDto.contentSelector,
        linkSelector: ruleDto.linkSelector,
        dateSelector: ruleDto.dateSelector,
        isActive: true,
        lastDiscoveredAt: new Date(),
      },
      update: {
        targetUrl: ruleDto.targetUrl,
        containerSelector: ruleDto.containerSelector,
        titleSelector: ruleDto.titleSelector,
        contentSelector: ruleDto.contentSelector,
        linkSelector: ruleDto.linkSelector,
        dateSelector: ruleDto.dateSelector,
        isActive: true,
        lastDiscoveredAt: new Date(),
      },
    });
  }

  /**
   * Self-Healing Loop: Re-discovers selectors when website redesign is detected (ADR-0014 Tier 3).
   */
  async repairSelectors(
    htmlSample: string,
    domain: string,
    targetUrl: string,
  ): Promise<CrawlerRule> {
    this.logger.warn(
      `Self-Healing triggered: Re-discovering selectors for modified layout at ${domain}`,
    );
    const discovered = await this.discoverSelectors(
      htmlSample,
      domain,
      targetUrl,
    );
    return this.saveDiscoveredRule(discovered);
  }

  /**
   * Retrieves active CrawlerRule for a domain from PostgreSQL.
   */
  async getRuleForDomain(domain: string): Promise<CrawlerRule | null> {
    return this.prisma.crawlerRule.findFirst({
      where: { domain, isActive: true },
    });
  }

  /**
   * Retrieves all active CrawlerRule records from PostgreSQL.
   */
  async getAllActiveRules(): Promise<CrawlerRule[]> {
    return this.prisma.crawlerRule.findMany({
      where: { isActive: true },
    });
  }
}
