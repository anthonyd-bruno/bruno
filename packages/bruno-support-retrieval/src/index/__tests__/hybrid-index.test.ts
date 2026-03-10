import { describe, expect, it } from '@jest/globals';

import { HybridIndex } from '../hybrid-index';
import { type IndexedChunk } from '../types';

function createChunk(overrides: Partial<IndexedChunk>): IndexedChunk {
  return {
    id: 'chunk-1',
    documentId: 'doc-1',
    content: 'Bruno collection guide',
    contentHash: 'hash-1',
    chunkIndex: 0,
    metadata: {},
    embedding: [1, 0],
    sourceType: 'docs_site',
    trustTier: 'official_docs',
    lastModified: new Date('2026-03-08T00:00:00.000Z'),
    ...overrides
  };
}

describe('HybridIndex', () => {
  function createIndex(): HybridIndex {
    const index = new HybridIndex();

    index.add([
      createChunk({
        id: 'chunk-1',
        content: 'Bruno collection guide',
        embedding: [1, 0],
        sourceType: 'docs_site'
      }),
      createChunk({
        id: 'chunk-2',
        content: 'collection collection collection',
        embedding: [0, 1],
        sourceType: 'github',
        trustTier: 'community'
      }),
      createChunk({
        id: 'chunk-3',
        content: 'authentication reference',
        embedding: [0.6, 0.4],
        sourceType: 'repo',
        trustTier: 'repo',
        lastModified: new Date('2024-03-08T00:00:00.000Z')
      })
    ]);

    return index;
  }

  it('combines normalized vector and keyword scores in hybrid mode', () => {
    const results = createIndex().search('bruno collection', [0, 1], {
      mode: 'hybrid',
      ranking: { enabled: false }
    });

    expect(results[0].chunk.id).toBe('chunk-2');
    expect(results[0].vectorScore).toBeDefined();
    expect(results[0].keywordScore).toBeDefined();
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('uses only vector scores in vector mode', () => {
    const results = createIndex().search('bruno collection', [0, 1], {
      mode: 'vector',
      ranking: { enabled: false }
    });

    expect(results[0].chunk.id).toBe('chunk-2');
    expect(results[0].vectorScore).toBe(results[0].score);
    expect(results[0].keywordScore).toBeUndefined();
  });

  it('uses only keyword scores in keyword mode', () => {
    const results = createIndex().search('bruno collection', [0, 1], {
      mode: 'keyword',
      ranking: { enabled: false }
    });

    expect(results[0].chunk.id).toBe('chunk-1');
    expect(results[0].keywordScore).toBe(results[0].score);
    expect(results[0].vectorScore).toBeUndefined();
  });

  it('changes ranking when custom weights favor keyword search', () => {
    const results = createIndex().search('bruno collection', [0, 1], {
      mode: 'hybrid',
      vectorWeight: 0.2,
      keywordWeight: 0.8,
      ranking: { enabled: false }
    });

    expect(results[0].chunk.id).toBe('chunk-1');
  });

  it('applies filters in hybrid mode', () => {
    const results = createIndex().search('bruno collection', [0, 1], {
      mode: 'hybrid',
      filter: {
        sourceTypes: ['docs_site'],
        trustTiers: ['official_docs'],
        minDate: new Date('2025-01-01T00:00:00.000Z')
      }
    });

    expect(results.map((result) => result.chunk.id)).toEqual(['chunk-1']);
  });

  it('limits final results with topK', () => {
    const results = createIndex().search('collection', [0, 1], { mode: 'hybrid', topK: 2 });

    expect(results).toHaveLength(2);
  });

  it('adds ranking rationale by default without removing vector and keyword scores', () => {
    const results = createIndex().search('bruno collection', [0, 1], { mode: 'hybrid' });

    expect(results[0].ranking).toBeDefined();
    expect(results[0].ranking?.finalScore).toBe(results[0].score);
    expect(results[0].vectorScore).toBeDefined();
    expect(results[0].keywordScore).toBeDefined();
  });
});