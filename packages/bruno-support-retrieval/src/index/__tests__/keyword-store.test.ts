import { describe, expect, it } from '@jest/globals';

import { type IndexedChunk } from '../types';
import { KeywordStore } from '../keyword-store';

function createChunk(overrides: Partial<IndexedChunk>): IndexedChunk {
  return {
    id: 'chunk-1',
    documentId: 'doc-1',
    content: 'Bruno collection import guide',
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

describe('KeywordStore', () => {
  it('ranks documents containing query terms higher with BM25', () => {
    const store = new KeywordStore();

    store.add([
      createChunk({ id: 'chunk-1', content: 'Bruno collection import guide' }),
      createChunk({ id: 'chunk-2', content: 'API authentication reference' }),
      createChunk({ id: 'chunk-3', content: 'Bruno import import tutorial' })
    ]);

    const results = store.search('Bruno import');

    expect(results.map((result) => result.chunk.id)).toEqual(['chunk-3', 'chunk-1']);
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it('tokenizes by lowercasing and splitting punctuation', () => {
    const store = new KeywordStore();

    store.add([
      createChunk({ id: 'chunk-1', content: 'Bruno, Collections!' }),
      createChunk({ id: 'chunk-2', content: 'Authentication only' })
    ]);

    const results = store.search('bruno collections');

    expect(results.map((result) => result.chunk.id)).toEqual(['chunk-1']);
  });

  it('removes stopwords during tokenization', () => {
    const store = new KeywordStore();

    store.add([createChunk({ id: 'chunk-1', content: 'the and it Bruno guide' })]);

    expect(store.search('the and it')).toEqual([]);
    expect(store.search('Bruno')).toHaveLength(1);
  });

  it('limits results with topK', () => {
    const store = new KeywordStore();

    store.add([
      createChunk({ id: 'chunk-1', content: 'Bruno import guide' }),
      createChunk({ id: 'chunk-2', content: 'Bruno import tutorial' }),
      createChunk({ id: 'chunk-3', content: 'Bruno import manual' })
    ]);

    expect(store.search('Bruno import', { topK: 2 })).toHaveLength(2);
  });

  it('applies filters before returning results', () => {
    const store = new KeywordStore();

    store.add([
      createChunk({ id: 'chunk-1', sourceType: 'docs_site', trustTier: 'official_docs' }),
      createChunk({
        id: 'chunk-2',
        sourceType: 'github',
        trustTier: 'community',
        lastModified: new Date('2024-01-01T00:00:00.000Z')
      })
    ]);

    const sourceFiltered = store.search('Bruno guide', { filter: { sourceTypes: ['github'] } });
    const trustFiltered = store.search('Bruno guide', { filter: { trustTiers: ['community'] } });
    const dateFiltered = store.search('Bruno guide', {
      filter: { minDate: new Date('2026-01-01T00:00:00.000Z') }
    });

    expect(sourceFiltered.map((result) => result.chunk.id)).toEqual(['chunk-2']);
    expect(trustFiltered.map((result) => result.chunk.id)).toEqual(['chunk-2']);
    expect(dateFiltered.map((result) => result.chunk.id)).toEqual(['chunk-1']);
  });
});