import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'crypto';

import { WebsiteIngester } from '../website';
import { sourceDocumentSchema } from '../../types/source-document';
import { TrustTier } from '../../types/trust-tier';

const originalFetch = global.fetch;

function createHtmlResponse(
  html: string,
  options: {
    status?: number;
    lastModified?: string;
  } = {}
): Response {
  const headers = new Headers();

  if (options.lastModified) {
    headers.set('last-modified', options.lastModified);
  }

  return {
    ok: (options.status ?? 200) >= 200 && (options.status ?? 200) < 300,
    status: options.status ?? 200,
    headers,
    text: async () => html
  } as Response;
}

function mockFetchWithRoutes(routes: Record<string, Response>): jest.MockedFunction<typeof fetch> {
  const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

  fetchMock.mockImplementation(async (input) => {
    const url = String(input);
    const response = routes[url];

    if (!response) {
      throw new Error(`Unexpected fetch: ${url}`);
    }

    return response;
  });

  return fetchMock;
}

describe('WebsiteIngester', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('fetches seed pages, follows same-domain links, and strips boilerplate HTML from content', async () => {
    const fetchMock = mockFetchWithRoutes({
      'https://www.usebruno.com/': createHtmlResponse(`
        <html>
          <head>
            <title>Home</title>
            <style>.hidden { display: none; }</style>
            <script>console.log('ignore me');</script>
          </head>
          <body>
            <header>Header CTA</header>
            <nav>Primary Nav</nav>
            <main>
              <h1>Welcome to Bruno</h1>
              <p>Official website &amp; overview.</p>
              <a href="/pricing">Pricing</a>
              <a href="https://www.usebruno.com/support">Support</a>
              <a href="https://example.com/offsite">External</a>
              <a href="/downloads/app.dmg">Installer</a>
            </main>
            <footer>Footer links</footer>
          </body>
        </html>
      `),
      'https://www.usebruno.com/pricing': createHtmlResponse('<html><head><title>Pricing</title></head><body><main><p>Pricing details</p></main></body></html>'),
      'https://www.usebruno.com/support': createHtmlResponse('<html><head><title>Support</title></head><body><main><p>Support resources</p></main></body></html>')
    });

    const ingester = new WebsiteIngester({ targetPaths: ['/'], maxPages: 10 });
    const documents = await ingester.ingest();
    const fetchedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    const homeDocument = documents.find((document) => document.metadata.page_path === '/');

    expect(fetchedUrls).toEqual([
      'https://www.usebruno.com/',
      'https://www.usebruno.com/pricing',
      'https://www.usebruno.com/support'
    ]);
    expect(homeDocument?.content).toContain('Welcome to Bruno');
    expect(homeDocument?.content).toContain('Official website & overview.');
    expect(homeDocument?.content).not.toContain('Primary Nav');
    expect(homeDocument?.content).not.toContain('Header CTA');
    expect(homeDocument?.content).not.toContain('Footer links');
  });

  it('sets freshness metadata for priority pages and returns schema-valid source documents', async () => {
    mockFetchWithRoutes({
      'https://www.usebruno.com/downloads': createHtmlResponse('<html><head><title>Downloads</title></head><body><main><p>Download Bruno</p></main></body></html>'),
      'https://www.usebruno.com/changelog': createHtmlResponse('<html><head><title>Changelog</title></head><body><main><p>Release history</p></main></body></html>'),
      'https://www.usebruno.com/pricing': createHtmlResponse('<html><head><title>Pricing</title></head><body><main><p>Plans and pricing</p></main></body></html>'),
      'https://www.usebruno.com/about': createHtmlResponse('<html><head><title>About</title></head><body><main><p>About Bruno</p></main></body></html>')
    });

    const ingester = new WebsiteIngester({ targetPaths: ['/downloads', '/changelog', '/pricing', '/about'] });
    const documents = await ingester.ingest();
    const documentsByPath = new Map(documents.map((document) => [String(document.metadata.page_path), document]));

    expect(documentsByPath.get('/downloads')).toMatchObject({
      sourceType: 'website',
      trustTier: TrustTier.OfficialDocs,
      metadata: {
        freshness_priority: 'high',
        canonical_url: 'https://www.usebruno.com/downloads',
        page_path: '/downloads'
      }
    });
    expect(documentsByPath.get('/pricing')?.metadata.freshness_priority).toBe('high');
    expect(documentsByPath.get('/changelog')?.metadata.freshness_priority).toBe('high');
    expect(documentsByPath.get('/about')?.metadata.freshness_priority).toBe('normal');
    expect(documentsByPath.get('/downloads')?.contentHash).toBe(
      createHash('sha256').update('Download Bruno').digest('hex')
    );
    expect(documentsByPath.get('/downloads')?.metadata.content_hash).toBe(documentsByPath.get('/downloads')?.contentHash);
    expect(() => documents.forEach((document) => sourceDocumentSchema.parse(document))).not.toThrow();
  });

  it('respects the maxPages limit while crawling internal links', async () => {
    const fetchMock = mockFetchWithRoutes({
      'https://www.usebruno.com/': createHtmlResponse(`
        <html><body><main>
          <p>Home</p>
          <a href="/pricing">Pricing</a>
          <a href="/support">Support</a>
          <a href="/about">About</a>
        </main></body></html>
      `),
      'https://www.usebruno.com/pricing': createHtmlResponse('<html><body><main><p>Pricing details</p></main></body></html>')
    });

    const ingester = new WebsiteIngester({ targetPaths: ['/'], maxPages: 2 });
    const documents = await ingester.ingest();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(documents).toHaveLength(2);
    expect(documents.map((document) => document.metadata.page_path)).toEqual(['/', '/pricing']);
  });

  it('deduplicates pages by normalized page path and keeps the latest version', async () => {
    mockFetchWithRoutes({
      'https://www.usebruno.com/': createHtmlResponse(`
        <html><body><main>
          <p>Home</p>
          <a href="https://usebruno.com/support">Support Mirror</a>
        </main></body></html>
      `),
      'https://www.usebruno.com/support': createHtmlResponse(
        '<html><head><title>Support</title></head><body><main><p>Older support page</p></main></body></html>',
        { lastModified: 'Mon, 01 Jan 2024 00:00:00 GMT' }
      ),
      'https://usebruno.com/support': createHtmlResponse(
        '<html><head><title>Support</title></head><body><main><p>Newer support page</p></main></body></html>',
        { lastModified: 'Tue, 02 Jan 2024 00:00:00 GMT' }
      )
    });

    const ingester = new WebsiteIngester({ targetPaths: ['/', '/support'], maxPages: 10 });
    const documents = await ingester.ingest();
    const supportDocuments = documents.filter((document) => document.metadata.page_path === '/support');

    expect(supportDocuments).toHaveLength(1);
    expect(supportDocuments[0].content).toContain('Newer support page');
    expect(supportDocuments[0].lastModified).toEqual(new Date('Tue, 02 Jan 2024 00:00:00 GMT'));
  });

  it('deduplicates pages by canonical URL and keeps the latest version', async () => {
    mockFetchWithRoutes({
      'https://www.usebruno.com/pricing': createHtmlResponse(
        '<html><head><title>Pricing</title><link rel="canonical" href="https://www.usebruno.com/plans" /></head><body><main><p>Older plans page</p></main></body></html>',
        { lastModified: 'Wed, 03 Jan 2024 00:00:00 GMT' }
      ),
      'https://www.usebruno.com/plans': createHtmlResponse(
        '<html><head><title>Plans</title><link rel="canonical" href="https://www.usebruno.com/plans" /></head><body><main><p>Latest plans page</p></main></body></html>',
        { lastModified: 'Thu, 04 Jan 2024 00:00:00 GMT' }
      )
    });

    const ingester = new WebsiteIngester({ targetPaths: ['/pricing', '/plans'] });
    const documents = await ingester.ingest();

    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      url: 'https://www.usebruno.com/plans',
      content: 'Latest plans page',
      metadata: {
        canonical_url: 'https://www.usebruno.com/plans',
        page_path: '/plans'
      }
    });
  });

  it('retries transient HTTP errors and succeeds on a later attempt', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(createHtmlResponse('temporary issue', { status: 503 }))
      .mockResolvedValueOnce(
        createHtmlResponse('<html><head><title>Downloads</title></head><body><main><p>Download Bruno</p></main></body></html>')
      );

    const ingester = new WebsiteIngester({ targetPaths: ['/downloads'] });
    const documents = await ingester.ingest();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(documents).toHaveLength(1);
    expect(documents[0].metadata.page_path).toBe('/downloads');
  });
});