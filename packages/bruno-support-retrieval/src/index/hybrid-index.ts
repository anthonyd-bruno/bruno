import { KeywordStore } from './keyword-store';
import {
  DEFAULT_KEYWORD_WEIGHT,
  DEFAULT_TOP_K,
  DEFAULT_VECTOR_WEIGHT,
  type FilterOptions,
  indexedChunkSchema,
  type IndexedChunk,
  type SearchOptions,
  type SearchResult
} from './types';
import { VectorStore } from './vector-store';

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

function normalizeResults(results: SearchResult[]): Map<string, number> {
  if (results.length === 0) {
    return new Map();
  }

  const scores = results.map((result) => result.score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);

  return new Map(
    results.map((result) => {
      if (maxScore === minScore) {
        return [result.chunk.id, maxScore > 0 ? 1 : 0] as const;
      }

      return [result.chunk.id, (result.score - minScore) / (maxScore - minScore)] as const;
    })
  );
}

export class HybridIndex {
  private readonly chunks = new Map<string, IndexedChunk>();
  private readonly vectorStore = new VectorStore();
  private readonly keywordStore = new KeywordStore();

  add(chunks: IndexedChunk[]): void {
    const validatedChunks = chunks.map((chunk) => indexedChunkSchema.parse(chunk));

    for (const chunk of validatedChunks) {
      this.chunks.set(chunk.id, chunk);
    }

    this.vectorStore.add(validatedChunks);
    this.keywordStore.add(validatedChunks);
  }

  search(query: string, queryEmbedding: number[], options?: SearchOptions): SearchResult[] {
    const mode = options?.mode ?? 'hybrid';
    const topK = options?.topK ?? DEFAULT_TOP_K;
    const filter = options?.filter;

    if (topK <= 0) {
      return [];
    }

    if (mode === 'vector') {
      return this.vectorStore.search(queryEmbedding, { topK, filter }).map((result) => ({
        ...result,
        vectorScore: result.score
      }));
    }

    if (mode === 'keyword') {
      return this.keywordStore.search(query, { topK, filter }).map((result) => ({
        ...result,
        keywordScore: result.score
      }));
    }

    const candidateCount = Array.from(this.chunks.values()).filter((chunk) => matchesFilter(chunk, filter)).length;

    if (candidateCount === 0) {
      return [];
    }

    const vectorResults = this.vectorStore.search(queryEmbedding, { topK: candidateCount, filter });
    const keywordResults = this.keywordStore.search(query, { topK: candidateCount, filter });

    if (vectorResults.length === 0 && keywordResults.length === 0) {
      return [];
    }

    const vectorScores = normalizeResults(vectorResults);
    const keywordScores = normalizeResults(keywordResults);
    const vectorWeight = options?.vectorWeight ?? DEFAULT_VECTOR_WEIGHT;
    const keywordWeight = options?.keywordWeight ?? DEFAULT_KEYWORD_WEIGHT;
    const chunkIds = new Set([...vectorScores.keys(), ...keywordScores.keys()]);

    return Array.from(chunkIds)
      .flatMap((chunkId) => {
        const chunk = this.chunks.get(chunkId);

        if (!chunk) {
          return [];
        }

        const vectorScore = vectorScores.get(chunkId) ?? 0;
        const keywordScore = keywordScores.get(chunkId) ?? 0;

        return [
          {
            chunk,
            score: vectorWeight * vectorScore + keywordWeight * keywordScore,
            vectorScore,
            keywordScore
          }
        ];
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);
  }
}