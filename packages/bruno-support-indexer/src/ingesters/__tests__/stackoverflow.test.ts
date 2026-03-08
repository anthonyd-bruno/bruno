import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'crypto';

import { StackOverflowIngester } from '../stackoverflow';
import { sourceDocumentSchema } from '../../types/source-document';
import { TrustTier } from '../../types/trust-tier';

const originalFetch = global.fetch;

function createJsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  } as Response;
}

function createQuestion(questionId: number) {
  return {
    question_id: questionId,
    title: `Question ${questionId}`,
    tags: ['bruno', 'api'],
    accepted_answer_id: questionId * 100
  };
}

function createAnswer(overrides: Partial<Record<string, unknown>> = {}) {
  const nowSeconds = Math.floor(Date.now() / 1000);

  return {
    answer_id: 101,
    question_id: 1,
    body: '<p>Use Bruno this way</p>',
    score: 10,
    is_accepted: true,
    creation_date: nowSeconds - 3600,
    last_activity_date: nowSeconds - 1800,
    ...overrides
  };
}

describe('StackOverflowIngester', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    delete process.env.STACKEXCHANGE_API_KEY;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    delete process.env.STACKEXCHANGE_API_KEY;
  });

  it('includes accepted answers in the results', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ items: [createQuestion(1)] }))
      .mockResolvedValueOnce(createJsonResponse({ items: [createAnswer()] }));

    const ingester = new StackOverflowIngester();
    const documents = await ingester.ingest();

    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      id: 'so-answer-101',
      sourceType: 'stackoverflow',
      url: 'https://stackoverflow.com/a/101',
      title: 'Question 1',
      content: '<p>Use Bruno this way</p>',
      trustTier: TrustTier.External
    });
    expect(documents[0].contentHash).toBe(createHash('sha256').update('<p>Use Bruno this way</p>').digest('hex'));
  });

  it('uses a 10-year maxAgeDays default', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    const fiveYearsAgo = Math.floor(Date.now() / 1000) - 5 * 365 * 24 * 60 * 60;

    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ items: [createQuestion(1)] }))
      .mockResolvedValueOnce(createJsonResponse({ items: [createAnswer({ creation_date: fiveYearsAgo })] }));

    const ingester = new StackOverflowIngester();
    const documents = await ingester.ingest();

    expect(documents).toHaveLength(1);
  });

  it('filters out low-score answers', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ items: [createQuestion(1)] }))
      .mockResolvedValueOnce(createJsonResponse({ items: [createAnswer({ score: 2 })] }));

    const ingester = new StackOverflowIngester({ minScore: 3 });

    await expect(ingester.ingest()).resolves.toEqual([]);
  });

  it('filters out stale answers older than maxAgeDays', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    const staleCreationDate = Math.floor(Date.now() / 1000) - 31 * 24 * 60 * 60;

    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ items: [createQuestion(1)] }))
      .mockResolvedValueOnce(
        createJsonResponse({ items: [createAnswer({ creation_date: staleCreationDate })] })
      );

    const ingester = new StackOverflowIngester({ maxAgeDays: 30 });

    await expect(ingester.ingest()).resolves.toEqual([]);
  });

  it('maps metadata fields correctly', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    const answer = createAnswer({
      score: 42,
      is_accepted: false,
      creation_date: 1_700_000_000,
      last_activity_date: 1_700_000_100,
      answer_id: 909,
      question_id: 7
    });

    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ items: [createQuestion(7)] }))
      .mockResolvedValueOnce(createJsonResponse({ items: [answer] }));

    const ingester = new StackOverflowIngester({ maxAgeDays: 10_000 });
    const [document] = await ingester.ingest();

    expect(document.lastModified).toEqual(new Date(1_700_000_100 * 1000));
    expect(document.metadata).toEqual({
      score: 42,
      is_accepted: false,
      creation_date: 1_700_000_000,
      last_activity_date: 1_700_000_100,
      question_id: 7,
      answer_id: 909,
      question_tags: ['bruno', 'api']
    });
  });

  it('deduplicates answers by answer_id and keeps the latest one', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    const olderAnswer = createAnswer({
      answer_id: 555,
      body: '<p>Older answer</p>',
      last_activity_date: 1_700_000_000
    });
    const newerAnswer = createAnswer({
      answer_id: 555,
      body: '<p>Newer answer</p>',
      last_activity_date: 1_700_000_500
    });

    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ items: [createQuestion(1)] }))
      .mockResolvedValueOnce(createJsonResponse({ items: [olderAnswer, newerAnswer] }));

    const ingester = new StackOverflowIngester();
    const documents = await ingester.ingest();

    expect(documents).toHaveLength(1);
    expect(documents[0].content).toBe('<p>Newer answer</p>');
    expect(documents[0].lastModified).toEqual(new Date(1_700_000_500 * 1000));
  });

  it('includes the API key from the environment when available', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    process.env.STACKEXCHANGE_API_KEY = 'env-key';

    fetchMock.mockResolvedValueOnce(createJsonResponse({ items: [] }));

    const ingester = new StackOverflowIngester();

    await ingester.ingest();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('key=env-key');
  });

  it('omits the API key when one is not provided', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock.mockResolvedValueOnce(createJsonResponse({ items: [] }));

    const ingester = new StackOverflowIngester();

    await ingester.ingest();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).not.toContain('key=');
  });

  it('retries transient HTTP errors and succeeds on a later attempt', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ error: 'rate limited' }, 429))
      .mockResolvedValueOnce(createJsonResponse({ items: [createQuestion(1)] }))
      .mockResolvedValueOnce(createJsonResponse({ items: [createAnswer()] }));

    const ingester = new StackOverflowIngester();
    const documents = await ingester.ingest();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(documents).toHaveLength(1);
  });

  it('returns documents that conform to the SourceDocument schema', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ items: [createQuestion(1)] }))
      .mockResolvedValueOnce(createJsonResponse({ items: [createAnswer()] }));

    const ingester = new StackOverflowIngester();
    const documents = await ingester.ingest();

    expect(() => documents.forEach((document) => sourceDocumentSchema.parse(document))).not.toThrow();
  });
});