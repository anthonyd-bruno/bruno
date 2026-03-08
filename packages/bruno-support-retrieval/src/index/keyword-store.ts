import {
  DEFAULT_TOP_K,
  type FilterOptions,
  indexedChunkSchema,
  type IndexedChunk,
  type SearchResult
} from './types';

const BM25_K1 = 1.2;
const BM25_B = 0.75;

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'and',
  'or',
  'but',
  'not',
  'with',
  'this',
  'that',
  'it',
  'be',
  'as',
  'by',
  'from',
  'have',
  'has',
  'had'
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\p{P}]+/u)
    .filter((token) => token.length > 0 && !STOPWORDS.has(token));
}

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

export class KeywordStore {
  private readonly chunks = new Map<string, IndexedChunk>();
  private readonly documentTermFrequencies = new Map<string, Map<string, number>>();
  private readonly documentLengths = new Map<string, number>();
  private readonly invertedIndex = new Map<string, Set<string>>();

  private averageDocumentLength = 0;

  add(chunks: IndexedChunk[]): void {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, indexedChunkSchema.parse(chunk));
    }

    this.rebuildIndex();
  }

  search(query: string, options?: { topK?: number; filter?: FilterOptions }): SearchResult[] {
    if (this.chunks.size === 0) {
      return [];
    }

    const topK = options?.topK ?? DEFAULT_TOP_K;

    if (topK <= 0) {
      return [];
    }

    const queryTerms = [...new Set(tokenize(query))];

    if (queryTerms.length === 0) {
      return [];
    }

    const candidateIds = new Set<string>();

    for (const term of queryTerms) {
      const matchingChunkIds = this.invertedIndex.get(term);

      if (!matchingChunkIds) {
        continue;
      }

      for (const chunkId of matchingChunkIds) {
        candidateIds.add(chunkId);
      }
    }

    return Array.from(candidateIds)
      .map((chunkId) => this.chunks.get(chunkId))
      .filter((chunk): chunk is IndexedChunk => chunk !== undefined)
      .filter((chunk) => matchesFilter(chunk, options?.filter))
      .map((chunk) => ({
        chunk,
        score: this.calculateBm25Score(chunk.id, queryTerms)
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, topK);
  }

  private rebuildIndex(): void {
    this.documentTermFrequencies.clear();
    this.documentLengths.clear();
    this.invertedIndex.clear();

    let totalDocumentLength = 0;

    for (const chunk of this.chunks.values()) {
      const tokens = tokenize(chunk.content);
      const termFrequencies = new Map<string, number>();

      for (const token of tokens) {
        termFrequencies.set(token, (termFrequencies.get(token) ?? 0) + 1);
      }

      this.documentTermFrequencies.set(chunk.id, termFrequencies);
      this.documentLengths.set(chunk.id, tokens.length);
      totalDocumentLength += tokens.length;

      for (const term of termFrequencies.keys()) {
        const indexedChunkIds = this.invertedIndex.get(term) ?? new Set<string>();
        indexedChunkIds.add(chunk.id);
        this.invertedIndex.set(term, indexedChunkIds);
      }
    }

    this.averageDocumentLength = this.chunks.size === 0 ? 0 : totalDocumentLength / this.chunks.size;
  }

  private calculateBm25Score(chunkId: string, queryTerms: string[]): number {
    const termFrequencies = this.documentTermFrequencies.get(chunkId);
    const documentLength = this.documentLengths.get(chunkId) ?? 0;
    const averageDocumentLength = this.averageDocumentLength || 1;
    const totalDocuments = this.chunks.size;

    if (!termFrequencies || documentLength === 0 || totalDocuments === 0) {
      return 0;
    }

    return queryTerms.reduce((score, term) => {
      const termFrequency = termFrequencies.get(term) ?? 0;

      if (termFrequency === 0) {
        return score;
      }

      const documentFrequency = this.invertedIndex.get(term)?.size ?? 0;

      if (documentFrequency === 0) {
        return score;
      }

      const tf = termFrequency / documentLength;
      const idf = Math.log((totalDocuments - documentFrequency + 0.5) / (documentFrequency + 0.5) + 1);
      const normalization = 1 - BM25_B + (BM25_B * documentLength) / averageDocumentLength;
      const numerator = tf * (BM25_K1 + 1);
      const denominator = tf + BM25_K1 * normalization;

      return score + idf * (numerator / denominator);
    }, 0);
  }
}