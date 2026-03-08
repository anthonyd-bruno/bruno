import { type Chunk } from '../types/chunk';
import { type EmbeddingProvider } from './providers';

const DEFAULT_BATCH_SIZE = 100;

export type EmbeddedChunk = Chunk & { embedding: number[] };

export interface EmbeddingPipelineConfig {
  provider: EmbeddingProvider;
  batchSize?: number;
}

export class EmbeddingPipeline {
  private readonly provider: EmbeddingProvider;
  private readonly batchSize: number;

  constructor(config: EmbeddingPipelineConfig) {
    this.provider = config.provider;
    this.batchSize = config.batchSize ?? DEFAULT_BATCH_SIZE;
  }

  async embed(chunks: Chunk[], processedHashes?: Set<string>): Promise<EmbeddedChunk[]> {
    const pendingChunks = processedHashes
      ? chunks.filter((chunk) => !processedHashes.has(chunk.contentHash))
      : chunks;

    const embeddedChunks: EmbeddedChunk[] = [];

    for (let start = 0; start < pendingChunks.length; start += this.batchSize) {
      const batch = pendingChunks.slice(start, start + this.batchSize);

      try {
        const embeddings = await this.provider.embed(batch.map((chunk) => chunk.content));

        if (embeddings.length !== batch.length) {
          throw new Error(
            `Embedding provider returned ${embeddings.length} embeddings for ${batch.length} chunks`
          );
        }

        embeddedChunks.push(
          ...batch.map((chunk, index) => ({
            ...chunk,
            embedding: embeddings[index]
          }))
        );
      } catch (error) {
        console.error('Failed to embed chunk batch', error);
      }
    }

    return embeddedChunks;
  }
}