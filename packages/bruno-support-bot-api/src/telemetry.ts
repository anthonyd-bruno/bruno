import type {
  EvidenceBundle,
  EvidencePackResult,
  IndexedChunkSourceType,
  IndexedChunkTrustTier,
  SupportQueryRoutePlan
} from '../../bruno-support-retrieval/src/index/types';

import type { AnswerGenerationRequest } from './answer-generation-adapter';
import type { SupportAnswer, SupportAnswerConfidenceLabel } from './answer-assembly';
import type { GroundedEvidenceAssessment } from './grounded-prompt-policy';

export type SupportBotTelemetryEndpoint = 'chat' | 'sources';
export type SupportBotTelemetryFailureStage =
  | 'request_validation'
  | 'retrieval'
  | 'generation'
  | 'response_validation'
  | 'unknown';
export type SupportBotTelemetryOutcome = 'answer' | 'fallback' | 'sources';
export type SupportBotCitationSignal = 'sufficient' | 'low_citation' | 'citation_miss' | 'not_applicable';
export type SupportBotRedactionKind = 'email' | 'url' | 'path' | 'token';

export interface SupportBotTelemetryTextSummary {
  charCount: number;
  wordCount: number;
  redactionApplied: boolean;
  redactionCount: number;
  redactionKinds: SupportBotRedactionKind[];
}

export interface SupportBotRedactionResult {
  text: string;
  redactionCount: number;
  redactionKinds: SupportBotRedactionKind[];
  truncated: boolean;
}

export interface SupportBotTelemetryRouteSummary {
  intent: SupportQueryRoutePlan['intent'];
  classificationScore: number;
  classificationFallback: boolean;
  matchedSignalCount: number;
}

export interface SupportBotTelemetryEvidenceSummary {
  status: EvidencePackResult['status'];
  totalHits: number;
  packedEvidenceCount: number;
  minEvidence: number;
  sourceCount: number;
  sourceTypeCounts: Partial<Record<IndexedChunkSourceType, number>>;
  trustTierCounts: Partial<Record<IndexedChunkTrustTier, number>>;
}

export interface SupportBotTelemetryAssessmentSummary {
  strength: GroundedEvidenceAssessment['strength'];
  reason: GroundedEvidenceAssessment['reason'];
  evidenceCount: number;
  qualifyingEvidenceCount: number;
  strongestEvidenceScore?: number;
}

export interface SupportBotTelemetryErrorSummary {
  name: string;
  message: string;
  redactionApplied: boolean;
  redactionCount: number;
  redactionKinds: SupportBotRedactionKind[];
}

interface SupportBotTelemetryBaseEvent {
  type: string;
  schemaVersion: 1;
  timestamp: string;
  service: string;
  requestId: string;
  endpoint: SupportBotTelemetryEndpoint;
  method: string;
}

export interface SupportBotRequestStartedEvent extends SupportBotTelemetryBaseEvent {
  type: 'support_bot.request.started';
}

export interface SupportBotRetrievalCompletedEvent extends SupportBotTelemetryBaseEvent {
  type: 'support_bot.retrieval.completed';
  query: SupportBotTelemetryTextSummary;
  route: SupportBotTelemetryRouteSummary;
  retrieval: SupportBotTelemetryEvidenceSummary & {
    durationMs: number;
  };
}

export interface SupportBotGenerationCompletedEvent extends SupportBotTelemetryBaseEvent {
  type: 'support_bot.generation.completed';
  query: SupportBotTelemetryTextSummary;
  route: SupportBotTelemetryRouteSummary;
  generation: {
    durationMs: number;
    mode: AnswerGenerationRequest['mode'];
    assessment: SupportBotTelemetryAssessmentSummary;
    citationCount: number;
    citationSignal: SupportBotCitationSignal;
    confidence: number;
    confidenceLabel: SupportAnswerConfidenceLabel;
  };
}

export interface SupportBotRequestCompletedEvent extends SupportBotTelemetryBaseEvent {
  type: 'support_bot.request.completed';
  query?: SupportBotTelemetryTextSummary;
  route?: SupportBotTelemetryRouteSummary;
  completion: {
    durationMs: number;
    statusCode: number;
    outcome: SupportBotTelemetryOutcome;
    unanswered: boolean;
    fallbackReason?: NonNullable<SupportAnswer['fallbackReason']>;
    citationSignal: SupportBotCitationSignal;
  };
}

export interface SupportBotRequestFailedEvent extends SupportBotTelemetryBaseEvent {
  type: 'support_bot.request.failed';
  query?: SupportBotTelemetryTextSummary;
  route?: SupportBotTelemetryRouteSummary;
  failure: {
    durationMs: number;
    statusCode: number;
    stage: SupportBotTelemetryFailureStage;
    error: SupportBotTelemetryErrorSummary;
  };
}

export type SupportBotTelemetryEvent =
  | SupportBotRequestStartedEvent
  | SupportBotRetrievalCompletedEvent
  | SupportBotGenerationCompletedEvent
  | SupportBotRequestCompletedEvent
  | SupportBotRequestFailedEvent;

export interface SupportBotTelemetrySink {
  emit(event: SupportBotTelemetryEvent): void | Promise<void>;
}

const EMAIL_REGEX = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_REGEX = /\b(?:https?:\/\/|mailto:)[^\s<>()]+/gi;
const WINDOWS_PATH_REGEX = /\b[A-Za-z]:\\[^\s<>"']+/g;
const UNIX_PATH_REGEX = /(^|[\s(])((?:\.{1,2}\/|\/)[^\s)<>"']+)/g;
const TOKEN_REGEX = /\b[a-zA-Z0-9._-]{20,}\b/g;

function replaceMatches(
  value: string,
  pattern: RegExp,
  kind: SupportBotRedactionKind,
  replacement: string | ((substring: string, ...args: string[]) => string),
  state: { count: number; kinds: Set<SupportBotRedactionKind> }
): string {
  return value.replace(pattern, (...args) => {
    state.count += 1;
    state.kinds.add(kind);
    return typeof replacement === 'function' ? replacement(args[0], ...(args.slice(1, -2) as string[])) : replacement;
  });
}

export function redactSupportBotText(value: string, maxLength = 160): SupportBotRedactionResult {
  const normalized = value.trim();
  const state = { count: 0, kinds: new Set<SupportBotRedactionKind>() };

  let text = replaceMatches(normalized, EMAIL_REGEX, 'email', '[redacted:email]', state);
  text = replaceMatches(text, URL_REGEX, 'url', '[redacted:url]', state);
  text = replaceMatches(text, WINDOWS_PATH_REGEX, 'path', '[redacted:path]', state);
  text = replaceMatches(text, UNIX_PATH_REGEX, 'path', (_substring, prefix) => `${prefix}[redacted:path]`, state);
  text = replaceMatches(text, TOKEN_REGEX, 'token', '[redacted:token]', state);

  const truncated = text.length > maxLength;

  return {
    text: truncated ? `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…` : text,
    redactionCount: state.count,
    redactionKinds: Array.from(state.kinds.values()).sort(),
    truncated
  };
}

export function summarizeSupportBotText(value: string): SupportBotTelemetryTextSummary {
  const normalized = value.trim();
  const redacted = redactSupportBotText(normalized);

  return {
    charCount: normalized.length,
    wordCount: normalized.length === 0 ? 0 : normalized.split(/\s+/).length,
    redactionApplied: redacted.redactionCount > 0,
    redactionCount: redacted.redactionCount,
    redactionKinds: redacted.redactionKinds
  };
}

export function summarizeSupportBotRoute(route: SupportQueryRoutePlan): SupportBotTelemetryRouteSummary {
  return {
    intent: route.intent,
    classificationScore: route.classification.score,
    classificationFallback: route.classification.isFallback,
    matchedSignalCount: route.classification.matchedSignals.length
  };
}

function incrementCount<T extends string>(counts: Partial<Record<T, number>>, key: T): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

export function summarizeSupportBotEvidence(
  result: EvidencePackResult,
  sources: readonly EvidenceBundle[]
): SupportBotTelemetryEvidenceSummary {
  const sourceTypeCounts: Partial<Record<IndexedChunkSourceType, number>> = {};
  const trustTierCounts: Partial<Record<IndexedChunkTrustTier, number>> = {};

  sources.forEach((source) => {
    incrementCount(sourceTypeCounts, source.sourceType);
    incrementCount(trustTierCounts, source.trustTier);
  });

  return {
    status: result.status,
    totalHits: result.totalHits,
    packedEvidenceCount: result.packedEvidenceCount,
    minEvidence: result.minEvidence,
    sourceCount: sources.length,
    sourceTypeCounts,
    trustTierCounts
  };
}

export function summarizeSupportBotAssessment(
  assessment: GroundedEvidenceAssessment
): SupportBotTelemetryAssessmentSummary {
  return {
    strength: assessment.strength,
    reason: assessment.reason,
    evidenceCount: assessment.evidenceCount,
    qualifyingEvidenceCount: assessment.qualifyingEvidenceCount,
    strongestEvidenceScore: assessment.strongestEvidenceScore
  };
}

export function summarizeSupportBotError(error: unknown): SupportBotTelemetryErrorSummary {
  const name = error instanceof Error && error.name.trim().length > 0 ? error.name : 'Error';
  const message = error instanceof Error ? error.message : 'Unexpected internal error.';
  const redacted = redactSupportBotText(message);

  return {
    name,
    message: redacted.text,
    redactionApplied: redacted.redactionCount > 0,
    redactionCount: redacted.redactionCount,
    redactionKinds: redacted.redactionKinds
  };
}

export function determineSupportBotCitationSignal(
  request: Pick<AnswerGenerationRequest, 'mode' | 'evidence'>,
  answer: Pick<SupportAnswer, 'citations'>
): SupportBotCitationSignal {
  if (request.mode !== 'grounded' || request.evidence.length === 0) {
    return 'not_applicable';
  }

  if (answer.citations.length === 0) {
    return 'citation_miss';
  }

  if (request.evidence.length > 1 && answer.citations.length < Math.min(2, request.evidence.length)) {
    return 'low_citation';
  }

  return 'sufficient';
}

export async function emitSupportBotTelemetry(
  sink: SupportBotTelemetrySink | undefined,
  event: SupportBotTelemetryEvent
): Promise<void> {
  if (!sink) {
    return;
  }

  try {
    await sink.emit(event);
  } catch {
    // Telemetry must never break request handling.
  }
}