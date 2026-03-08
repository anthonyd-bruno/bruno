import {
  DEFAULT_TOP_K,
  type FilterOptions,
  indexedChunkSchema,
  type IndexedChunk,
  type SearchResult
} from './types';

function matchesFilter(chunk: IndexedChunk, filter?: FilterOptions): boolean {
  if (!filter) {
    return true;
  }

  if (filter.sourceTypes && !filter.sourceTypes.includes(chunk.sourceType)) {
    return false;
  }

  if (filter.trustTiers && !filter.trustTiers.includes(chunk.trustTier)) {
    return false;
  }

  if (filter.minDate && chunk.lastModified < filter.minDate) {
    return false;
  }

  return true;
}

function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    return 0;
  }

  return a.reduce((sum, value, index) => sum + value * b[index], 0);
}

function magnitude(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function cosineSimilarity(a: number[], b: number[]): number {
  const aMagnitude = magnitude(a);
  const bMagnitude = magnitude(b);

  if (aMagnitude === 0 || bMagnitude === 0) {
    return 0;
  }

  return dotProduct(a, b) / (aMagnitude * bMagnitude);
}

export class VectorStore {
  private readonly chunks = new Map<string, IndexedChunk>();

  add(chunks: IndexedChunk[]): void {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, indexedChunkSchema.parse(chunk));
    }
  }

  search(
    queryEmbedding: number[],
    options?: { topK?: number; filter?: FilterOptions }
  ): SearchResult[] {
    if (this.chunks.size === 0) {
      return [];
    }

    const topK = options?.topK ?? DEFAULT_TOP_K;

    if (topK <= 0) {
      return [];
    }

    return Array.from(this.chunks.values())
      .filter((chunk) => matchesFilter(chunk, options?.filter))
      .map((chunk) => ({
        chunk,
        score: cosineSimilarity(queryEmbedding, chunk.embedding)
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);
  }
}