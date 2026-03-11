import { type EmbeddingProvider } from './base';
export interface OpenAIEmbeddingProviderConfig {
    apiKey?: string;
    model?: string;
    dimensions?: number;
}
export declare class OpenAIEmbeddingProvider implements EmbeddingProvider {
    readonly modelName: string;
    readonly dimensions: number;
    private readonly apiKey?;
    constructor(config?: OpenAIEmbeddingProviderConfig);
    embed(texts: string[]): Promise<number[][]>;
    private fetchEmbeddings;
    private delay;
}
