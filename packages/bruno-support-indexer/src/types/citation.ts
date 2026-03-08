import { z } from 'zod';

import { type SourceType, sourceTypeSchema } from './source-document';
import { TrustTier, trustTierSchema } from './trust-tier';

export interface Citation {
  sourceType: SourceType;
  url: string;
  title: string;
  headingAnchor?: string;
  trustTier: TrustTier;
  retrievalScore: number;
}

export const citationSchema = z.object({
  sourceType: sourceTypeSchema,
  url: z.string().url(),
  title: z.string(),
  headingAnchor: z.string().optional(),
  trustTier: trustTierSchema,
  retrievalScore: z.number()
});