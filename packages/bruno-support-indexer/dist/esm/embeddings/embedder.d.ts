import { type Chunk } from '../types/chunk';
import { type EmbeddingProvider } from './providers';
export type EmbeddedChunk = Chunk & {
    embedding: number[];
};
export interface EmbeddingPipelineConfig {
    provider: EmbeddingProvider;
    batchSize?: number;
}
export declare class EmbeddingPipeline {
    private readonly provider;
    private readonly batchSize;
    constructor(config: EmbeddingPipelineConfig);
    embed(chunks: Chunk[], processedHashes?: Set<string>): Promise<EmbeddedChunk[]>;
}
