import { z } from 'zod';

import { type Citation, citationSchema } from './citation';

export const evalCaseDifficulties = ['easy', 'medium', 'hard'] as const;

export type EvalCaseDifficulty = (typeof evalCaseDifficulties)[number];

export interface EvalCase {
  id: string;
  query: string;
  expectedAnswer: string;
  expectedCitations: Citation[];
  category: string;
  difficulty: EvalCaseDifficulty;
}

export const evalCaseSchema = z.object({
  id: z.string(),
  query: z.string(),
  expectedAnswer: z.string(),
  expectedCitations: z.array(citationSchema),
  category: z.string(),
  difficulty: z
    .literal(evalCaseDifficulties[0])
    .or(z.literal(evalCaseDifficulties[1]))
    .or(z.literal(evalCaseDifficulties[2]))
});