import { z } from 'zod';

import { type Citation, citationSchema } from './citation';

export interface Answer {
  id: string;
  query: string;
  content: string;
  citations: Citation[];
  confidence: number;
  generatedAt: Date;
  modelVersion?: string;
}

export const answerSchema = z.object({
  id: z.string(),
  query: z.string(),
  content: z.string(),
  citations: z.array(citationSchema),
  confidence: z.number().min(0).max(1),
  generatedAt: z.date(),
  modelVersion: z.string().optional()
});