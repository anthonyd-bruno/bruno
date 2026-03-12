import { type EmbeddingProvider } from './base';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434/v1/embeddings';
const DEFAULT_MODEL = 'mxbai-embed-large';
const MAX_INPUTS_PER_REQUEST = 2048;

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
      const batchEmbeddings = await this.fetchEmbeddings(batch);

      embeddings.push(...batchEmbeddings);
    }

    return embeddings;
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