import { describe, expect, it } from '@jest/globals';

import { rerankSearchResults } from '../ranking';
import { type IndexedChunk, type SearchResult } from '../types';

const NOW = new Date('2026-03-08T00:00:00.000Z');

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
    lastModified: NOW,
    ...overrides
  };
}

function createResult({ score, chunk }: { score: number; chunk: Partial<IndexedChunk> }): SearchResult {
  return {
    chunk: createChunk(chunk),
    score
  };
}

describe('rerankSearchResults', () => {
  it('boosts trusted sources when base relevance is similar', () => {
    const results = rerankSearchResults(
      [
        createResult({
          score: 0.93,
          chunk: { id: 'official', trustTier: 'official_docs', lastModified: NOW }
        }),
        createResult({
          score: 0.96,
          chunk: { id: 'community', trustTier: 'community', lastModified: NOW }
        })
      ],
      { now: NOW, trustWeight: 0.3, freshnessWeight: 0 }
    );

    expect(results.map((result) => result.chunk.id)).toEqual(['official', 'community']);
    expect(results[0].ranking?.adjustments[0].direction).toBe('boost');
    expect(results[1].ranking?.adjustments[0].direction).toBe('penalty');
  });

  it('decays stale content when freshness weighting is enabled', () => {
    const results = rerankSearchResults(
      [
        createResult({
          score: 0.93,
          chunk: { id: 'recent', trustTier: 'repo', lastModified: new Date('2026-03-01T00:00:00.000Z') }
        }),
        createResult({
          score: 0.97,
          chunk: { id: 'stale', trustTier: 'repo', lastModified: new Date('2024-01-01T00:00:00.000Z') }
        })
      ],
      { now: NOW, trustWeight: 0, freshnessWeight: 0.35, freshnessHalfLifeDays: 180 }
    );

    expect(results.map((result) => result.chunk.id)).toEqual(['recent', 'stale']);
    expect(results[0].ranking?.freshnessScore).toBeGreaterThan(results[1].ranking?.freshnessScore ?? 0);
  });

  it('uses stricter freshness decay for volatile pages', () => {
    const results = rerankSearchResults(
      [
        createResult({
          score: 0.95,
          chunk: {
            id: 'guide',
            content: 'Bruno collection guide',
            metadata: { url: 'https://docs.usebruno.com/guides/collections' },
            lastModified: new Date('2026-01-22T00:00:00.000Z')
          }
        }),
        createResult({
          score: 0.95,
          chunk: {
            id: 'pricing',
            content: 'Bruno pricing details',
            metadata: { url: 'https://usebruno.com/pricing' },
            lastModified: new Date('2026-01-22T00:00:00.000Z')
          }
        })
      ],
      {
        now: NOW,
        trustWeight: 0,
        freshnessWeight: 0.3,
        freshnessHalfLifeDays: 180,
        volatileFreshnessHalfLifeDays: 30
      }
    );

    expect(results.map((result) => result.chunk.id)).toEqual(['guide', 'pricing']);
    expect(results[1].ranking?.freshnessProfile).toBe('volatile');
    expect(results[1].ranking?.freshnessHalfLifeDays).toBe(30);
    expect(results[1].ranking?.matchedVolatilityIndicators).toContain('pricing');
  });

  it('returns structured ranking rationale for downstream consumers', () => {
    const [result] = rerankSearchResults(
      [
        createResult({
          score: 0.9,
          chunk: {
            id: 'changelog',
            trustTier: 'official_docs',
            content: 'Release notes for Bruno',
            metadata: { url: 'https://docs.usebruno.com/changelog' },
            lastModified: new Date('2026-03-05T00:00:00.000Z')
          }
        })
      ],
      { now: NOW }
    );

    expect(result.ranking).toMatchObject({
      baseScore: 0.9,
      finalScore: result.score,
      trustTier: 'official_docs',
      freshnessProfile: 'volatile'
    });
    expect(result.ranking?.adjustments).toHaveLength(2);
    expect(result.ranking?.adjustments.map((adjustment) => adjustment.signal)).toEqual([
      'trust',
      'freshness'
    ]);
  });

  it('handles empty results and future-dated content without negative age', () => {
    expect(rerankSearchResults([], { now: NOW })).toEqual([]);

    const [result] = rerankSearchResults(
      [
        createResult({
          score: 0.5,
          chunk: {
            id: 'future-doc',
            lastModified: new Date('2026-04-01T00:00:00.000Z')
          }
        })
      ],
      { now: NOW, trustWeight: 0, freshnessWeight: 0.2 }
    );

    expect(result.ranking?.ageDays).toBe(0);
    expect(result.ranking?.freshnessScore).toBeCloseTo(1);
  });
});