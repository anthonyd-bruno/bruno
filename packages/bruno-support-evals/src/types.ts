export const supportEvalCategories = [
  'install',
  'cli',
  'scripting',
  'auth',
  'pricing',
  'troubleshooting',
  'version_release',
  'fallback',
  'escalation'
] as const;

export const supportEvalDifficulties = ['easy', 'medium', 'hard'] as const;
export const supportEvalSourceTypes = ['repo', 'docs_site', 'website', 'github', 'stackoverflow'] as const;
export const supportEvalTrustTiers = ['official_docs', 'repo', 'community', 'external'] as const;
export const supportEvalCitationImportances = ['required', 'recommended'] as const;
export const supportEvalFallbackPolicies = ['never', 'allowed', 'required'] as const;
export const supportEvalEscalationChannels = [
  'security_email',
  'docs',
  'github_discussions',
  'github_issues',
  'pricing',
  'downloads'
] as const;
export const supportEvalDeliveryStages = ['wave1_seed'] as const;
export const supportEvalMetricNames = ['groundedness', 'citationPrecision', 'correctness', 'fallbackQuality'] as const;
export const supportEvalCaseRunStatuses = ['completed', 'failed'] as const;
export const supportEvalGateStatuses = ['passed', 'failed'] as const;
export const supportEvalGateFailureCodes = ['failed_case_count', 'metric_threshold'] as const;
export const supportBotFeedbackSignalSources = ['telemetry', 'eval'] as const;
export const supportBotFeedbackSignalTypes = [
  'unanswered',
  'request_failure',
  'citation_gap',
  'eval_failure',
  'quality_gap'
] as const;
export const supportBotFeedbackSeverities = ['low', 'medium', 'high', 'critical'] as const;
export const supportBotFeedbackGapTypes = [
  'content_gap',
  'citation_gap',
  'routing_gap',
  'retrieval_gap',
  'generation_gap',
  'validation_gap',
  'quality_gap'
] as const;
export const supportBotFeedbackTelemetryFailureStages = [
  'request_validation',
  'retrieval',
  'generation',
  'response_validation',
  'unknown',
  'eval_execution'
] as const;
export const supportBotFeedbackCitationSignals = ['sufficient', 'low_citation', 'citation_miss', 'not_applicable'] as const;
export const supportBotFeedbackOutcomes = ['answer', 'fallback', 'sources'] as const;

export type SupportEvalCategory = (typeof supportEvalCategories)[number];
export type SupportEvalDifficulty = (typeof supportEvalDifficulties)[number];
export type SupportEvalSourceType = (typeof supportEvalSourceTypes)[number];
export type SupportEvalTrustTier = (typeof supportEvalTrustTiers)[number];
export type SupportEvalCitationImportance = (typeof supportEvalCitationImportances)[number];
export type SupportEvalFallbackPolicy = (typeof supportEvalFallbackPolicies)[number];
export type SupportEvalEscalationChannel = (typeof supportEvalEscalationChannels)[number];
export type SupportEvalDeliveryStage = (typeof supportEvalDeliveryStages)[number];
export type SupportEvalMetricName = (typeof supportEvalMetricNames)[number];
export type SupportEvalCaseRunStatus = (typeof supportEvalCaseRunStatuses)[number];
export type SupportEvalGateStatus = (typeof supportEvalGateStatuses)[number];
export type SupportEvalGateFailureCode = (typeof supportEvalGateFailureCodes)[number];
export type SupportBotFeedbackSignalSource = (typeof supportBotFeedbackSignalSources)[number];
export type SupportBotFeedbackSignalType = (typeof supportBotFeedbackSignalTypes)[number];
export type SupportBotFeedbackSeverity = (typeof supportBotFeedbackSeverities)[number];
export type SupportBotFeedbackGapType = (typeof supportBotFeedbackGapTypes)[number];
export type SupportBotFeedbackTelemetryFailureStage = (typeof supportBotFeedbackTelemetryFailureStages)[number];
export type SupportBotFeedbackCitationSignal = (typeof supportBotFeedbackCitationSignals)[number];
export type SupportBotFeedbackOutcome = (typeof supportBotFeedbackOutcomes)[number];

export interface SupportEvalCitationTarget {
  url: string;
  title: string;
  sourceType: SupportEvalSourceType;
  trustTier: SupportEvalTrustTier;
  importance: SupportEvalCitationImportance;
  rationale: string;
}

export interface SupportEvalAnswerRubric {
  requiredFacts: string[];
  preferredFacts?: string[];
  prohibitedClaims?: string[];
  minimumCitationCount: number;
  fallbackPolicy: SupportEvalFallbackPolicy;
  requiredEscalationChannel?: SupportEvalEscalationChannel;
  allowedEscalationChannels?: SupportEvalEscalationChannel[];
  gradingNotes?: string;
}

export interface SupportEvalCase {
  id: string;
  category: SupportEvalCategory;
  query: string;
  difficulty: SupportEvalDifficulty;
  expectedAnswer: string;
  expectedCitationTargets: SupportEvalCitationTarget[];
  answerRubric: SupportEvalAnswerRubric;
  tags: string[];
}

export interface SupportEvalDatasetStagedDelivery {
  stage: SupportEvalDeliveryStage;
  shippedCaseCount: number;
  targetCaseCount: number;
  notes: string;
}

export interface SupportEvalDatasetMetadata {
  datasetId: string;
  schemaVersion: 1;
  datasetVersion: string;
  createdAt: string;
  description: string;
  declaredCategoryCoverage: SupportEvalCategory[];
  stagedDelivery: SupportEvalDatasetStagedDelivery;
}

export interface SupportEvalDataset {
  metadata: SupportEvalDatasetMetadata;
  cases: SupportEvalCase[];
}

export interface SupportEvalMetricScores {
  groundedness: number;
  citationPrecision: number;
  correctness: number;
  fallbackQuality: number;
}

export interface SupportEvalExecutorCitation {
  url: string;
  title?: string;
}

export interface SupportEvalExecutorResult {
  answer: string;
  citations: SupportEvalExecutorCitation[];
  metrics: SupportEvalMetricScores;
  fallbackApplied?: boolean;
  escalationChannels?: SupportEvalEscalationChannel[];
  notes?: string[];
}

export interface SupportEvalExecutor {
  execute(evalCase: SupportEvalCase): Promise<SupportEvalExecutorResult> | SupportEvalExecutorResult;
}

export interface SupportEvalCaseRunError {
  message: string;
}

export interface SupportEvalCaseRunResult {
  caseId: string;
  category: SupportEvalCategory;
  status: SupportEvalCaseRunStatus;
  answer: string;
  citations: SupportEvalExecutorCitation[];
  metrics: SupportEvalMetricScores;
  matchedCitationUrls: string[];
  missingCitationUrls: string[];
  fallbackApplied: boolean;
  escalationChannels: SupportEvalEscalationChannel[];
  notes: string[];
  error?: SupportEvalCaseRunError;
}

export interface SupportEvalRunMetricSummary {
  average: number;
  total: number;
  count: number;
}

export interface SupportEvalRunAggregates {
  caseCount: number;
  completedCaseCount: number;
  failedCaseCount: number;
  groundedness: SupportEvalRunMetricSummary;
  citationPrecision: SupportEvalRunMetricSummary;
  correctness: SupportEvalRunMetricSummary;
  fallbackQuality: SupportEvalRunMetricSummary;
}

export interface SupportEvalRunOutput {
  datasetId: string;
  datasetVersion: string;
  startedAt: string;
  completedAt: string;
  aggregates: SupportEvalRunAggregates;
  results: SupportEvalCaseRunResult[];
}

export type SupportEvalGateMetricThresholds = Record<SupportEvalMetricName, number>;

export interface SupportEvalGateThresholds {
  maxFailedCaseCount: number;
  minimumAverageMetrics: SupportEvalGateMetricThresholds;
}

export interface SupportEvalGateThresholdOverrides {
  maxFailedCaseCount?: number;
  minimumAverageMetrics?: Partial<SupportEvalGateMetricThresholds>;
}

export interface SupportEvalGateFailure {
  code: SupportEvalGateFailureCode;
  message: string;
  actual: number;
  expected: number;
  metricName?: SupportEvalMetricName;
}

export interface SupportEvalGateResult {
  status: SupportEvalGateStatus;
  datasetId: string;
  datasetVersion: string;
  aggregates: SupportEvalRunAggregates;
  thresholds: SupportEvalGateThresholds;
  failures: SupportEvalGateFailure[];
}

export interface RunSupportEvalDatasetOptions {
  executor: SupportEvalExecutor;
  dataset?: SupportEvalDataset;
  now?: () => Date;
}

export interface SupportBotFeedbackTelemetryRouteSummary {
  intent: string;
  classificationScore: number;
  classificationFallback: boolean;
  matchedSignalCount: number;
}

export interface SupportBotFeedbackTelemetryCompletedEvent {
  type: 'support_bot.request.completed';
  timestamp: string;
  requestId: string;
  route?: SupportBotFeedbackTelemetryRouteSummary;
  completion: {
    statusCode: number;
    durationMs: number;
    outcome: SupportBotFeedbackOutcome;
    unanswered: boolean;
    fallbackReason?: string;
    citationSignal: SupportBotFeedbackCitationSignal;
  };
}

export interface SupportBotFeedbackTelemetryFailedEvent {
  type: 'support_bot.request.failed';
  timestamp: string;
  requestId: string;
  route?: SupportBotFeedbackTelemetryRouteSummary;
  failure: {
    statusCode: number;
    durationMs: number;
    stage: Exclude<SupportBotFeedbackTelemetryFailureStage, 'eval_execution'>;
    error: {
      name: string;
      message: string;
    };
  };
}

export interface SupportBotFeedbackTelemetryIgnoredEvent {
  type: string;
  timestamp?: string;
  requestId?: string;
  route?: SupportBotFeedbackTelemetryRouteSummary;
}

export type SupportBotFeedbackTelemetryEvent =
  | SupportBotFeedbackTelemetryCompletedEvent
  | SupportBotFeedbackTelemetryFailedEvent
  | SupportBotFeedbackTelemetryIgnoredEvent;

export interface SupportBotFeedbackSourceGap {
  gapType: SupportBotFeedbackGapType;
  groupKey: string;
  label: string;
  routeIntent?: string;
  category?: SupportEvalCategory;
  failureStage?: SupportBotFeedbackTelemetryFailureStage;
  citationSignal?: Extract<SupportBotFeedbackCitationSignal, 'low_citation' | 'citation_miss'>;
  sourceTypes: SupportEvalSourceType[];
  trustTiers: SupportEvalTrustTier[];
  sourceGroups: string[];
}

export interface SupportBotFeedbackSignal {
  source: SupportBotFeedbackSignalSource;
  fingerprint: string;
  signalType: SupportBotFeedbackSignalType;
  severity: SupportBotFeedbackSeverity;
  occurredAt: string;
  summary: string;
  routeIntent?: string;
  category?: SupportEvalCategory;
  requestId?: string;
  caseId?: string;
  datasetId?: string;
  outcome?: SupportBotFeedbackOutcome;
  failureStage?: SupportBotFeedbackTelemetryFailureStage;
  citationSignal?: Extract<SupportBotFeedbackCitationSignal, 'low_citation' | 'citation_miss'>;
  sourceGap: SupportBotFeedbackSourceGap;
  metadata?: Record<string, unknown>;
}

export interface SupportBotFeedbackTriageItem {
  groupKey: string;
  title: string;
  priority: SupportBotFeedbackSeverity;
  priorityScore: number;
  signalCount: number;
  sourceCounts: Record<SupportBotFeedbackSignalSource, number>;
  signalTypes: SupportBotFeedbackSignalType[];
  routeIntents: string[];
  categories: SupportEvalCategory[];
  sourceGap: SupportBotFeedbackSourceGap;
  signalFingerprints: string[];
  summaries: string[];
  recommendedActions: string[];
}

export interface SupportBotFeedbackReport {
  version: 1;
  generatedAt: string;
  inputs: {
    telemetryEventCount: number;
    evalRunCount: number;
    evalResultCount: number;
  };
  totals: {
    signalCount: number;
    triageItemCount: number;
    telemetrySignalCount: number;
    evalSignalCount: number;
    highPriorityCount: number;
    criticalPriorityCount: number;
  };
  signals: SupportBotFeedbackSignal[];
  triageItems: SupportBotFeedbackTriageItem[];
}

export interface BuildSupportBotFeedbackReportOptions {
  telemetryEvents?: SupportBotFeedbackTelemetryEvent[];
  evalRuns?: SupportEvalRunOutput[];
  now?: () => Date;
}