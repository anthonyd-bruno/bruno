import { z } from 'zod';

export const DEFAULT_TOP_K = 10;
export const DEFAULT_VECTOR_WEIGHT = 0.7;
export const DEFAULT_KEYWORD_WEIGHT = 0.3;
export const DEFAULT_TRUST_WEIGHT = 0.2;
export const DEFAULT_FRESHNESS_WEIGHT = 0.15;
export const DEFAULT_FRESHNESS_HALF_LIFE_DAYS = 180;
export const DEFAULT_VOLATILE_FRESHNESS_HALF_LIFE_DAYS = 30;
export const DEFAULT_MIN_EVIDENCE = 2;

export const indexedChunkSourceTypes = ['repo', 'docs_site', 'website', 'github', 'stackoverflow'] as const;
export const indexedChunkTrustTiers = ['official_docs', 'repo', 'community', 'external'] as const;
export const rankingAdjustmentSignals = ['trust', 'freshness'] as const;
export const rankingAdjustmentDirections = ['boost', 'penalty', 'neutral'] as const;
export const rankingAdjustmentBases = ['trust_tier', 'last_modified', 'volatile_content'] as const;
export const freshnessProfiles = ['standard', 'volatile'] as const;
export const evidencePackStatuses = ['ready', 'insufficient_evidence'] as const;
export const evidencePackReasons = ['below_minimum_evidence'] as const;
export const supportQueryIntents = [
  'install',
  'cli',
  'scripting',
  'auth',
  'pricing',
  'troubleshooting',
  'version_release',
  'unknown'
] as const;
export const classifierOverrideMatchModes = ['all', 'any'] as const;

export type IndexedChunkSourceType = (typeof indexedChunkSourceTypes)[number];
export type IndexedChunkTrustTier = (typeof indexedChunkTrustTiers)[number];
export type SearchMode = 'vector' | 'keyword' | 'hybrid';
export type RankingAdjustmentSignal = (typeof rankingAdjustmentSignals)[number];
export type RankingAdjustmentDirection = (typeof rankingAdjustmentDirections)[number];
export type RankingAdjustmentBasis = (typeof rankingAdjustmentBases)[number];
export type FreshnessProfile = (typeof freshnessProfiles)[number];
export type EvidencePackStatus = (typeof evidencePackStatuses)[number];
export type EvidencePackReason = (typeof evidencePackReasons)[number];
export type SupportQueryIntent = (typeof supportQueryIntents)[number];
export type ClassifierOverrideMatchMode = (typeof classifierOverrideMatchModes)[number];

export type TrustTierScoreOverrides = Partial<Record<IndexedChunkTrustTier, number>>;

export interface IndexedChunk {
  id: string;
  documentId: string;
  content: string;
  contentHash: string;
  headingAnchor?: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
  embedding: number[];
  sourceType: IndexedChunkSourceType;
  trustTier: IndexedChunkTrustTier;
  lastModified: Date;
}

export interface SearchResult {
  chunk: IndexedChunk;
  score: number;
  vectorScore?: number;
  keywordScore?: number;
  ranking?: RankingRationale;
}

export interface FilterOptions {
  sourceTypes?: IndexedChunkSourceType[];
  trustTiers?: IndexedChunkTrustTier[];
  minDate?: Date;
}

export interface RankingAdjustment {
  signal: RankingAdjustmentSignal;
  basis: RankingAdjustmentBasis;
  score: number;
  weight: number;
  baseline: number;
  contribution: number;
  direction: RankingAdjustmentDirection;
}

export interface RankingRationale {
  baseScore: number;
  finalScore: number;
  trustScore: number;
  freshnessScore: number;
  trustTier: IndexedChunkTrustTier;
  ageDays: number;
  freshnessProfile: FreshnessProfile;
  freshnessHalfLifeDays: number;
  matchedVolatilityIndicators: string[];
  adjustments: RankingAdjustment[];
}

export interface RankingOptions {
  enabled?: boolean;
  trustWeight?: number;
  freshnessWeight?: number;
  trustTierScores?: TrustTierScoreOverrides;
  freshnessHalfLifeDays?: number;
  volatileFreshnessHalfLifeDays?: number;
  volatilityIndicators?: string[];
  now?: Date;
}

export interface SearchOptions {
  mode: SearchMode;
  topK?: number;
  vectorWeight?: number;
  keywordWeight?: number;
  filter?: FilterOptions;
  ranking?: RankingOptions;
}

export interface EvidenceDocumentReference {
  title?: string;
  url?: string;
  sourcePath?: string;
}

export interface EvidenceBundleBase {
  documentId: string;
  sourceType: IndexedChunkSourceType;
  title: string;
  headingAnchor?: string;
  trustTier: IndexedChunkTrustTier;
  retrievalScore: number;
  ranking?: RankingRationale;
  supportCount: number;
  supportingChunkIds: string[];
}

export type EvidenceBundle =
  | (EvidenceBundleBase & { url: string; sourcePath?: never })
  | (EvidenceBundleBase & { sourcePath: string; url?: never });

export interface EvidencePackOptions {
  minEvidence?: number;
  maxEvidence?: number;
  documentsById?: Record<string, EvidenceDocumentReference>;
}

export interface SupportQueryIntentScores {
  install: number;
  cli: number;
  scripting: number;
  auth: number;
  pricing: number;
  troubleshooting: number;
  version_release: number;
  unknown: number;
}

export interface SupportQueryClassification {
  intent: SupportQueryIntent;
  score: number;
  matchedSignals: string[];
  scores: SupportQueryIntentScores;
  isFallback: boolean;
}

export interface SupportQueryIntentTermOverrides {
  install?: string[];
  cli?: string[];
  scripting?: string[];
  auth?: string[];
  pricing?: string[];
  troubleshooting?: string[];
  version_release?: string[];
}

export interface SupportQueryClassifierOverride {
  intent: SupportQueryIntent;
  terms: string[];
  matchMode?: ClassifierOverrideMatchMode;
}

export interface SupportQueryClassifierConfig {
  minimumScore?: number;
  minimumMargin?: number;
  overrides?: SupportQueryClassifierOverride[];
  extraTermsByIntent?: SupportQueryIntentTermOverrides;
}

export interface RoutedEvidenceOptions {
  minEvidence?: number;
  maxEvidence?: number;
}

export interface SupportQueryRoutingRule {
  search: SearchOptions;
  evidence?: RoutedEvidenceOptions;
}

export interface SupportQueryRoutingRuleOverride {
  search?: Partial<SearchOptions>;
  evidence?: RoutedEvidenceOptions;
}

export interface SupportQueryRouteOverrides {
  install?: SupportQueryRoutingRuleOverride;
  cli?: SupportQueryRoutingRuleOverride;
  scripting?: SupportQueryRoutingRuleOverride;
  auth?: SupportQueryRoutingRuleOverride;
  pricing?: SupportQueryRoutingRuleOverride;
  troubleshooting?: SupportQueryRoutingRuleOverride;
  version_release?: SupportQueryRoutingRuleOverride;
  unknown?: SupportQueryRoutingRuleOverride;
}

export interface SupportQueryRoutingConfig {
  classifier?: SupportQueryClassifierConfig;
  routeOverrides?: SupportQueryRouteOverrides;
}

export interface SupportQueryRoutePlan {
  query: string;
  intent: SupportQueryIntent;
  classification: SupportQueryClassification;
  search: SearchOptions;
  evidence?: RoutedEvidenceOptions;
}

export interface ReadyEvidencePackResult {
  status: 'ready';
  evidence: EvidenceBundle[];
  totalHits: number;
  packedEvidenceCount: number;
  minEvidence: number;
}

export interface InsufficientEvidencePackResult {
  status: 'insufficient_evidence';
  reason: 'below_minimum_evidence';
  evidence: [];
  totalHits: number;
  packedEvidenceCount: number;
  minEvidence: number;
}

export type EvidencePackResult = ReadyEvidencePackResult | InsufficientEvidencePackResult;

export const indexedChunkSourceTypeSchema = z
  .literal(indexedChunkSourceTypes[0])
  .or(z.literal(indexedChunkSourceTypes[1]))
  .or(z.literal(indexedChunkSourceTypes[2]))
  .or(z.literal(indexedChunkSourceTypes[3]))
  .or(z.literal(indexedChunkSourceTypes[4]));

export const indexedChunkTrustTierSchema = z
  .literal(indexedChunkTrustTiers[0])
  .or(z.literal(indexedChunkTrustTiers[1]))
  .or(z.literal(indexedChunkTrustTiers[2]))
  .or(z.literal(indexedChunkTrustTiers[3]));

export const rankingAdjustmentSignalSchema = z.enum(rankingAdjustmentSignals);
export const rankingAdjustmentDirectionSchema = z.enum(rankingAdjustmentDirections);
export const rankingAdjustmentBasisSchema = z.enum(rankingAdjustmentBases);
export const freshnessProfileSchema = z.enum(freshnessProfiles);
export const evidencePackStatusSchema = z.enum(evidencePackStatuses);
export const evidencePackReasonSchema = z.enum(evidencePackReasons);
export const supportQueryIntentSchema = z.enum(supportQueryIntents);
export const classifierOverrideMatchModeSchema = z.enum(classifierOverrideMatchModes);

export const searchModeSchema = z.literal('vector').or(z.literal('keyword')).or(z.literal('hybrid'));

export const filterOptionsSchema = z.object({
  sourceTypes: z.array(indexedChunkSourceTypeSchema).optional(),
  trustTiers: z.array(indexedChunkTrustTierSchema).optional(),
  minDate: z.date().optional()
});

export const indexedChunkSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  content: z.string(),
  contentHash: z.string(),
  headingAnchor: z.string().optional(),
  chunkIndex: z.number().int().nonnegative(),
  metadata: z.record(z.string(), z.unknown()),
  embedding: z.array(z.number()),
  sourceType: indexedChunkSourceTypeSchema,
  trustTier: indexedChunkTrustTierSchema,
  lastModified: z.date()
});

export const trustTierScoreOverridesSchema = z.object({
  official_docs: z.number().min(0).max(1).optional(),
  repo: z.number().min(0).max(1).optional(),
  community: z.number().min(0).max(1).optional(),
  external: z.number().min(0).max(1).optional()
});

export const rankingAdjustmentSchema = z.object({
  signal: rankingAdjustmentSignalSchema,
  basis: rankingAdjustmentBasisSchema,
  score: z.number(),
  weight: z.number(),
  baseline: z.number(),
  contribution: z.number(),
  direction: rankingAdjustmentDirectionSchema
});

export const rankingRationaleSchema = z.object({
  baseScore: z.number(),
  finalScore: z.number(),
  trustScore: z.number(),
  freshnessScore: z.number(),
  trustTier: indexedChunkTrustTierSchema,
  ageDays: z.number().nonnegative(),
  freshnessProfile: freshnessProfileSchema,
  freshnessHalfLifeDays: z.number().positive(),
  matchedVolatilityIndicators: z.array(z.string()),
  adjustments: z.array(rankingAdjustmentSchema)
});

export const rankingOptionsSchema = z.object({
  enabled: z.boolean().optional(),
  trustWeight: z.number().min(0).optional(),
  freshnessWeight: z.number().min(0).optional(),
  trustTierScores: trustTierScoreOverridesSchema.optional(),
  freshnessHalfLifeDays: z.number().positive().optional(),
  volatileFreshnessHalfLifeDays: z.number().positive().optional(),
  volatilityIndicators: z.array(z.string().min(1)).optional(),
  now: z.date().optional()
});

export const searchResultSchema = z.object({
  chunk: indexedChunkSchema,
  score: z.number(),
  vectorScore: z.number().optional(),
  keywordScore: z.number().optional(),
  ranking: rankingRationaleSchema.optional()
});

export const searchOptionsSchema = z.object({
  mode: searchModeSchema,
  topK: z.number().int().positive().optional(),
  vectorWeight: z.number().min(0).max(1).optional(),
  keywordWeight: z.number().min(0).max(1).optional(),
  filter: filterOptionsSchema.optional(),
  ranking: rankingOptionsSchema.optional()
});

export const evidenceDocumentReferenceSchema = z.object({
  title: z.string().min(1).optional(),
  url: z.string().url().optional(),
  sourcePath: z.string().min(1).optional()
});

export const evidenceBundleSchema = z
  .object({
    documentId: z.string(),
    sourceType: indexedChunkSourceTypeSchema,
    title: z.string(),
    headingAnchor: z.string().optional(),
    trustTier: indexedChunkTrustTierSchema,
    retrievalScore: z.number(),
    ranking: rankingRationaleSchema.optional(),
    supportCount: z.number().int().positive(),
    supportingChunkIds: z.array(z.string()),
    url: z.string().url().optional(),
    sourcePath: z.string().min(1).optional()
  })
  .refine((value) => Number(Boolean(value.url)) + Number(Boolean(value.sourcePath)) === 1, {
    message: 'EvidenceBundle requires exactly one of url or sourcePath'
  });

export const evidencePackOptionsSchema = z.object({
  minEvidence: z.number().int().nonnegative().optional(),
  maxEvidence: z.number().int().nonnegative().optional(),
  documentsById: z.record(z.string(), evidenceDocumentReferenceSchema).optional()
});

export const supportQueryIntentScoresSchema = z.object({
  install: z.number().nonnegative(),
  cli: z.number().nonnegative(),
  scripting: z.number().nonnegative(),
  auth: z.number().nonnegative(),
  pricing: z.number().nonnegative(),
  troubleshooting: z.number().nonnegative(),
  version_release: z.number().nonnegative(),
  unknown: z.number().nonnegative()
});

export const supportQueryClassificationSchema = z.object({
  intent: supportQueryIntentSchema,
  score: z.number().nonnegative(),
  matchedSignals: z.array(z.string()),
  scores: supportQueryIntentScoresSchema,
  isFallback: z.boolean()
});

export const supportQueryIntentTermOverridesSchema = z.object({
  install: z.array(z.string().min(1)).optional(),
  cli: z.array(z.string().min(1)).optional(),
  scripting: z.array(z.string().min(1)).optional(),
  auth: z.array(z.string().min(1)).optional(),
  pricing: z.array(z.string().min(1)).optional(),
  troubleshooting: z.array(z.string().min(1)).optional(),
  version_release: z.array(z.string().min(1)).optional()
});

export const supportQueryClassifierOverrideSchema = z.object({
  intent: supportQueryIntentSchema,
  terms: z.array(z.string().min(1)).min(1),
  matchMode: classifierOverrideMatchModeSchema.optional()
});

export const supportQueryClassifierConfigSchema = z.object({
  minimumScore: z.number().nonnegative().optional(),
  minimumMargin: z.number().nonnegative().optional(),
  overrides: z.array(supportQueryClassifierOverrideSchema).optional(),
  extraTermsByIntent: supportQueryIntentTermOverridesSchema.optional()
});

export const routedEvidenceOptionsSchema = z.object({
  minEvidence: z.number().int().nonnegative().optional(),
  maxEvidence: z.number().int().nonnegative().optional()
});

export const supportQueryRoutingRuleSchema = z.object({
  search: searchOptionsSchema,
  evidence: routedEvidenceOptionsSchema.optional()
});

export const supportQueryRoutingRuleOverrideSchema = z.object({
  search: searchOptionsSchema.partial().optional(),
  evidence: routedEvidenceOptionsSchema.optional()
});

export const supportQueryRouteOverridesSchema = z.object({
  install: supportQueryRoutingRuleOverrideSchema.optional(),
  cli: supportQueryRoutingRuleOverrideSchema.optional(),
  scripting: supportQueryRoutingRuleOverrideSchema.optional(),
  auth: supportQueryRoutingRuleOverrideSchema.optional(),
  pricing: supportQueryRoutingRuleOverrideSchema.optional(),
  troubleshooting: supportQueryRoutingRuleOverrideSchema.optional(),
  version_release: supportQueryRoutingRuleOverrideSchema.optional(),
  unknown: supportQueryRoutingRuleOverrideSchema.optional()
});

export const supportQueryRoutingConfigSchema = z.object({
  classifier: supportQueryClassifierConfigSchema.optional(),
  routeOverrides: supportQueryRouteOverridesSchema.optional()
});

export const supportQueryRoutePlanSchema = z.object({
  query: z.string(),
  intent: supportQueryIntentSchema,
  classification: supportQueryClassificationSchema,
  search: searchOptionsSchema,
  evidence: routedEvidenceOptionsSchema.optional()
});

export const readyEvidencePackResultSchema = z.object({
  status: z.literal('ready'),
  evidence: z.array(evidenceBundleSchema),
  totalHits: z.number().int().nonnegative(),
  packedEvidenceCount: z.number().int().nonnegative(),
  minEvidence: z.number().int().nonnegative()
});

export const insufficientEvidencePackResultSchema = z.object({
  status: z.literal('insufficient_evidence'),
  reason: z.literal('below_minimum_evidence'),
  evidence: z.array(evidenceBundleSchema).length(0),
  totalHits: z.number().int().nonnegative(),
  packedEvidenceCount: z.number().int().nonnegative(),
  minEvidence: z.number().int().nonnegative()
});

export const evidencePackResultSchema = z.discriminatedUnion('status', [
  readyEvidencePackResultSchema,
  insufficientEvidencePackResultSchema
]);