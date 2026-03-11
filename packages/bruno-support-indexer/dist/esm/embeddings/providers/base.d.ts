export interface EmbeddingProvider {
    embed(texts: string[]): Promise<number[][]>;
    readonly modelName: string;
    readonly dimensions: number;
}
