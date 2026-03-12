import { type EmbeddingProvider } from './base';
export interface OllamaEmbeddingProviderConfig {
    endpoint?: string;
    model?: string;
    dimensions?: number;
    fetchImpl?: typeof fetch;
}
export declare class OllamaEmbeddingProvider implements EmbeddingProvider {
    readonly modelName: string;
    private readonly endpoint;
    private readonly configuredDimensions?;
    private readonly fetchImpl;
    private resolvedDimensions?;
    constructor(config?: OllamaEmbeddingProviderConfig);
    get dimensions(): number;
    embed(texts: string[]): Promise<number[][]>;
    private fetchEmbeddings;
    private assertEmbeddingDimensions;
}
