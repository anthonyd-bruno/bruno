import { describe, expect, it } from '@jest/globals';

import { packEvidence } from '../evidence-packer';
import { type IndexedChunk, type RankingRationale, type SearchResult } from '../types';

function createChunk(overrides: Partial<IndexedChunk> = {}): IndexedChunk {
  return {
    id: 'chunk-1',
    documentId: 'doc-1',
    content: 'Bruno install guide',
    contentHash: 'hash-1',
    headingAnchor: 'install',
    chunkIndex: 0,
    metadata: {},
    embedding: [1, 0],
    sourceType: 'docs_site',
    trustTier: 'official_docs',
    lastModified: new Date('2026-03-08T00:00:00.000Z'),
    ...overrides
  };
}

function createRanking(finalScore: number): RankingRationale {
  return {
    baseScore: finalScore - 0.1,
    finalScore,
    trustScore: 1,
    freshnessScore: 0.9,
    trustTier: 'official_docs',
    ageDays: 1,
    freshnessProfile: 'standard',
    freshnessHalfLifeDays: 180,
    matchedVolatilityIndicators: [],
    adjustments: []
  };
}

function createResult(overrides: { score?: number; chunk?: Partial<IndexedChunk>; ranking?: RankingRationale } = {}): SearchResult {
  const score = overrides.score ?? 0.92;

  return {
    chunk: createChunk(overrides.chunk),
    score,
    ranking: overrides.ranking ?? createRanking(score)
  };
}

describe('packEvidence', () => {
  it('maps ranked hits into answer-ready evidence fields', () => {
    const result = packEvidence([createResult()], {
      minEvidence: 1,
      documentsById: {
        'doc-1': {
          title: 'Install Bruno',
          url: 'https://docs.usebruno.com/install'
        }
      }
    });

    expect(result.status).toBe('ready');
    expect(result.evidence[0]).toMatchObject({
      documentId: 'doc-1',
      sourceType: 'docs_site',
      title: 'Install Bruno',
      url: 'https://docs.usebruno.com/install',
      headingAnchor: 'install',
      trustTier: 'official_docs',
      retrievalScore: 0.92,
      supportCount: 1,
      supportingChunkIds: ['chunk-1']
    });
    expect(result.evidence[0].ranking?.finalScore).toBe(0.92);
  });

  it('collapses duplicate hits from the same underlying document', () => {
    const result = packEvidence(
      [
        createResult({
          score: 0.97,
          chunk: { id: 'chunk-1', documentId: 'doc-1', headingAnchor: 'install' }
        }),
        createResult({
          score: 0.91,
          chunk: { id: 'chunk-2', documentId: 'doc-1', headingAnchor: 'usage' }
        })
      ],
      {
        minEvidence: 1,
        documentsById: {
          'doc-1': {
            title: 'Install Bruno',
            url: 'https://docs.usebruno.com/install'
          }
        }
      }
    );

    expect(result.status).toBe('ready');
    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]).toMatchObject({
      retrievalScore: 0.97,
      supportCount: 2,
      supportingChunkIds: ['chunk-1', 'chunk-2'],
      headingAnchor: 'install'
    });
  });

  it('preserves heading anchors from duplicate hits when the top hit lacks one', () => {
    const result = packEvidence(
      [
        createResult({
          score: 0.96,
          chunk: { id: 'chunk-1', headingAnchor: undefined }
        }),
        createResult({
          score: 0.89,
          chunk: { id: 'chunk-2', headingAnchor: 'cli-install' }
        })
      ],
      {
        minEvidence: 1,
        documentsById: {
          'doc-1': {
            title: 'Install Bruno',
            url: 'https://docs.usebruno.com/install'
          }
        }
      }
    );

    expect(result.status).toBe('ready');
    expect(result.evidence[0].headingAnchor).toBe('cli-install');
  });

  it('packs repo-backed evidence with sourcePath instead of requiring a url', () => {
    const result = packEvidence(
      [
        createResult({
          chunk: {
            id: 'repo-chunk-1',
            documentId: 'repo-doc-1',
            sourceType: 'repo',
            trustTier: 'repo',
            headingAnchor: 'cli',
            metadata: {}
          }
        })
      ],
      {
        minEvidence: 1,
        documentsById: {
          'repo-doc-1': {
            title: 'CLI README',
            sourcePath: 'packages/bruno-cli/README.md'
          }
        }
      }
    );

    expect(result.status).toBe('ready');
    expect(result.evidence[0]).toMatchObject({
      documentId: 'repo-doc-1',
      sourceType: 'repo',
      title: 'CLI README',
      sourcePath: 'packages/bruno-cli/README.md',
      trustTier: 'repo',
      headingAnchor: 'cli'
    });
    expect('url' in result.evidence[0]).toBe(false);
  });

  it('returns an explicit insufficient-evidence fallback when collapsed evidence is below threshold', () => {
    const result = packEvidence(
      [
        createResult({
          chunk: { id: 'chunk-1', documentId: 'doc-1' }
        }),
        createResult({
          chunk: { id: 'chunk-2', documentId: 'doc-1' }
        })
      ],
      {
        minEvidence: 2,
        documentsById: {
          'doc-1': {
            title: 'Install Bruno',
            url: 'https://docs.usebruno.com/install'
          }
        }
      }
    );

    expect(result).toEqual({
      status: 'insufficient_evidence',
      reason: 'below_minimum_evidence',
      evidence: [],
      totalHits: 2,
      packedEvidenceCount: 1,
      minEvidence: 2
    });
  });

  it('supports metadata-based field resolution and empty result edge cases', () => {
    const metadataResult = packEvidence(
      [
        createResult({
          chunk: {
            metadata: {
              title: 'FAQ',
              canonical_url: 'https://docs.usebruno.com/faq'
            }
          }
        })
      ],
      { minEvidence: 1 }
    );

    expect(metadataResult.status).toBe('ready');
    expect(metadataResult.evidence[0]).toMatchObject({
      title: 'FAQ',
      url: 'https://docs.usebruno.com/faq'
    });

    expect(packEvidence([], { minEvidence: 1 })).toEqual({
      status: 'insufficient_evidence',
      reason: 'below_minimum_evidence',
      evidence: [],
      totalHits: 0,
      packedEvidenceCount: 0,
      minEvidence: 1
    });
  });
});