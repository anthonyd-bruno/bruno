import { describe, expect, it } from '@jest/globals';

import { Citation, citationSchema } from '../citation';
import { TrustTier } from '../trust-tier';

const validCitation: Citation = {
  sourceType: 'docs_site',
  url: 'https://example.com/docs/citation',
  title: 'Citation Title',
  headingAnchor: 'usage',
  trustTier: TrustTier.OfficialDocs,
  retrievalScore: 0.98
};

describe('citationSchema', () => {
  it('accepts a valid citation', () => {
    expect(citationSchema.parse(validCitation)).toEqual(validCitation);
  });

  it('rejects missing required fields', () => {
    const result = citationSchema.safeParse({ ...validCitation, url: undefined });

    expect(result.success).toBe(false);
  });

  it('rejects invalid sourceType values', () => {
    const result = citationSchema.safeParse({ ...validCitation, sourceType: 'invalid' });

    expect(result.success).toBe(false);
  });

  it('rejects invalid trustTier values', () => {
    const result = citationSchema.safeParse({ ...validCitation, trustTier: 'invalid' });

    expect(result.success).toBe(false);
  });
});