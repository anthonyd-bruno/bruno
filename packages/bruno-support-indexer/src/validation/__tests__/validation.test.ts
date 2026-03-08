import { describe, expect, it } from '@jest/globals';
import { ZodError } from 'zod';

import { TrustTier } from '../../types';
import { sourceDocumentSchema } from '../../types/source-document';
import { safeValidate, validateSourceDocument } from '../index';

const validSourceDocument = {
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

describe('validation utilities', () => {
  it('safeValidate returns typed data for valid input', () => {
    const result = safeValidate(sourceDocumentSchema, validSourceDocument);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validSourceDocument);
    }
  });

  it('safeValidate returns a ZodError for invalid input', () => {
    const result = safeValidate(sourceDocumentSchema, { ...validSourceDocument, id: 123 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
    }
  });

  it('validateSourceDocument throws a clear error message on failure', () => {
    expect(() =>
      validateSourceDocument({ ...validSourceDocument, trustTier: 'invalid' })
    ).toThrow(/SourceDocument validation failed: trustTier:/);
  });
});