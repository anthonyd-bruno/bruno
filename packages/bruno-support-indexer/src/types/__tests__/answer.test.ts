import { describe, expect, it } from '@jest/globals';

import { Answer, answerSchema } from '../answer';
import { TrustTier } from '../trust-tier';

const validAnswer: Answer = {
  id: 'answer-1',
  query: 'How do I import a collection?',
  content: 'Use the import menu.',
  citations: [
    {
      sourceType: 'docs_site',
      url: 'https://example.com/docs/import',
      title: 'Import Docs',
      trustTier: TrustTier.OfficialDocs,
      retrievalScore: 0.92
    }
  ],
  confidence: 0.9,
  generatedAt: new Date('2026-03-08T00:00:00.000Z'),
  modelVersion: 'gpt-test'
};

describe('answerSchema', () => {
  it('accepts a valid answer', () => {
    expect(answerSchema.parse(validAnswer)).toEqual(validAnswer);
  });

  it('rejects missing required fields', () => {
    const result = answerSchema.safeParse({ ...validAnswer, content: undefined });

    expect(result.success).toBe(false);
  });

  it('rejects confidence values below 0', () => {
    const result = answerSchema.safeParse({ ...validAnswer, confidence: -0.1 });

    expect(result.success).toBe(false);
  });

  it('rejects confidence values above 1', () => {
    const result = answerSchema.safeParse({ ...validAnswer, confidence: 1.1 });

    expect(result.success).toBe(false);
  });
});