import { type IndexedChunk, type SearchOptions, type SearchResult } from './types';
export declare class HybridIndex {
    private readonly chunks;
    private readonly vectorStore;
    private readonly keywordStore;
    add(chunks: IndexedChunk[]): void;
    search(query: string, queryEmbedding: number[], options?: SearchOptions): SearchResult[];
}
