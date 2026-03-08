import { describe, expect, it } from '@jest/globals';

import { SourceDocument, sourceDocumentSchema } from '../source-document';
import { TrustTier } from '../trust-tier';

const validSourceDocument: SourceDocument = {
  id: 'doc-1',
  sourceType: 'repo',
  url: 'https://example.com/repo/doc-1',
  sourcePath: 'docs/doc-1.md',
  title: 'Document 1',
  content: 'Content',
  contentHash: 'hash-1',
  trustTier: TrustTier.Repo,
  lastModified: new Date('2026-03-08T00:00:00.000Z'),
  lastSeen: new Date('2026-03-08T00:00:00.000Z'),
  metadata: { language: 'en' }
};

describe('sourceDocumentSchema', () => {
  it('accepts a valid source document', () => {
    expect(sourceDocumentSchema.parse(validSourceDocument)).toEqual(validSourceDocument);
  });

  it('rejects missing required fields', () => {
    const result = sourceDocumentSchema.safeParse({ ...validSourceDocument, title: undefined });

    expect(result.success).toBe(false);
  });

  it('rejects invalid sourceType values', () => {
    const result = sourceDocumentSchema.safeParse({ ...validSourceDocument, sourceType: 'invalid' });

    expect(result.success).toBe(false);
  });

  it('rejects invalid trustTier values', () => {
    const result = sourceDocumentSchema.safeParse({ ...validSourceDocument, trustTier: 'unknown' });

    expect(result.success).toBe(false);
  });
});