import { z } from 'zod';

export const DEFAULT_TOP_K = 10;
export const DEFAULT_VECTOR_WEIGHT = 0.7;
export const DEFAULT_KEYWORD_WEIGHT = 0.3;

export const indexedChunkSourceTypes = ['repo', 'docs_site', 'website', 'github', 'stackoverflow'] as const;
export const indexedChunkTrustTiers = ['official_docs', 'repo', 'community', 'external'] as const;

export type IndexedChunkSourceType = (typeof indexedChunkSourceTypes)[number];
export type IndexedChunkTrustTier = (typeof indexedChunkTrustTiers)[number];
export type SearchMode = 'vector' | 'keyword' | 'hybrid';

export interface IndexedChunk {
  id: string;
  documentId: string;
  content: string;
  contentHash: string;
  headingAnchor?: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
  embedding: number[];
  sourceType: IndexedChunkSourceType;
  trustTier: IndexedChunkTrustTier;
  lastModified: Date;
}

export interface SearchResult {
  chunk: IndexedChunk;
  score: number;
  vectorScore?: number;
  keywordScore?: number;
}

export interface FilterOptions {
  sourceTypes?: IndexedChunkSourceType[];
  trustTiers?: IndexedChunkTrustTier[];
  minDate?: Date;
}

export interface SearchOptions {
  mode: SearchMode;
  topK?: number;
  vectorWeight?: number;
  keywordWeight?: number;
  filter?: FilterOptions;
}

export const indexedChunkSourceTypeSchema = z
  .literal(indexedChunkSourceTypes[0])
  .or(z.literal(indexedChunkSourceTypes[1]))
  .or(z.literal(indexedChunkSourceTypes[2]))
  .or(z.literal(indexedChunkSourceTypes[3]))
  .or(z.literal(indexedChunkSourceTypes[4]));

export const indexedChunkTrustTierSchema = z
  .literal(indexedChunkTrustTiers[0])
  .or(z.literal(indexedChunkTrustTiers[1]))
  .or(z.literal(indexedChunkTrustTiers[2]))
  .or(z.literal(indexedChunkTrustTiers[3]));

export const searchModeSchema = z.literal('vector').or(z.literal('keyword')).or(z.literal('hybrid'));

export const filterOptionsSchema = z.object({
  sourceTypes: z.array(indexedChunkSourceTypeSchema).optional(),
  trustTiers: z.array(indexedChunkTrustTierSchema).optional(),
  minDate: z.date().optional()
});

export const indexedChunkSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  content: z.string(),
  contentHash: z.string(),
  headingAnchor: z.string().optional(),
  chunkIndex: z.number().int().nonnegative(),
  metadata: z.record(z.string(), z.unknown()),
  embedding: z.array(z.number()),
  sourceType: indexedChunkSourceTypeSchema,
  trustTier: indexedChunkTrustTierSchema,
  lastModified: z.date()
});

export const searchResultSchema = z.object({
  chunk: indexedChunkSchema,
  score: z.number(),
  vectorScore: z.number().optional(),
  keywordScore: z.number().optional()
});

export const searchOptionsSchema = z.object({
  mode: searchModeSchema,
  topK: z.number().int().positive().optional(),
  vectorWeight: z.number().min(0).max(1).optional(),
  keywordWeight: z.number().min(0).max(1).optional(),
  filter: filterOptionsSchema.optional()
});