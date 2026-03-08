import { z } from 'zod';

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  headingAnchor?: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
  contentHash: string;
}

export const chunkSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  content: z.string(),
  headingAnchor: z.string().optional(),
  chunkIndex: z.number().int().nonnegative(),
  metadata: z.record(z.string(), z.unknown()),
  contentHash: z.string()
});