import { describe, expect, it } from '@jest/globals';

import { classifySupportQuery, planSupportQueryRoute } from '../query-routing';

describe('classifySupportQuery', () => {
  it.each([
    ['How do I install Bruno on macOS with brew?', 'install'],
    ['What CLI command runs a collection?', 'cli'],
    ['How do I write a pre-request script in Bruno?', 'scripting'],
    ['How do I configure bearer token auth?', 'auth'],
    ['What pricing plans does Bruno offer?', 'pricing'],
    ['Bruno CLI is failing with an error when I run it', 'troubleshooting'],
    ["What's new in the latest Bruno release?", 'version_release']
  ])('classifies %s as %s', (query, expectedIntent) => {
    const classification = classifySupportQuery(query);

    expect(classification.intent).toBe(expectedIntent);
    expect(classification.isFallback).toBe(false);
    expect(classification.score).toBeGreaterThan(0);
  });

  it('returns unknown for low-signal queries', () => {
    const classification = classifySupportQuery('Tell me about collections');

    expect(classification.intent).toBe('unknown');
    expect(classification.isFallback).toBe(true);
    expect(classification.score).toBe(0);
  });

  it('supports configurable classifier overrides', () => {
    const classification = classifySupportQuery('How much does token cost?', {
      overrides: [{ intent: 'auth', terms: ['token cost'] }]
    });

    expect(classification.intent).toBe('auth');
    expect(classification.matchedSignals).toContain('override:token cost');
  });
});

describe('planSupportQueryRoute', () => {
  it('returns routing output with retrieval and evidence settings', () => {
    const route = planSupportQueryRoute('What pricing plans does Bruno offer?');

    expect(route).toMatchObject({
      query: 'What pricing plans does Bruno offer?',
      intent: 'pricing',
      classification: {
        intent: 'pricing',
        isFallback: false
      },
      search: {
        mode: 'hybrid',
        topK: 6,
        filter: {
          sourceTypes: ['website', 'docs_site'],
          trustTiers: ['official_docs']
        },
        ranking: {
          trustWeight: 0.25,
          freshnessWeight: 0.35,
          freshnessHalfLifeDays: 90,
          volatileFreshnessHalfLifeDays: 14
        }
      },
      evidence: {
        minEvidence: 1,
        maxEvidence: 3
      }
    });
  });

  it('merges configurable route overrides with defaults', () => {
    const route = planSupportQueryRoute('What pricing plans does Bruno offer?', {
      routeOverrides: {
        pricing: {
          search: {
            topK: 2,
            ranking: {
              freshnessWeight: 0.5
            }
          },
          evidence: {
            maxEvidence: 1
          }
        }
      }
    });

    expect(route.intent).toBe('pricing');
    expect(route.search.mode).toBe('hybrid');
    expect(route.search.topK).toBe(2);
    expect(route.search.filter?.sourceTypes).toEqual(['website', 'docs_site']);
    expect(route.search.ranking?.trustWeight).toBe(0.25);
    expect(route.search.ranking?.freshnessWeight).toBe(0.5);
    expect(route.evidence).toEqual({ minEvidence: 1, maxEvidence: 1 });
  });

  it('uses the safe unknown route for fallback classifications', () => {
    const route = planSupportQueryRoute('Tell me about collections');

    expect(route.intent).toBe('unknown');
    expect(route.classification.isFallback).toBe(true);
    expect(route.search.filter?.trustTiers).toEqual(['official_docs', 'repo']);
    expect(route.search.topK).toBe(6);
    expect(route.evidence).toEqual({ minEvidence: 2, maxEvidence: 4 });
  });
});