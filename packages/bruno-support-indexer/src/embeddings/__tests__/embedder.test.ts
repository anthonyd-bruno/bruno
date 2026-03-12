import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { type Chunk } from '../../types/chunk';
import { EmbeddingPipeline } from '../embedder';
import { type EmbeddingProvider } from '../providers';
import { OllamaEmbeddingProvider } from '../providers/ollama';
import { OpenAIEmbeddingProvider } from '../providers/openai';

const originalFetch = global.fetch;

function createChunk(index: number): Chunk {
  return {
    id: `chunk-${index}`,
    documentId: 'doc-1',
    content: `Chunk content ${index}`,
    headingAnchor: `heading-${index}`,
    chunkIndex: index,
    metadata: { index },
    contentHash: `hash-${index}`
  };
}

function createEmbedding(seed: string, dimensions: number): number[] {
  return Array.from({ length: dimensions }, (_, index) => seed.length + index);
}

function createJsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data
  } as Response;
}

describe('EmbeddingPipeline', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('batches chunks using the configured batch size', async () => {
    const chunks = Array.from({ length: 250 }, (_, index) => createChunk(index));
    const provider: EmbeddingProvider = {
      modelName: 'mock-provider',
      dimensions: 3,
      embed: jest.fn(async (texts: string[]) => texts.map((text) => createEmbedding(text, 3)))
    };
    const pipeline = new EmbeddingPipeline({ provider, batchSize: 100 });

    const embeddedChunks = await pipeline.embed(chunks);

    expect(provider.embed).toHaveBeenCalledTimes(3);
    expect((provider.embed as jest.MockedFunction<EmbeddingProvider['embed']>).mock.calls[0][0]).toHaveLength(100);
    expect((provider.embed as jest.MockedFunction<EmbeddingProvider['embed']>).mock.calls[1][0]).toHaveLength(100);
    expect((provider.embed as jest.MockedFunction<EmbeddingProvider['embed']>).mock.calls[2][0]).toHaveLength(50);
    expect(embeddedChunks).toHaveLength(250);
  });

  it('skips chunks whose content hashes were already processed', async () => {
    const chunks = Array.from({ length: 5 }, (_, index) => createChunk(index));
    const provider: EmbeddingProvider = {
      modelName: 'mock-provider',
      dimensions: 2,
      embed: jest.fn(async (texts: string[]) => texts.map((text) => createEmbedding(text, 2)))
    };
    const pipeline = new EmbeddingPipeline({ provider, batchSize: 10 });

    const embeddedChunks = await pipeline.embed(chunks, new Set(['hash-1', 'hash-3']));

    expect(provider.embed).toHaveBeenCalledTimes(1);
    expect((provider.embed as jest.MockedFunction<EmbeddingProvider['embed']>).mock.calls[0][0]).toEqual([
      'Chunk content 0',
      'Chunk content 2',
      'Chunk content 4'
    ]);
    expect(embeddedChunks.map((chunk) => chunk.contentHash)).toEqual(['hash-0', 'hash-2', 'hash-4']);
  });

  it('logs a failed batch and continues embedding later batches', async () => {
    const chunks = Array.from({ length: 5 }, (_, index) => createChunk(index));
    const embed = jest
      .fn<EmbeddingProvider['embed']>()
      .mockResolvedValueOnce(['Chunk content 0', 'Chunk content 1'].map((text) => createEmbedding(text, 2)))
      .mockRejectedValueOnce(new Error('rate limited'))
      .mockResolvedValueOnce(['Chunk content 4'].map((text) => createEmbedding(text, 2)));
    const provider: EmbeddingProvider = {
      modelName: 'mock-provider',
      dimensions: 2,
      embed
    };
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const pipeline = new EmbeddingPipeline({ provider, batchSize: 2 });

    const embeddedChunks = await pipeline.embed(chunks);

    expect(provider.embed).toHaveBeenCalledTimes(3);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(embeddedChunks.map((chunk) => chunk.contentHash)).toEqual(['hash-0', 'hash-1', 'hash-4']);
  });

  it('returns embedded chunks with the expected embedding dimensions', async () => {
    const provider: EmbeddingProvider = {
      modelName: 'mock-provider',
      dimensions: 4,
      embed: jest.fn(async (texts: string[]) => texts.map((text) => createEmbedding(text, 4)))
    };
    const pipeline = new EmbeddingPipeline({ provider });

    const [embeddedChunk] = await pipeline.embed([createChunk(7)]);

    expect(embeddedChunk).toMatchObject({
      id: 'chunk-7',
      contentHash: 'hash-7'
    });
    expect(embeddedChunk.embedding).toHaveLength(4);
  });
});

describe('OpenAIEmbeddingProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.OPENAI_API_KEY;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  });

  it('constructs the expected OpenAI embeddings request', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [
          { index: 0, embedding: [0.1, 0.2] },
          { index: 1, embedding: [0.3, 0.4] }
        ]
      })
    );

    const provider = new OpenAIEmbeddingProvider({
      apiKey: 'config-key',
      model: 'text-embedding-3-small',
      dimensions: 256
    });

    await provider.embed(['alpha', 'beta']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/embeddings');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        Authorization: 'Bearer config-key',
        'Content-Type': 'application/json'
      }
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      model: 'text-embedding-3-small',
      input: ['alpha', 'beta'],
      dimensions: 256
    });
  });

  it('retries transient 429 responses and succeeds on a later attempt', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ error: 'rate limited' }, 429))
      .mockResolvedValueOnce(
        createJsonResponse({
          data: [{ index: 0, embedding: [1, 2, 3] }]
        })
      );

    const provider = new OpenAIEmbeddingProvider({ apiKey: 'config-key', dimensions: 3 });
    const embeddings = await provider.embed(['alpha']);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(embeddings).toEqual([[1, 2, 3]]);
  });

  it('uses the configured API key and falls back to the environment variable', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    process.env.OPENAI_API_KEY = 'env-key';

    fetchMock
      .mockResolvedValueOnce(createJsonResponse({ data: [{ index: 0, embedding: [1] }] }))
      .mockResolvedValueOnce(createJsonResponse({ data: [{ index: 0, embedding: [2] }] }));

    const configuredProvider = new OpenAIEmbeddingProvider({ apiKey: 'config-key', dimensions: 1 });
    const envProvider = new OpenAIEmbeddingProvider({ dimensions: 1 });

    await configuredProvider.embed(['first']);
    await envProvider.embed(['second']);

    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer config-key' });
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({ Authorization: 'Bearer env-key' });
  });
});

describe('OllamaEmbeddingProvider', () => {
  beforeEach(() => {
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('constructs the expected Ollama embeddings request', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [
          { index: 0, embedding: [0.1, 0.2] },
          { index: 1, embedding: [0.3, 0.4] }
        ]
      })
    );

    const provider = new OllamaEmbeddingProvider({
      endpoint: 'http://127.0.0.1:11434/v1/embeddings',
      model: 'mxbai-embed-large',
      dimensions: 2
    });

    await provider.embed(['alpha', 'beta']);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:11434/v1/embeddings');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      model: 'mxbai-embed-large',
      input: ['alpha', 'beta'],
      dimensions: 2
    });
    expect(provider.dimensions).toBe(2);
  });

  it('resolves dimensions from the Ollama response when not configured', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [{ index: 0, embedding: [1, 2, 3] }]
      })
    );

    const provider = new OllamaEmbeddingProvider({ model: 'nomic-embed-text' });
    const embeddings = await provider.embed(['alpha']);

    expect(embeddings).toEqual([[1, 2, 3]]);
    expect(provider.dimensions).toBe(3);
  });

  it('fails when Ollama returns unexpected embedding dimensions', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    fetchMock.mockResolvedValueOnce(
      createJsonResponse({
        data: [{ index: 0, embedding: [1, 2, 3] }]
      })
    );

    const provider = new OllamaEmbeddingProvider({ dimensions: 2 });

    await expect(provider.embed(['alpha'])).rejects.toThrow(
      'Ollama embeddings returned 3 dimensions but 2 were configured.'
    );
  });
});