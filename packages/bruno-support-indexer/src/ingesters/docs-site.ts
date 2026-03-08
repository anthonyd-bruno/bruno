import { createHash } from 'crypto';

import { type SourceDocument } from '../types/source-document';
import { TrustTier } from '../types/trust-tier';

const DEFAULT_BASE_URL = 'https://docs.usebruno.com';
const DEFAULT_MAX_PAGES = 500;
const DEFAULT_MAX_DEPTH = 5;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 50;
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503]);
const TAGS_TO_STRIP = ['script', 'style', 'nav', 'header', 'footer'];

interface FetchResult {
  html: string;
  lastModified: Date;
}

interface CrawlTarget {
  url: string;
  depth: number;
}

interface ParsedPage {
  canonicalUrl: string;
  title: string;
  content: string;
  headings: string[];
  lastModified: Date;
}

export interface DocsSiteIngesterConfig {
  baseUrl?: string;
  maxPages?: number;
  maxDepth?: number;
}

export class DocsSiteIngester {
  private readonly baseUrl: URL;
  private readonly maxPages: number;
  private readonly maxDepth: number;

  constructor(config: DocsSiteIngesterConfig = {}) {
    this.baseUrl = new URL(config.baseUrl ?? DEFAULT_BASE_URL);
    this.maxPages = config.maxPages ?? DEFAULT_MAX_PAGES;
    this.maxDepth = config.maxDepth ?? DEFAULT_MAX_DEPTH;
  }

  async ingest(): Promise<SourceDocument[]> {
    const startUrl = this.normalizeUrl(this.baseUrl);
    const queue: CrawlTarget[] = [{ url: startUrl, depth: 0 }];
    const queuedUrls = new Set<string>([startUrl]);
    const visitedUrls = new Set<string>();
    const documentsByCanonicalUrl = new Map<string, SourceDocument>();
    const lastSeen = new Date();

    while (queue.length > 0 && visitedUrls.size < this.maxPages) {
      const current = queue.shift();

      if (!current || current.depth > this.maxDepth || visitedUrls.has(current.url)) {
        continue;
      }

      visitedUrls.add(current.url);

      const { html, lastModified } = await this.fetchHtml(current.url);
      const parsedPage = this.parsePage(html, current.url, lastModified);

      if (parsedPage) {
        const document = this.toSourceDocument(parsedPage, current.depth, lastSeen);
        const existingDocument = documentsByCanonicalUrl.get(parsedPage.canonicalUrl);

        if (!existingDocument || document.lastModified > existingDocument.lastModified) {
          documentsByCanonicalUrl.set(parsedPage.canonicalUrl, document);
        }
      }

      if (current.depth >= this.maxDepth) {
        continue;
      }

      this.extractLinks(html, current.url).forEach((link) => {
        if (visitedUrls.has(link) || queuedUrls.has(link)) {
          return;
        }

        queuedUrls.add(link);
        queue.push({ url: link, depth: current.depth + 1 });
      });
    }

    return Array.from(documentsByCanonicalUrl.values());
  }

  private async fetchHtml(url: string): Promise<FetchResult> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      const response = await fetch(url);

      if (response.ok) {
        return {
          html: await response.text(),
          lastModified: this.parseLastModified(response.headers.get('last-modified'))
        };
      }

      if (TRANSIENT_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
        await this.delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }

      throw new Error(`Docs site request failed with status ${response.status} for ${url}`);
    }

    throw new Error(`Docs site request failed after ${MAX_RETRIES} attempts for ${url}`);
  }

  private parsePage(html: string, pageUrl: string, lastModified: Date): ParsedPage | null {
    const canonicalUrl = this.extractCanonicalUrl(html, pageUrl);
    const title = this.extractTitle(html, canonicalUrl);
    const headings = this.extractHeadings(html);
    const content = this.extractContent(html);

    if (!title && !content) {
      return null;
    }

    return {
      canonicalUrl,
      title: title || canonicalUrl,
      content,
      headings,
      lastModified
    };
  }

  private extractCanonicalUrl(html: string, pageUrl: string): string {
    const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];

    for (const tag of linkTags) {
      const rel = this.getAttributeValue(tag, 'rel');
      const href = this.getAttributeValue(tag, 'href');

      if (!rel || !href) {
        continue;
      }

      if (rel.toLowerCase().split(/\s+/).includes('canonical')) {
        try {
          return this.normalizeUrl(new URL(href, pageUrl));
        } catch {
          break;
        }
      }
    }

    return this.normalizeUrl(pageUrl);
  }

  private extractTitle(html: string, fallback: string): string {
    const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);

    if (h1Match?.[1]) {
      return this.toPlainText(h1Match[1]);
    }

    const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);

    if (titleMatch?.[1]) {
      return this.toPlainText(titleMatch[1]);
    }

    return fallback;
  }

  private extractHeadings(html: string): string[] {
    const headings: string[] = [];
    const headingPattern = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
    let match = headingPattern.exec(html);

    while (match) {
      const id = this.getAttributeValue(match[2], 'id');

      if (id) {
        headings.push(`#${id}`);
      }

      match = headingPattern.exec(html);
    }

    return headings;
  }

  private extractContent(html: string): string {
    let normalizedHtml = html.replace(/<!--[\s\S]*?-->/g, ' ');

    TAGS_TO_STRIP.forEach((tagName) => {
      normalizedHtml = normalizedHtml.replace(
        new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gi'),
        ' '
      );
    });

    return this.toPlainText(normalizedHtml);
  }

  private extractLinks(html: string, pageUrl: string): string[] {
    const links = new Set<string>();
    const anchorTags = html.match(/<a\b[^>]*>/gi) ?? [];

    anchorTags.forEach((tag) => {
      const href = this.getAttributeValue(tag, 'href');

      if (!href) {
        return;
      }

      try {
        const candidate = new URL(href, pageUrl);

        if (!['http:', 'https:'].includes(candidate.protocol) || !this.isInternalUrl(candidate)) {
          return;
        }

        links.add(this.normalizeUrl(candidate));
      } catch {
        // Ignore malformed URLs.
      }
    });

    return Array.from(links);
  }

  private toSourceDocument(parsedPage: ParsedPage, depth: number, lastSeen: Date): SourceDocument {
    const contentHash = createHash('sha256').update(parsedPage.content).digest('hex');

    return {
      id: `docs-site-${createHash('sha256').update(parsedPage.canonicalUrl).digest('hex')}`,
      sourceType: 'docs_site',
      url: parsedPage.canonicalUrl,
      title: parsedPage.title,
      content: parsedPage.content,
      contentHash,
      trustTier: TrustTier.OfficialDocs,
      lastModified: parsedPage.lastModified,
      lastSeen,
      metadata: {
        canonical_url: parsedPage.canonicalUrl,
        headings: parsedPage.headings,
        depth,
        content_hash: contentHash,
        last_seen: lastSeen.toISOString()
      }
    };
  }

  private getAttributeValue(tag: string, attributeName: string): string | undefined {
    const attributePattern = new RegExp(
      `${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      'i'
    );
    const match = tag.match(attributePattern);

    return match?.[1] ?? match?.[2] ?? match?.[3];
  }

  private toPlainText(html: string): string {
    return this.decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  }

  private decodeHtmlEntities(text: string): string {
    const namedEntities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&nbsp;': ' '
    };

    return text
      .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/gi, (match) => namedEntities[match.toLowerCase()] ?? match)
      .replace(/&#([0-9]+);/g, (_, codePoint) => String.fromCodePoint(Number(codePoint)))
      .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) => String.fromCodePoint(parseInt(codePoint, 16)));
  }

  private isInternalUrl(url: URL): boolean {
    return url.hostname === this.baseUrl.hostname;
  }

  private normalizeUrl(url: string | URL): string {
    const normalized = new URL(url.toString());

    normalized.hash = '';

    if ((normalized.protocol === 'https:' && normalized.port === '443') || normalized.port === '80') {
      normalized.port = '';
    }

    if (normalized.pathname !== '/') {
      normalized.pathname = normalized.pathname.replace(/\/+$/, '') || '/';
    }

    return normalized.toString();
  }

  private parseLastModified(lastModifiedHeader: string | null): Date {
    if (!lastModifiedHeader) {
      return new Date();
    }

    const parsedDate = new Date(lastModifiedHeader);

    if (Number.isNaN(parsedDate.getTime())) {
      return new Date();
    }

    return parsedDate;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}