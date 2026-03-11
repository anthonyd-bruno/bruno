import { type FilterOptions, type IndexedChunk, type SearchResult } from './types';
export declare class VectorStore {
    private readonly chunks;
    add(chunks: IndexedChunk[]): void;
    search(queryEmbedding: number[], options?: {
        topK?: number;
        filter?: FilterOptions;
    }): SearchResult[];
}
