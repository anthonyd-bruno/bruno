import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'crypto';

import { DocsSiteIngester } from '../docs-site';
import { sourceDocumentSchema } from '../../types/source-document';
import { TrustTier } from '../../types/trust-tier';

const originalFetch = global.fetch;

function createHtmlResponse(html: string, status = 200, headers: Record<string, string> = {}): Response {
  const normalizedHeaders = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));

  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => html,
    headers: {
      get: (name: string) => normalizedHeaders.get(name.toLowerCase()) ?? null
    }
  } as Response;
}

describe('DocsSiteIngester', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('crawls internal pages, strips noisy markup, ignores external links, and returns schema-valid documents', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url === 'https://docs.usebruno.com/') {
        return createHtmlResponse(`
          <html>
            <head><title>Bruno Docs</title><link rel="canonical" href="https://docs.usebruno.com/" /></head>
            <body>
              <header>Header text</header>
              <nav>Navigation</nav>
              <main>
                <h1 id="home">Welcome</h1>
                <p>Welcome to <strong>Bruno</strong> docs &amp; guides.</p>
                <a href="/guide/getting-started">Getting started</a>
                <a href="https://example.com/outside">Outside</a>
              </main>
              <footer>Footer text</footer>
              <script>window.ignore = true;</script>
            </body>
          </html>
        `);
      }

      if (url === 'https://docs.usebruno.com/guide/getting-started') {
        return createHtmlResponse(
          `
            <html>
              <head><title>Getting Started</title></head>
              <body>
                <main>
                  <h1 id="getting-started">Getting Started</h1>
                  <h2 id="installation">Installation</h2>
                  <p>Install Bruno and create your first request.</p>
                </main>
              </body>
            </html>
          `,
          200,
          { 'last-modified': 'Tue, 05 Mar 2024 10:00:00 GMT' }
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const ingester = new DocsSiteIngester({ maxPages: 10, maxDepth: 2 });
    const documents = await ingester.ingest();
    const homeDocument = documents.find((document) => document.url === 'https://docs.usebruno.com/');
    const gettingStartedDocument = documents.find(
      (document) => document.url === 'https://docs.usebruno.com/guide/getting-started'
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('example.com'))).toBe(false);
    expect(homeDocument).toMatchObject({
      sourceType: 'docs_site',
      title: 'Welcome',
      content: 'Bruno Docs Welcome Welcome to Bruno docs & guides. Getting started Outside',
      trustTier: TrustTier.OfficialDocs
    });
    expect(gettingStartedDocument).toMatchObject({
      sourceType: 'docs_site',
      trustTier: TrustTier.OfficialDocs,
      lastModified: new Date('Tue, 05 Mar 2024 10:00:00 GMT')
    });
    expect(gettingStartedDocument?.contentHash).toBe(
      createHash('sha256')
        .update('Getting Started Getting Started Installation Install Bruno and create your first request.')
        .digest('hex')
    );
    expect(gettingStartedDocument?.metadata).toMatchObject({
      canonical_url: 'https://docs.usebruno.com/guide/getting-started',
      headings: ['#getting-started', '#installation'],
      depth: 1,
      content_hash: gettingStartedDocument?.contentHash
    });
    expect(() => documents.forEach((document) => sourceDocumentSchema.parse(document))).not.toThrow();
  });

  it('deduplicates pages by canonical URL and keeps the latest page version', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url === 'https://docs.usebruno.com/') {
        return createHtmlResponse(`
          <html>
            <body>
              <a href="/guide">Guide</a>
              <a href="/guide-alias">Guide Alias</a>
            </body>
          </html>
        `);
      }

      if (url === 'https://docs.usebruno.com/guide') {
        return createHtmlResponse(
          '<html><head><link rel="canonical" href="https://docs.usebruno.com/guide" /></head><body><h1>Guide</h1><p>Older guide</p></body></html>',
          200,
          { 'last-modified': 'Mon, 04 Mar 2024 10:00:00 GMT' }
        );
      }

      if (url === 'https://docs.usebruno.com/guide-alias') {
        return createHtmlResponse(
          '<html><head><link rel="canonical" href="https://docs.usebruno.com/guide" /></head><body><h1>Guide</h1><p>Newer guide</p></body></html>',
          200,
          { 'last-modified': 'Tue, 05 Mar 2024 10:00:00 GMT' }
        );
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const ingester = new DocsSiteIngester({ maxPages: 10, maxDepth: 2 });
    const documents = await ingester.ingest();
    const canonicalGuideDocuments = documents.filter((document) => document.url === 'https://docs.usebruno.com/guide');

    expect(canonicalGuideDocuments).toHaveLength(1);
    expect(canonicalGuideDocuments[0].content).toBe('Guide Newer guide');
    expect(documents).toHaveLength(2);
  });

  it('respects maxPages and maxDepth limits', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);

      if (url === 'https://docs.usebruno.com/') {
        return createHtmlResponse('<html><body><h1>Home</h1><a href="/one">One</a></body></html>');
      }

      if (url === 'https://docs.usebruno.com/one') {
        return createHtmlResponse('<html><body><h1>One</h1><a href="/two">Two</a></body></html>');
      }

      if (url === 'https://docs.usebruno.com/two') {
        return createHtmlResponse('<html><body><h1>Two</h1></body></html>');
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const depthLimitedIngester = new DocsSiteIngester({ maxPages: 10, maxDepth: 1 });
    const depthLimitedDocuments = await depthLimitedIngester.ingest();

    expect(depthLimitedDocuments).toHaveLength(2);
    expect(fetchMock.mock.calls.some(([url]) => String(url) === 'https://docs.usebruno.com/two')).toBe(false);

    fetchMock.mockClear();

    const pageLimitedIngester = new DocsSiteIngester({ maxPages: 1, maxDepth: 5 });
    const pageLimitedDocuments = await pageLimitedIngester.ingest();

    expect(pageLimitedDocuments).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries transient HTTP errors before succeeding', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(createHtmlResponse('rate limited', 429))
      .mockResolvedValueOnce(createHtmlResponse('<html><body><h1>Docs</h1></body></html>'));

    const ingester = new DocsSiteIngester({ maxPages: 1, maxDepth: 0 });
    const documents = await ingester.ingest();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(documents).toHaveLength(1);
  });
});