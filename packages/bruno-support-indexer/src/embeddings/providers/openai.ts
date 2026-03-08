import { type EmbeddingProvider } from './base';

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;
const MAX_INPUTS_PER_REQUEST = 2048;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 50;
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503]);

interface OpenAIEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
  }>;
}

export interface OpenAIEmbeddingProviderConfig {
  apiKey?: string;
  model?: string;
  dimensions?: number;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly modelName: string;
  readonly dimensions: number;

  private readonly apiKey?: string;

  constructor(config: OpenAIEmbeddingProviderConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
    this.modelName = config.model ?? DEFAULT_MODEL;
    this.dimensions = config.dimensions ?? DEFAULT_DIMENSIONS;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    if (!this.apiKey) {
      throw new Error('OpenAI API key is required to generate embeddings');
    }

    const embeddings: number[][] = [];

    for (let start = 0; start < texts.length; start += MAX_INPUTS_PER_REQUEST) {
      const batch = texts.slice(start, start + MAX_INPUTS_PER_REQUEST);
      const batchEmbeddings = await this.fetchEmbeddings(batch);

      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  private async fetchEmbeddings(texts: string[]): Promise<number[][]> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      const response = await fetch(OPENAI_EMBEDDINGS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.modelName,
          input: texts,
          dimensions: this.dimensions
        })
      });

      if (response.ok) {
        const payload = (await response.json()) as OpenAIEmbeddingResponse;
        const sortedEmbeddings = [...(payload.data ?? [])]
          .sort((left, right) => left.index - right.index)
          .map((item) => item.embedding);

        if (sortedEmbeddings.length !== texts.length) {
          throw new Error(
            `OpenAI embeddings response returned ${sortedEmbeddings.length} embeddings for ${texts.length} inputs`
          );
        }

        return sortedEmbeddings;
      }

      if (TRANSIENT_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
        await this.delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }

      throw new Error(`OpenAI embeddings request failed with status ${response.status}`);
    }

    throw new Error(`OpenAI embeddings request failed after ${MAX_RETRIES} attempts`);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}