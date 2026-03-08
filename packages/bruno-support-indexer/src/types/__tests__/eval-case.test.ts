import { describe, expect, it } from '@jest/globals';

import { EvalCase, evalCaseSchema } from '../eval-case';
import { TrustTier } from '../trust-tier';

const validEvalCase: EvalCase = {
  id: 'eval-1',
  query: 'How do I use variables?',
  expectedAnswer: 'Use collection or request variables.',
  expectedCitations: [
    {
      sourceType: 'docs_site',
      url: 'https://example.com/docs/variables',
      title: 'Variables',
      trustTier: TrustTier.OfficialDocs,
      retrievalScore: 0.85
    }
  ],
  category: 'variables',
  difficulty: 'medium'
};

describe('evalCaseSchema', () => {
  it('accepts a valid eval case', () => {
    expect(evalCaseSchema.parse(validEvalCase)).toEqual(validEvalCase);
  });

  it('rejects missing required fields', () => {
    const result = evalCaseSchema.safeParse({ ...validEvalCase, category: undefined });

    expect(result.success).toBe(false);
  });

  it('rejects invalid difficulty values', () => {
    const result = evalCaseSchema.safeParse({ ...validEvalCase, difficulty: 'expert' });

    expect(result.success).toBe(false);
  });
});