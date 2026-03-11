import { type FilterOptions, type IndexedChunk, type SearchResult } from './types';
export declare class KeywordStore {
    private readonly chunks;
    private readonly documentTermFrequencies;
    private readonly documentLengths;
    private readonly invertedIndex;
    private averageDocumentLength;
    add(chunks: IndexedChunk[]): void;
    search(query: string, options?: {
        topK?: number;
        filter?: FilterOptions;
    }): SearchResult[];
    private rebuildIndex;
    private calculateBm25Score;
}
