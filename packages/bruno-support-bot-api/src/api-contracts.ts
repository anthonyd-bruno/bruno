import { z } from 'zod';

import { TrustTier, trustTierSchema } from '../../bruno-support-indexer/src/types/trust-tier';
import {
  evidenceBundleSchema,
  evidencePackResultSchema,
  indexedChunkSourceTypeSchema,
  indexedChunkTrustTierSchema,
  routedEvidenceOptionsSchema,
  searchModeSchema,
  supportQueryClassificationSchema,
  supportQueryIntentSchema,
  type EvidenceBundle,
  type EvidencePackResult,
  type IndexedChunkSourceType,
  type IndexedChunkTrustTier,
  type RoutedEvidenceOptions,
  type SearchMode,
  type SupportQueryClassification,
  type SupportQueryIntent,
  type SupportQueryRoutePlan
} from '../../bruno-support-retrieval/src/index/types';

import type { AnswerGenerationDraft, AnswerGenerationMode } from './answer-generation-adapter';
import type { SupportAnswer } from './answer-assembly';

export const apiErrorCodeSchema = z.enum(['validation_error', 'method_not_allowed', 'not_found', 'internal_error']);

export const apiValidationIssueSchema = z
  .object({
    path: z.string(),
    message: z.string(),
    code: z.string()
  })
  .strict();

export interface ApiValidationIssue {
  path: string;
  message: string;
  code: string;
}

export const apiErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z
      .object({
        code: apiErrorCodeSchema,
        message: z.string(),
        details: z.array(apiValidationIssueSchema).optional()
      })
      .strict()
  })
  .strict();

export interface ApiErrorResponse {
  ok: false;
  error: {
    code: 'validation_error' | 'method_not_allowed' | 'not_found' | 'internal_error';
    message: string;
    details?: ApiValidationIssue[];
  };
}

const nonEmptyQuerySchema = z.string().trim().min(1, 'Query is required.');

export const sourcesRequestSchema = z
  .object({
    query: nonEmptyQuerySchema
  })
  .strict();

export interface SourcesRequest {
  query: string;
}

export const chatRequestSchema = z
  .object({
    query: nonEmptyQuerySchema,
    fallbackMessage: z.string().trim().min(1, 'Fallback message must not be empty.').optional()
  })
  .strict();

export interface ChatRequest {
  query: string;
  fallbackMessage?: string;
}

export interface SupportQueryRouteSearchSummary {
  mode: SearchMode;
  topK?: number;
  vectorWeight?: number;
  keywordWeight?: number;
  filter?: {
    sourceTypes?: IndexedChunkSourceType[];
    trustTiers?: IndexedChunkTrustTier[];
  };
  ranking?: {
    trustWeight?: number;
    freshnessWeight?: number;
    freshnessHalfLifeDays?: number;
    volatileFreshnessHalfLifeDays?: number;
    volatilityIndicators?: string[];
  };
}

const routeSearchFilterSchema = z
  .object({
    sourceTypes: z.array(indexedChunkSourceTypeSchema).optional(),
    trustTiers: z.array(indexedChunkTrustTierSchema).optional()
  })
  .strict();

const routeSearchRankingSchema = z
  .object({
    trustWeight: z.number().min(0).optional(),
    freshnessWeight: z.number().min(0).optional(),
    freshnessHalfLifeDays: z.number().positive().optional(),
    volatileFreshnessHalfLifeDays: z.number().positive().optional(),
    volatilityIndicators: z.array(z.string().min(1)).optional()
  })
  .strict();

const routeSearchSummarySchema = z
  .object({
    mode: searchModeSchema,
    topK: z.number().int().positive().optional(),
    vectorWeight: z.number().min(0).max(1).optional(),
    keywordWeight: z.number().min(0).max(1).optional(),
    filter: routeSearchFilterSchema.optional(),
    ranking: routeSearchRankingSchema.optional()
  })
  .strict();

export const supportQueryRouteSummarySchema = z
  .object({
    query: z.string(),
    intent: supportQueryIntentSchema,
    classification: supportQueryClassificationSchema,
    search: routeSearchSummarySchema,
    evidence: routedEvidenceOptionsSchema.optional()
  })
  .strict();

export interface SupportQueryRouteSummary {
  query: string;
  intent: SupportQueryIntent;
  classification: SupportQueryClassification;
  search: SupportQueryRouteSearchSummary;
  evidence?: RoutedEvidenceOptions;
}

export const healthResponseSchema = z
  .object({
    ok: z.literal(true),
    service: z.string().min(1),
    status: z.literal('ok'),
    policyVersion: z.string().min(1),
    timestamp: z.string().datetime()
  })
  .strict();

export interface HealthResponse {
  ok: true;
  service: string;
  status: 'ok';
  policyVersion: string;
  timestamp: string;
}

const answerGenerationModeSchema = z.enum(['grounded', 'fallback']);
const supportAnswerConfidenceLabelSchema = z.enum(['high', 'medium', 'low', 'insufficient']);
const fallbackReasonSchema = z.enum(['weak_evidence', 'insufficient_evidence', 'security_sensitive']);
const supportAnswerSafetyClassificationSchema = z.enum([
  'normal',
  'low_confidence',
  'insufficient_evidence',
  'security_sensitive'
]);
const supportAnswerEscalationChannelSchema = z.enum([
  'none',
  'security_email',
  'docs',
  'github_discussions',
  'github_issues',
  'pricing',
  'downloads'
]);
const supportAnswerActiveEscalationChannelSchema = z.enum([
  'security_email',
  'docs',
  'github_discussions',
  'github_issues',
  'pricing',
  'downloads'
]);

const supportAnswerCitationBaseSchema = z
  .object({
    documentId: z.string(),
    sourceType: indexedChunkSourceTypeSchema,
    title: z.string(),
    headingAnchor: z.string().optional(),
    trustTier: trustTierSchema,
    retrievalScore: z.number(),
    supportCount: z.number().int().positive()
  })
  .strict();

const apiSupportAnswerUrlCitationSchema = supportAnswerCitationBaseSchema.extend({
  url: z.string().url()
});

const apiSupportAnswerRepoCitationSchema = supportAnswerCitationBaseSchema.extend({
  sourcePath: z.string().min(1)
});

export const apiSupportAnswerCitationSchema = z.union([
  apiSupportAnswerUrlCitationSchema,
  apiSupportAnswerRepoCitationSchema
]);

interface ApiSupportAnswerCitationBase {
  documentId: string;
  sourceType: IndexedChunkSourceType;
  title: string;
  headingAnchor?: string;
  trustTier: TrustTier;
  retrievalScore: number;
  supportCount: number;
}

export type ApiSupportAnswerCitation =
  | (ApiSupportAnswerCitationBase & { url: string; sourcePath?: never })
  | (ApiSupportAnswerCitationBase & { sourcePath: string; url?: never });

export const apiSupportAnswerSafetySchema = z
  .object({
    classification: supportAnswerSafetyClassificationSchema,
    requiresFallback: z.boolean(),
    fallbackReason: fallbackReasonSchema.optional()
  })
  .strict();

export interface ApiSupportAnswerSafety {
  classification: 'normal' | 'low_confidence' | 'insufficient_evidence' | 'security_sensitive';
  requiresFallback: boolean;
  fallbackReason?: 'weak_evidence' | 'insufficient_evidence' | 'security_sensitive';
}

const apiSupportAnswerNoEscalationSchema = z
  .object({
    channel: z.literal('none'),
    shouldEscalate: z.literal(false)
  })
  .strict();

const apiSupportAnswerActiveEscalationSchema = z
  .object({
    channel: supportAnswerActiveEscalationChannelSchema,
    shouldEscalate: z.literal(true),
    destination: z.string().min(1),
    label: z.string().min(1),
    message: z.string().min(1)
  })
  .strict();

export const apiSupportAnswerEscalationSchema = z.union([
  apiSupportAnswerNoEscalationSchema,
  apiSupportAnswerActiveEscalationSchema
]);

export type ApiSupportAnswerEscalation =
  | {
      channel: 'none';
      shouldEscalate: false;
    }
  | {
      channel: Exclude<z.infer<typeof supportAnswerEscalationChannelSchema>, 'none'>;
      shouldEscalate: true;
      destination: string;
      label: string;
      message: string;
    };

export const apiSupportAnswerSchema = z
  .object({
    id: z.string(),
    query: z.string(),
    shortAnswer: z.string(),
    content: z.string(),
    steps: z.array(z.string()),
    commands: z.array(z.string()),
    citations: z.array(apiSupportAnswerCitationSchema),
    confidence: z.number().min(0).max(1),
    confidenceLabel: supportAnswerConfidenceLabelSchema,
    generatedAt: z.string().datetime(),
    modelVersion: z.string().optional(),
    policyVersion: z.string(),
    mode: answerGenerationModeSchema,
    safety: apiSupportAnswerSafetySchema,
    escalation: apiSupportAnswerEscalationSchema,
    uncertainty: z.string().optional(),
    fallbackReason: fallbackReasonSchema.optional()
  })
  .strict();

export interface ApiSupportAnswer {
  id: string;
  query: string;
  shortAnswer: string;
  content: string;
  steps: string[];
  commands: string[];
  citations: ApiSupportAnswerCitation[];
  confidence: number;
  confidenceLabel: 'high' | 'medium' | 'low' | 'insufficient';
  generatedAt: string;
  modelVersion?: string;
  policyVersion: string;
  mode: AnswerGenerationMode;
  safety: ApiSupportAnswerSafety;
  escalation: ApiSupportAnswerEscalation;
  uncertainty?: string;
  fallbackReason?: 'weak_evidence' | 'insufficient_evidence' | 'security_sensitive';
}

export const sourcesResponseSchema = z
  .object({
    ok: z.literal(true),
    query: z.string(),
    route: supportQueryRouteSummarySchema,
    evidence: evidencePackResultSchema,
    sources: z.array(evidenceBundleSchema)
  })
  .strict();

export interface SourcesResponse {
  ok: true;
  query: string;
  route: SupportQueryRouteSummary;
  evidence: EvidencePackResult;
  sources: EvidenceBundle[];
}

const chatAnswerResponseSchema = z
  .object({
    ok: z.literal(true),
    result: z.literal('answer'),
    query: z.string(),
    route: supportQueryRouteSummarySchema,
    evidence: evidencePackResultSchema,
    answer: apiSupportAnswerSchema
  })
  .strict();

const chatFallbackResponseSchema = z
  .object({
    ok: z.literal(true),
    result: z.literal('fallback'),
    query: z.string(),
    route: supportQueryRouteSummarySchema,
    evidence: evidencePackResultSchema,
    answer: apiSupportAnswerSchema,
    skippedGeneration: z.literal(true),
    reason: fallbackReasonSchema
  })
  .strict();

export const chatResponseSchema = z.discriminatedUnion('result', [
  chatAnswerResponseSchema,
  chatFallbackResponseSchema
]);

export type ChatResponse =
  | {
      ok: true;
      result: 'answer';
      query: string;
      route: SupportQueryRouteSummary;
      evidence: EvidencePackResult;
      answer: ApiSupportAnswer;
    }
  | {
      ok: true;
      result: 'fallback';
      query: string;
      route: SupportQueryRouteSummary;
      evidence: EvidencePackResult;
      answer: ApiSupportAnswer;
      skippedGeneration: true;
      reason: 'weak_evidence' | 'insufficient_evidence' | 'security_sensitive';
    };

export const answerGenerationDraftSchema = z
  .object({
    shortAnswer: z.string(),
    steps: z.array(z.string()).optional(),
    commands: z.array(z.string()).optional(),
    citedEvidenceIndexes: z.array(z.number().int().positive()).optional(),
    confidence: z.number().min(0).max(1).optional(),
    uncertainty: z.string().optional()
  })
  .strict();

export function toSupportQueryRouteSummary(route: SupportQueryRoutePlan): SupportQueryRouteSummary {
  return supportQueryRouteSummarySchema.parse({
    query: route.query,
    intent: route.intent,
    classification: route.classification,
    search: {
      mode: route.search.mode,
      topK: route.search.topK,
      vectorWeight: route.search.vectorWeight,
      keywordWeight: route.search.keywordWeight,
      filter: route.search.filter
        ? {
            sourceTypes: route.search.filter.sourceTypes,
            trustTiers: route.search.filter.trustTiers
          }
        : undefined,
      ranking: route.search.ranking
        ? {
            trustWeight: route.search.ranking.trustWeight,
            freshnessWeight: route.search.ranking.freshnessWeight,
            freshnessHalfLifeDays: route.search.ranking.freshnessHalfLifeDays,
            volatileFreshnessHalfLifeDays: route.search.ranking.volatileFreshnessHalfLifeDays,
            volatilityIndicators: route.search.ranking.volatilityIndicators
          }
        : undefined
    },
    evidence: route.evidence
  });
}

export function toApiSupportAnswer(answer: SupportAnswer): ApiSupportAnswer {
  return apiSupportAnswerSchema.parse({
    ...answer,
    generatedAt: answer.generatedAt.toISOString()
  });
}

export type ApiSupportAnswerDraft = AnswerGenerationDraft;