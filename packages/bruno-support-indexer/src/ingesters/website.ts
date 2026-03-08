import { createHash } from 'crypto';

import { type SourceDocument } from '../types/source-document';
import { TrustTier } from '../types/trust-tier';

const DEFAULT_BASE_URL = 'https://www.usebruno.com';
const DEFAULT_TARGET_PATHS = ['/', '/pricing', '/downloads', '/changelog', '/support', '/about', '/roadmap', '/terms', '/privacy'];
const DEFAULT_MAX_PAGES = 100;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 50;
const TRANSIENT_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const HIGH_FRESHNESS_PATHS = ['/downloads', '/changelog', '/pricing'];
const NON_HTML_FILE_EXTENSION_PATTERN = /\.(?:apng|avif|bmp|css|csv|docx?|eot|gif|ico|jpe?g|js|json|mjs|mp4|pdf|png|svg|tgz|txt|webm|webp|woff2?|xml|zip|dmg|exe|pkg)$/i;
const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' '
};

interface CrawledPage {
  dedupKey: string;
  canonicalUrl: string;
  pagePath: string;
  title: string;
  content: string;
  lastModified: Date;
  links: string[];
}

export interface WebsiteIngesterConfig {
  baseUrl?: string;
  targetPaths?: string[];
  maxPages?: number;
}

export class WebsiteIngester {
  private readonly baseUrl: string;
  private readonly targetPaths: string[];
  private readonly maxPages: number;
  private readonly baseHostname: string;

  constructor(config: WebsiteIngesterConfig = {}) {
    this.baseUrl = this.normalizeUrl(config.baseUrl ?? DEFAULT_BASE_URL);
    this.targetPaths = config.targetPaths ?? DEFAULT_TARGET_PATHS;
    this.maxPages = config.maxPages ?? DEFAULT_MAX_PAGES;
    this.baseHostname = this.normalizeHostname(new URL(this.baseUrl).hostname);
  }

  async ingest(): Promise<SourceDocument[]> {
    const lastSeen = new Date();
    const documentsByKey = new Map<string, SourceDocument>();
    const queue = Array.from(
      new Set(this.targetPaths.map((targetPath) => this.normalizeUrl(new URL(targetPath, this.baseUrl).toString())))
    );
    const queued = new Set(queue);
    const visited = new Set<string>();

    while (queue.length > 0 && visited.size < this.maxPages) {
      const currentUrl = queue.shift();

      if (!currentUrl) {
        break;
      }

      queued.delete(currentUrl);

      if (visited.has(currentUrl)) {
        continue;
      }

      visited.add(currentUrl);

      const page = await this.crawlPage(currentUrl, lastSeen);
      const document = this.toSourceDocument(page, lastSeen);
      const existingDocument = documentsByKey.get(page.dedupKey);

      if (!existingDocument || document.lastModified > existingDocument.lastModified) {
        documentsByKey.set(page.dedupKey, document);
      }

      page.links.forEach((link) => {
        if (!visited.has(link) && !queued.has(link)) {
          queue.push(link);
          queued.add(link);
        }
      });
    }

    return Array.from(documentsByKey.values());
  }

  private async crawlPage(url: string, lastSeen: Date): Promise<CrawledPage> {
    const response = await this.fetchPage(url);
    const html = await response.text();
    const explicitCanonicalUrl = this.extractCanonicalUrl(html, url);
    const canonicalUrl = explicitCanonicalUrl ?? this.normalizeUrl(url);
    const pagePath = this.normalizePagePath(canonicalUrl);

    return {
      dedupKey: explicitCanonicalUrl ?? pagePath,
      canonicalUrl,
      pagePath,
      title: this.extractTitle(html, pagePath),
      content: this.extractTextContent(html),
      lastModified: this.extractLastModified(response, lastSeen),
      links: this.extractInternalLinks(html, canonicalUrl)
    };
  }

  private async fetchPage(url: string): Promise<Response> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      let response: Response;

      try {
        response = await fetch(url);
      } catch (error) {
        if (attempt < MAX_RETRIES) {
          await this.delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
          continue;
        }

        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Website request failed for ${url}: ${message}`);
      }

      if (response.ok) {
        return response;
      }

      if (TRANSIENT_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
        await this.delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }

      throw new Error(`Website request failed with status ${response.status} for ${url}`);
    }

    throw new Error(`Website request failed after ${MAX_RETRIES} attempts for ${url}`);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private extractCanonicalUrl(html: string, pageUrl: string): string | undefined {
    const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];

    for (const linkTag of linkTags) {
      const rel = this.extractAttributeValue(linkTag, 'rel');

      if (!rel?.toLowerCase().split(/\s+/).includes('canonical')) {
        continue;
      }

      const href = this.extractAttributeValue(linkTag, 'href');

      if (!href) {
        continue;
      }

      try {
        const canonicalUrl = new URL(href, pageUrl);

        if (this.isSameDomain(canonicalUrl)) {
          return this.normalizeUrl(canonicalUrl);
        }
      } catch {
        // Ignore invalid canonical URLs.
      }
    }

    return undefined;
  }

  private extractTitle(html: string, pagePath: string): string {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ?? html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const extractedTitle = titleMatch?.[1] ? this.decodeHtmlEntities(this.stripTags(titleMatch[1])).trim() : '';

    if (extractedTitle) {
      return extractedTitle;
    }

    if (pagePath === '/') {
      return 'Home';
    }

    return pagePath.split('/').filter(Boolean).pop() ?? 'Home';
  }

  private extractTextContent(html: string): string {
    let text = html.replace(/<!--[\s\S]*?-->/g, ' ');

    ['head', 'script', 'style', 'nav', 'header', 'footer', 'noscript', 'svg'].forEach((tagName) => {
      text = text.replace(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gi'), ' ');
    });

    text = text.replace(/<\/?(?:main|section|article|aside|div|p|ul|ol|li|h[1-6]|blockquote|pre|table|tr|td|th|br)[^>]*>/gi, '\n');
    text = this.stripTags(text);
    text = this.decodeHtmlEntities(text);

    return text
      .replace(/\r/g, '\n')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private stripTags(value: string): string {
    return value.replace(/<[^>]+>/g, ' ');
  }

  private decodeHtmlEntities(value: string): string {
    return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, rawCode) => {
      const normalizedCode = String(rawCode).toLowerCase();

      if (HTML_ENTITY_MAP[normalizedCode]) {
        return HTML_ENTITY_MAP[normalizedCode];
      }

      if (normalizedCode.startsWith('#x')) {
        const codePoint = Number.parseInt(normalizedCode.slice(2), 16);

        return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
      }

      if (normalizedCode.startsWith('#')) {
        const codePoint = Number.parseInt(normalizedCode.slice(1), 10);

        return Number.isNaN(codePoint) ? entity : String.fromCodePoint(codePoint);
      }

      return entity;
    });
  }

  private extractInternalLinks(html: string, currentUrl: string): string[] {
    const uniqueLinks = new Set<string>();
    const anchorTags = html.match(/<a\b[^>]*>/gi) ?? [];

    for (const anchorTag of anchorTags) {
      const href = this.extractAttributeValue(anchorTag, 'href');

      if (!href || href.startsWith('#') || /^(?:mailto:|tel:|javascript:)/i.test(href)) {
        continue;
      }

      try {
        const resolvedUrl = new URL(href, currentUrl);

        if (!this.isSameDomain(resolvedUrl) || !this.isCrawlablePath(resolvedUrl.pathname)) {
          continue;
        }

        uniqueLinks.add(this.normalizeUrl(resolvedUrl));
      } catch {
        // Ignore invalid links.
      }
    }

    return Array.from(uniqueLinks.values());
  }

  private extractAttributeValue(tag: string, attributeName: string): string | undefined {
    const attributePattern = new RegExp(
      `(?:^|\\s)${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
      'i'
    );
    const match = tag.match(attributePattern);

    return match?.[1] ?? match?.[2] ?? match?.[3];
  }

  private extractLastModified(response: Response, fallbackDate: Date): Date {
    const lastModifiedHeader = response.headers.get('last-modified');

    if (!lastModifiedHeader) {
      return new Date(fallbackDate);
    }

    const lastModified = new Date(lastModifiedHeader);

    return Number.isNaN(lastModified.getTime()) ? new Date(fallbackDate) : lastModified;
  }

  private isSameDomain(url: URL): boolean {
    return this.normalizeHostname(url.hostname) === this.baseHostname;
  }

  private isCrawlablePath(pathname: string): boolean {
    return !NON_HTML_FILE_EXTENSION_PATTERN.test(pathname);
  }

  private normalizeHostname(hostname: string): string {
    return hostname.replace(/^www\./i, '').toLowerCase();
  }

  private normalizeUrl(url: string | URL): string {
    const normalizedUrl = typeof url === 'string' ? new URL(url) : new URL(url.toString());

    normalizedUrl.hash = '';
    normalizedUrl.search = '';
    normalizedUrl.pathname = this.normalizePagePath(normalizedUrl);

    return normalizedUrl.toString();
  }

  private normalizePagePath(urlOrPath: string | URL): string {
    const pathname = typeof urlOrPath === 'string'
      ? (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://') ? new URL(urlOrPath).pathname : urlOrPath)
      : urlOrPath.pathname;

    if (!pathname || pathname === '/') {
      return '/';
    }

    return pathname.replace(/\/+$/, '') || '/';
  }

  private getFreshnessPriority(pagePath: string): 'high' | 'normal' {
    return HIGH_FRESHNESS_PATHS.some((highPriorityPath) => pagePath === highPriorityPath || pagePath.startsWith(`${highPriorityPath}/`))
      ? 'high'
      : 'normal';
  }

  private createDocumentId(pagePath: string): string {
    const normalizedPagePath = pagePath === '/' ? 'root' : pagePath.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

    return `website-${normalizedPagePath.toLowerCase()}`;
  }

  private toSourceDocument(page: CrawledPage, lastSeen: Date): SourceDocument {
    const contentHash = createHash('sha256').update(page.content).digest('hex');

    return {
      id: this.createDocumentId(page.pagePath),
      sourceType: 'website',
      url: page.canonicalUrl,
      title: page.title,
      content: page.content,
      contentHash,
      trustTier: TrustTier.OfficialDocs,
      lastModified: new Date(page.lastModified),
      lastSeen: new Date(lastSeen),
      metadata: {
        freshness_priority: this.getFreshnessPriority(page.pagePath),
        canonical_url: page.canonicalUrl,
        page_path: page.pagePath,
        content_hash: contentHash
      }
    };
  }
}