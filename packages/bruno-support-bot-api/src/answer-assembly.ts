import type { Answer } from '../../bruno-support-indexer/src/types/answer';
import type { Citation } from '../../bruno-support-indexer/src/types/citation';
import { TrustTier } from '../../bruno-support-indexer/src/types/trust-tier';

import type {
  AnswerGenerationDraft,
  AnswerGenerationMode,
  AnswerGenerationRequest,
  PromptEvidenceItem
} from './answer-generation-adapter';
import { OFFICIAL_BRUNO_DESTINATIONS } from './safety-escalation';

export type SupportAnswerConfidenceLabel = 'high' | 'medium' | 'low' | 'insufficient';

interface SupportAnswerCitationBase {
  documentId: string;
  sourceType: PromptEvidenceItem['sourceType'];
  title: string;
  headingAnchor?: string;
  trustTier: TrustTier;
  retrievalScore: number;
  supportCount: number;
}

export type UrlSupportAnswerCitation = Citation & SupportAnswerCitationBase;

export interface RepoSupportAnswerCitation extends SupportAnswerCitationBase {
  sourcePath: string;
  url?: never;
}

export type SupportAnswerCitation = UrlSupportAnswerCitation | RepoSupportAnswerCitation;

export interface SupportAnswer {
  id: string;
  query: string;
  shortAnswer: string;
  content: string;
  steps: string[];
  commands: string[];
  citations: SupportAnswerCitation[];
  confidence: number;
  confidenceLabel: SupportAnswerConfidenceLabel;
  generatedAt: Date;
  modelVersion?: string;
  policyVersion: string;
  mode: AnswerGenerationMode;
  safety: AnswerGenerationRequest['safety'];
  escalation: AnswerGenerationRequest['escalation'];
  uncertainty?: string;
  fallbackReason?: NonNullable<AnswerGenerationRequest['safety']['fallbackReason']>;
}

export interface AssembleSupportAnswerInput {
  request: AnswerGenerationRequest;
  draft: AnswerGenerationDraft;
  answerId?: string;
  generatedAt?: Date;
  modelVersion?: string;
}

function normalizeText(value: string | undefined): string | undefined {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}

function normalizeList(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

function defaultConfidence(request: AnswerGenerationRequest): number {
  if (request.mode === 'grounded') {
    return 0.86;
  }

  return request.safety.classification === 'low_confidence' ? 0.36 : 0.18;
}

function clampConfidence(value: number, mode: AnswerGenerationMode): number {
  const bounded = Math.max(0, Math.min(1, value));

  return mode === 'fallback' ? Math.min(bounded, 0.49) : bounded;
}

function toConfidenceLabel(confidence: number): SupportAnswerConfidenceLabel {
  if (confidence >= 0.85) {
    return 'high';
  }

  if (confidence >= 0.6) {
    return 'medium';
  }

  if (confidence > 0.25) {
    return 'low';
  }

  return 'insufficient';
}

function buildDefaultShortAnswer(request: AnswerGenerationRequest): string {
  if (request.mode === 'grounded') {
    return 'Based on the supplied Bruno support evidence, this is the most supported answer.';
  }

  if (request.safety.classification === 'security_sensitive') {
    return `This looks like a potential Bruno security issue. Please email ${OFFICIAL_BRUNO_DESTINATIONS.securityEmailAddress} instead of posting it publicly.`;
  }

  return request.safety.classification === 'insufficient_evidence'
    ? 'I do not have enough Bruno support evidence to answer that yet.'
    : 'I do not have enough reliable Bruno support evidence to answer that confidently.';
}

function buildDefaultUncertainty(request: AnswerGenerationRequest): string | undefined {
  if (request.mode === 'grounded') {
    return undefined;
  }

  if (request.fallbackMessage) {
    return request.fallbackMessage;
  }

  if (request.escalation.shouldEscalate) {
    return request.escalation.message;
  }

  return 'The available evidence is too limited or weak to support a confident answer.';
}

function formatContent(shortAnswer: string, uncertainty: string | undefined, steps: string[], commands: string[]): string {
  const sections = [shortAnswer];

  if (uncertainty) {
    sections.push(`Uncertainty: ${uncertainty}`);
  }

  if (steps.length > 0) {
    sections.push(`Steps:\n${steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`);
  }

  if (commands.length > 0) {
    sections.push(`Commands:\n${commands.map((command) => `- ${command}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

function selectEvidence(request: AnswerGenerationRequest, draft: AnswerGenerationDraft): PromptEvidenceItem[] {
  if (request.evidence.length === 0) {
    return [];
  }

  const uniqueRequestedIndexes = Array.from(
    new Set((draft.citedEvidenceIndexes ?? []).filter((value) => Number.isInteger(value) && value > 0))
  );

  if (uniqueRequestedIndexes.length === 0) {
    return request.evidence;
  }

  const evidenceByIndex = new Map(request.evidence.map((item) => [item.index, item]));

  return uniqueRequestedIndexes
    .map((index) => evidenceByIndex.get(index))
    .filter((item): item is PromptEvidenceItem => item !== undefined);
}

function toSharedTrustTier(trustTier: PromptEvidenceItem['trustTier']): TrustTier {
  switch (trustTier) {
    case 'official_docs':
      return TrustTier.OfficialDocs;
    case 'repo':
      return TrustTier.Repo;
    case 'community':
      return TrustTier.Community;
    case 'external':
    default:
      return TrustTier.External;
  }
}

function toSupportCitation(item: PromptEvidenceItem): SupportAnswerCitation {
  const base = {
    documentId: item.documentId,
    sourceType: item.sourceType,
    title: item.title,
    headingAnchor: item.headingAnchor,
    trustTier: toSharedTrustTier(item.trustTier),
    retrievalScore: item.retrievalScore,
    supportCount: item.supportCount
  };

  if (item.url) {
    const citation: UrlSupportAnswerCitation = {
      ...base,
      url: item.url
    };

    return citation;
  }

  const citation: RepoSupportAnswerCitation = {
    ...base,
    sourcePath: item.sourcePath ?? item.documentId
  };

  return citation;
}

export function assembleSupportAnswer(input: AssembleSupportAnswerInput): SupportAnswer {
  const generatedAt = input.generatedAt ?? new Date();
  const shortAnswer = normalizeText(input.draft.shortAnswer) ?? buildDefaultShortAnswer(input.request);
  const steps = normalizeList(input.draft.steps);
  const commands = normalizeList(input.draft.commands);
  const uncertainty = normalizeText(input.draft.uncertainty) ?? buildDefaultUncertainty(input.request);
  const confidence = clampConfidence(input.draft.confidence ?? defaultConfidence(input.request), input.request.mode);
  const citations = selectEvidence(input.request, input.draft).map(toSupportCitation);

  return {
    id: input.answerId ?? `support-answer-${generatedAt.toISOString()}`,
    query: input.request.query,
    shortAnswer,
    content: formatContent(shortAnswer, uncertainty, steps, commands),
    steps,
    commands,
    citations,
    confidence,
    confidenceLabel: toConfidenceLabel(confidence),
    generatedAt,
    modelVersion: input.modelVersion,
    policyVersion: input.request.policyVersion,
    mode: input.request.mode,
    safety: input.request.safety,
    escalation: input.request.escalation,
    uncertainty,
    fallbackReason: input.request.mode === 'fallback' ? input.request.safety.fallbackReason : undefined
  };
}

export function toSharedCitation(citation: SupportAnswerCitation): Citation | null {
  if (!('url' in citation) || typeof citation.url !== 'string') {
    return null;
  }

  return {
    sourceType: citation.sourceType,
    url: citation.url,
    title: citation.title,
    headingAnchor: citation.headingAnchor,
    trustTier: citation.trustTier,
    retrievalScore: citation.retrievalScore
  };
}

export function toSharedAnswer(answer: SupportAnswer): Answer {
  const citations = answer.citations
    .map((citation) => toSharedCitation(citation))
    .filter((citation): citation is Citation => citation !== null);

  return {
    id: answer.id,
    query: answer.query,
    content: answer.content,
    citations,
    confidence: answer.confidence,
    generatedAt: answer.generatedAt,
    modelVersion: answer.modelVersion
  };
}