import { describe, expect, it } from '@jest/globals';

import { type IndexedChunk } from '../types';
import { VectorStore } from '../vector-store';

function createChunk(overrides: Partial<IndexedChunk>): IndexedChunk {
  return {
    id: 'chunk-1',
    documentId: 'doc-1',
    content: 'Bruno collection guide',
    contentHash: 'hash-1',
    chunkIndex: 0,
    metadata: {},
    embedding: [1, 0, 0],
    sourceType: 'docs_site',
    trustTier: 'official_docs',
    lastModified: new Date('2026-03-08T00:00:00.000Z'),
    ...overrides
  };
}

describe('VectorStore', () => {
  it('adds chunks and returns results ranked by cosine similarity', () => {
    const store = new VectorStore();

    store.add([
      createChunk({ id: 'chunk-1', embedding: [1, 0, 0] }),
      createChunk({ id: 'chunk-2', embedding: [0.8, 0.2, 0] }),
      createChunk({ id: 'chunk-3', embedding: [0, 1, 0] })
    ]);

    const results = store.search([1, 0, 0]);

    expect(results.map((result) => result.chunk.id)).toEqual(['chunk-1', 'chunk-2', 'chunk-3']);
    expect(results[0].score).toBeCloseTo(1);
    expect(results[1].score).toBeGreaterThan(results[2].score);
  });

  it('limits results with topK', () => {
    const store = new VectorStore();

    store.add([
      createChunk({ id: 'chunk-1', embedding: [1, 0, 0] }),
      createChunk({ id: 'chunk-2', embedding: [0.8, 0.2, 0] }),
      createChunk({ id: 'chunk-3', embedding: [0, 1, 0] })
    ]);

    expect(store.search([1, 0, 0], { topK: 2 })).toHaveLength(2);
  });

  it('filters by sourceType', () => {
    const store = new VectorStore();

    store.add([
      createChunk({ id: 'chunk-1', sourceType: 'docs_site' }),
      createChunk({ id: 'chunk-2', sourceType: 'github', embedding: [0.8, 0.2, 0] })
    ]);

    const results = store.search([1, 0, 0], { filter: { sourceTypes: ['docs_site'] } });

    expect(results.map((result) => result.chunk.id)).toEqual(['chunk-1']);
  });

  it('filters by trustTier', () => {
    const store = new VectorStore();

    store.add([
      createChunk({ id: 'chunk-1', trustTier: 'official_docs' }),
      createChunk({ id: 'chunk-2', trustTier: 'community', embedding: [0.8, 0.2, 0] })
    ]);

    const results = store.search([1, 0, 0], { filter: { trustTiers: ['community'] } });

    expect(results.map((result) => result.chunk.id)).toEqual(['chunk-2']);
  });

  it('filters by minimum lastModified date', () => {
    const store = new VectorStore();

    store.add([
      createChunk({ id: 'chunk-1', lastModified: new Date('2026-03-08T00:00:00.000Z') }),
      createChunk({
        id: 'chunk-2',
        embedding: [0.8, 0.2, 0],
        lastModified: new Date('2024-03-08T00:00:00.000Z')
      })
    ]);

    const results = store.search([1, 0, 0], {
      filter: { minDate: new Date('2025-01-01T00:00:00.000Z') }
    });

    expect(results.map((result) => result.chunk.id)).toEqual(['chunk-1']);
  });

  it('returns an empty array for an empty store', () => {
    expect(new VectorStore().search([1, 0, 0])).toEqual([]);
  });
});