import { z } from 'zod';

import { TrustTier, trustTierSchema } from './trust-tier';

export const sourceTypes = ['repo', 'docs_site', 'website', 'github', 'stackoverflow'] as const;

export type SourceType = (typeof sourceTypes)[number];

export interface SourceDocument {
  id: string;
  sourceType: SourceType;
  url?: string;
  sourcePath?: string;
  title: string;
  content: string;
  contentHash: string;
  trustTier: TrustTier;
  lastModified: Date;
  lastSeen: Date;
  metadata: Record<string, unknown>;
}

export const sourceTypeSchema = z
  .literal(sourceTypes[0])
  .or(z.literal(sourceTypes[1]))
  .or(z.literal(sourceTypes[2]))
  .or(z.literal(sourceTypes[3]))
  .or(z.literal(sourceTypes[4]));

export const sourceDocumentSchema = z.object({
  id: z.string(),
  sourceType: sourceTypeSchema,
  url: z.string().url().optional(),
  sourcePath: z.string().optional(),
  title: z.string(),
  content: z.string(),
  contentHash: z.string(),
  trustTier: trustTierSchema,
  lastModified: z.date(),
  lastSeen: z.date(),
  metadata: z.record(z.string(), z.unknown())
});