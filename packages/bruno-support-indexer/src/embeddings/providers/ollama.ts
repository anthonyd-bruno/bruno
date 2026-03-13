import { type EmbeddingProvider } from './base';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434/v1/embeddings';
const DEFAULT_MODEL = 'mxbai-embed-large';
const MAX_INPUTS_PER_REQUEST = 2048;
const CONTEXT_LENGTH_ERROR_PATTERNS = ['input length exceeds the context length', 'context length', 'maximum context length'];

interface OllamaEmbeddingResponse {
  data?: Array<{
    embedding: number[];
    index: number;
  }>;
}

export interface OllamaEmbeddingProviderConfig {
  endpoint?: string;
  model?: string;
  dimensions?: number;
  fetchImpl?: typeof fetch;
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly modelName: string;

  private readonly endpoint: string;
  private readonly configuredDimensions?: number;
  private readonly fetchImpl: typeof fetch;
  private resolvedDimensions?: number;

  constructor(config: OllamaEmbeddingProviderConfig = {}) {
    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
    this.modelName = config.model ?? DEFAULT_MODEL;
    this.configuredDimensions = config.dimensions;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  get dimensions(): number {
    return this.configuredDimensions ?? this.resolvedDimensions ?? 0;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const embeddings: number[][] = [];

    for (let start = 0; start < texts.length; start += MAX_INPUTS_PER_REQUEST) {
      const batch = texts.slice(start, start + MAX_INPUTS_PER_REQUEST);
      const batchEmbeddings = await this.fetchEmbeddingsWithContextFallback(batch);

      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
  }

  private async fetchEmbeddingsWithContextFallback(texts: string[]): Promise<number[][]> {
    try {
      return await this.fetchEmbeddings(texts);
    } catch (error) {
      if (!this.isContextLengthError(error)) {
        throw error;
      }

      if (texts.length === 1) {
        const detail = error instanceof Error ? error.message : String(error);

        throw new Error(
          `Ollama embeddings request exceeded context length for a single input even after narrowing to one chunk. Reduce chunk size or content length and retry.${detail ? ` Original error: ${detail}` : ''}`
        );
      }

      const midpoint = Math.ceil(texts.length / 2);
      const leftEmbeddings = await this.fetchEmbeddingsWithContextFallback(texts.slice(0, midpoint));
      const rightEmbeddings = await this.fetchEmbeddingsWithContextFallback(texts.slice(midpoint));

      return [...leftEmbeddings, ...rightEmbeddings];
    }
  }

  private async fetchEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.modelName,
        input: texts,
        ...(this.configuredDimensions ? { dimensions: this.configuredDimensions } : {})
      })
    });

    if (!response.ok) {
      const detail = (await response.text()).trim();
      throw new Error(`Ollama embeddings request failed with status ${response.status}${detail ? `: ${detail}` : ''}`);
    }

    const sortedEmbeddings = [...((((await response.json()) as OllamaEmbeddingResponse).data ?? []))]
      .sort((left, right) => left.index - right.index)
      .map((item) => item.embedding);

    if (sortedEmbeddings.length !== texts.length) {
      throw new Error(`Ollama embeddings response returned ${sortedEmbeddings.length} embeddings for ${texts.length} inputs`);
    }

    this.assertEmbeddingDimensions(sortedEmbeddings);

    return sortedEmbeddings;
  }

  private isContextLengthError(error: unknown): boolean {
    const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

    if (!message.includes('status 400')) {
      return false;
    }

    return CONTEXT_LENGTH_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
  }

  private assertEmbeddingDimensions(embeddings: number[][]): void {
    const lengths = [...new Set(embeddings.map((embedding) => embedding.length))];

    if (lengths.length > 1) {
      throw new Error(`Ollama embeddings returned inconsistent vector dimensions: ${lengths.join(', ')}`);
    }

    const actualDimensions = lengths[0] ?? 0;

    if (actualDimensions <= 0) {
      throw new Error('Ollama embeddings returned empty vectors.');
    }

    if (this.configuredDimensions && actualDimensions !== this.configuredDimensions) {
      throw new Error(
        `Ollama embeddings returned ${actualDimensions} dimensions but ${this.configuredDimensions} were configured.`
      );
    }

    this.resolvedDimensions = actualDimensions;
  }
}