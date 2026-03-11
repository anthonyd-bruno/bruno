declare const supportEvalCategories: readonly ["install", "cli", "scripting", "auth", "pricing", "troubleshooting", "version_release", "fallback", "escalation"];
declare const supportEvalDifficulties: readonly ["easy", "medium", "hard"];
declare const supportEvalSourceTypes: readonly ["repo", "docs_site", "website", "github", "stackoverflow"];
declare const supportEvalTrustTiers: readonly ["official_docs", "repo", "community", "external"];
declare const supportEvalCitationImportances: readonly ["required", "recommended"];
declare const supportEvalFallbackPolicies: readonly ["never", "allowed", "required"];
declare const supportEvalEscalationChannels: readonly ["security_email", "docs", "github_discussions", "github_issues", "pricing", "downloads"];
declare const supportEvalDeliveryStages: readonly ["wave1_seed"];
declare const supportEvalMetricNames: readonly ["groundedness", "citationPrecision", "correctness", "fallbackQuality"];
declare const supportEvalCaseRunStatuses: readonly ["completed", "failed"];
declare const supportEvalGateStatuses: readonly ["passed", "failed"];
declare const supportEvalGateFailureCodes: readonly ["failed_case_count", "metric_threshold"];
declare const supportBotFeedbackSignalSources: readonly ["telemetry", "eval"];
declare const supportBotFeedbackSignalTypes: readonly ["unanswered", "request_failure", "citation_gap", "eval_failure", "quality_gap"];
declare const supportBotFeedbackSeverities: readonly ["low", "medium", "high", "critical"];
declare const supportBotFeedbackGapTypes: readonly ["content_gap", "citation_gap", "routing_gap", "retrieval_gap", "generation_gap", "validation_gap", "quality_gap"];
declare const supportBotFeedbackTelemetryFailureStages: readonly ["request_validation", "retrieval", "generation", "response_validation", "unknown", "eval_execution"];
declare const supportBotFeedbackCitationSignals: readonly ["sufficient", "low_citation", "citation_miss", "not_applicable"];
declare const supportBotFeedbackOutcomes: readonly ["answer", "fallback", "sources"];
type SupportEvalCategory = (typeof supportEvalCategories)[number];
type SupportEvalDifficulty = (typeof supportEvalDifficulties)[number];
type SupportEvalSourceType = (typeof supportEvalSourceTypes)[number];
type SupportEvalTrustTier = (typeof supportEvalTrustTiers)[number];
type SupportEvalCitationImportance = (typeof supportEvalCitationImportances)[number];
type SupportEvalFallbackPolicy = (typeof supportEvalFallbackPolicies)[number];
type SupportEvalEscalationChannel = (typeof supportEvalEscalationChannels)[number];
type SupportEvalDeliveryStage = (typeof supportEvalDeliveryStages)[number];
type SupportEvalMetricName = (typeof supportEvalMetricNames)[number];
type SupportEvalCaseRunStatus = (typeof supportEvalCaseRunStatuses)[number];
type SupportEvalGateStatus = (typeof supportEvalGateStatuses)[number];
type SupportEvalGateFailureCode = (typeof supportEvalGateFailureCodes)[number];
type SupportBotFeedbackSignalSource = (typeof supportBotFeedbackSignalSources)[number];
type SupportBotFeedbackSignalType = (typeof supportBotFeedbackSignalTypes)[number];
type SupportBotFeedbackSeverity = (typeof supportBotFeedbackSeverities)[number];
type SupportBotFeedbackGapType = (typeof supportBotFeedbackGapTypes)[number];
type SupportBotFeedbackTelemetryFailureStage = (typeof supportBotFeedbackTelemetryFailureStages)[number];
type SupportBotFeedbackCitationSignal = (typeof supportBotFeedbackCitationSignals)[number];
type SupportBotFeedbackOutcome = (typeof supportBotFeedbackOutcomes)[number];
interface SupportEvalCitationTarget {
    url: string;
    title: string;
    sourceType: SupportEvalSourceType;
    trustTier: SupportEvalTrustTier;
    importance: SupportEvalCitationImportance;
    rationale: string;
}
interface SupportEvalAnswerRubric {
    requiredFacts: string[];
    preferredFacts?: string[];
    prohibitedClaims?: string[];
    minimumCitationCount: number;
    fallbackPolicy: SupportEvalFallbackPolicy;
    requiredEscalationChannel?: SupportEvalEscalationChannel;
    allowedEscalationChannels?: SupportEvalEscalationChannel[];
    gradingNotes?: string;
}
interface SupportEvalCase {
    id: string;
    category: SupportEvalCategory;
    query: string;
    difficulty: SupportEvalDifficulty;
    expectedAnswer: string;
    expectedCitationTargets: SupportEvalCitationTarget[];
    answerRubric: SupportEvalAnswerRubric;
    tags: string[];
}
interface SupportEvalDatasetStagedDelivery {
    stage: SupportEvalDeliveryStage;
    shippedCaseCount: number;
    targetCaseCount: number;
    notes: string;
}
interface SupportEvalDatasetMetadata {
    datasetId: string;
    schemaVersion: 1;
    datasetVersion: string;
    createdAt: string;
    description: string;
    declaredCategoryCoverage: SupportEvalCategory[];
    stagedDelivery: SupportEvalDatasetStagedDelivery;
}
interface SupportEvalDataset {
    metadata: SupportEvalDatasetMetadata;
    cases: SupportEvalCase[];
}
interface SupportEvalMetricScores {
    groundedness: number;
    citationPrecision: number;
    correctness: number;
    fallbackQuality: number;
}
interface SupportEvalExecutorCitation {
    url: string;
    title?: string;
}
interface SupportEvalExecutorResult {
    answer: string;
    citations: SupportEvalExecutorCitation[];
    metrics: SupportEvalMetricScores;
    fallbackApplied?: boolean;
    escalationChannels?: SupportEvalEscalationChannel[];
    notes?: string[];
}
interface SupportEvalExecutor {
    execute(evalCase: SupportEvalCase): Promise<SupportEvalExecutorResult> | SupportEvalExecutorResult;
}
interface SupportEvalCaseRunError {
    message: string;
}
interface SupportEvalCaseRunResult {
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
interface SupportEvalRunMetricSummary {
    average: number;
    total: number;
    count: number;
}
interface SupportEvalRunAggregates {
    caseCount: number;
    completedCaseCount: number;
    failedCaseCount: number;
    groundedness: SupportEvalRunMetricSummary;
    citationPrecision: SupportEvalRunMetricSummary;
    correctness: SupportEvalRunMetricSummary;
    fallbackQuality: SupportEvalRunMetricSummary;
}
interface SupportEvalRunOutput {
    datasetId: string;
    datasetVersion: string;
    startedAt: string;
    completedAt: string;
    aggregates: SupportEvalRunAggregates;
    results: SupportEvalCaseRunResult[];
}
type SupportEvalGateMetricThresholds = Record<SupportEvalMetricName, number>;
interface SupportEvalGateThresholds {
    maxFailedCaseCount: number;
    minimumAverageMetrics: SupportEvalGateMetricThresholds;
}
interface SupportEvalGateThresholdOverrides {
    maxFailedCaseCount?: number;
    minimumAverageMetrics?: Partial<SupportEvalGateMetricThresholds>;
}
interface SupportEvalGateFailure {
    code: SupportEvalGateFailureCode;
    message: string;
    actual: number;
    expected: number;
    metricName?: SupportEvalMetricName;
}
interface SupportEvalGateResult {
    status: SupportEvalGateStatus;
    datasetId: string;
    datasetVersion: string;
    aggregates: SupportEvalRunAggregates;
    thresholds: SupportEvalGateThresholds;
    failures: SupportEvalGateFailure[];
}
interface RunSupportEvalDatasetOptions {
    executor: SupportEvalExecutor;
    dataset?: SupportEvalDataset;
    now?: () => Date;
}
interface SupportBotFeedbackTelemetryRouteSummary {
    intent: string;
    classificationScore: number;
    classificationFallback: boolean;
    matchedSignalCount: number;
}
interface SupportBotFeedbackTelemetryCompletedEvent {
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
interface SupportBotFeedbackTelemetryFailedEvent {
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
interface SupportBotFeedbackTelemetryIgnoredEvent {
    type: string;
    timestamp?: string;
    requestId?: string;
    route?: SupportBotFeedbackTelemetryRouteSummary;
}
type SupportBotFeedbackTelemetryEvent = SupportBotFeedbackTelemetryCompletedEvent | SupportBotFeedbackTelemetryFailedEvent | SupportBotFeedbackTelemetryIgnoredEvent;
interface SupportBotFeedbackSourceGap {
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
interface SupportBotFeedbackSignal {
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
interface SupportBotFeedbackTriageItem {
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
interface SupportBotFeedbackReport {
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
interface BuildSupportBotFeedbackReportOptions {
    telemetryEvents?: SupportBotFeedbackTelemetryEvent[];
    evalRuns?: SupportEvalRunOutput[];
    now?: () => Date;
}

declare class DatasetValidationError extends Error {
    readonly issues: string[];
    constructor(issues: string[]);
}
declare function validateSupportEvalCase(value: unknown): SupportEvalCase;
declare function validateSupportEvalDataset(value: unknown): SupportEvalDataset;

declare function loadBrunoSupportEvalDataset(): SupportEvalDataset;
declare function listBrunoSupportEvalCases(): SupportEvalCase[];
declare function listBrunoSupportEvalCasesByCategory(category: SupportEvalCategory): SupportEvalCase[];
declare function getBrunoSupportEvalCase(caseId: string): SupportEvalCase | undefined;

declare const ZERO_SUPPORT_EVAL_METRICS: SupportEvalMetricScores;
declare function clampSupportEvalMetricScore(score: number): number;
declare function normalizeSupportEvalMetricScores(scores: SupportEvalMetricScores): SupportEvalMetricScores;
declare function calculateSupportEvalRunAggregates(results: SupportEvalCaseRunResult[]): SupportEvalRunAggregates;

declare function runSupportEvalCase(evalCase: SupportEvalCase, executor: SupportEvalExecutor): Promise<SupportEvalCaseRunResult>;
declare function runSupportEvalDataset(options: RunSupportEvalDatasetOptions): Promise<SupportEvalRunOutput>;

declare function renderSupportEvalRunMarkdown(run: SupportEvalRunOutput): string;
declare function renderSupportBotFeedbackMarkdown(report: SupportBotFeedbackReport): string;

declare class SupportEvalGateConfigError extends Error {
    constructor(message: string);
}
/**
 * Launch-readiness thresholds for Bruno support evals.
 *
 * Safe tuning path: update only the numbers here, or pass JSON/file overrides into the CI gate.
 * Keep the gate logic stable unless the `SupportEvalRunOutput` contract itself changes.
 */
declare const DEFAULT_SUPPORT_EVAL_GATE_THRESHOLDS: SupportEvalGateThresholds;
declare function parseSupportEvalGateThresholdOverrides(input: unknown): SupportEvalGateThresholdOverrides;
declare function createSupportEvalGateThresholds(overrides?: SupportEvalGateThresholdOverrides): SupportEvalGateThresholds;

declare function evaluateSupportEvalGate(run: SupportEvalRunOutput, thresholdOverrides?: SupportEvalGateThresholdOverrides): SupportEvalGateResult;
declare function renderSupportEvalGateMarkdown(result: SupportEvalGateResult): string;

declare function normalizeSupportBotTelemetryFeedbackSignals(events?: readonly SupportBotFeedbackTelemetryEvent[]): SupportBotFeedbackSignal[];
declare function normalizeSupportEvalFeedbackSignals(runs?: readonly SupportEvalRunOutput[]): SupportBotFeedbackSignal[];
declare function dedupeSupportBotFeedbackSignals(signals: readonly SupportBotFeedbackSignal[]): SupportBotFeedbackSignal[];
declare function aggregateSupportBotFeedbackSignals(signals: readonly SupportBotFeedbackSignal[]): SupportBotFeedbackTriageItem[];
declare function buildSupportBotFeedbackReport(options?: BuildSupportBotFeedbackReportOptions): SupportBotFeedbackReport;
declare const SUPPORT_BOT_FEEDBACK_CONSTANTS: {
    signalTypes: readonly ["unanswered", "request_failure", "citation_gap", "eval_failure", "quality_gap"];
    severities: readonly ["low", "medium", "high", "critical"];
    gapTypes: readonly ["content_gap", "citation_gap", "routing_gap", "retrieval_gap", "generation_gap", "validation_gap", "quality_gap"];
    citationSignals: readonly ["sufficient", "low_citation", "citation_miss", "not_applicable"];
};

declare const BRUNO_SUPPORT_EVAL_DATASET_VERSION = "1.0.0-seed.1";
declare const BRUNO_SUPPORT_EVAL_DATASET_V1: SupportEvalDataset;

declare const supportEvals: {
    BRUNO_SUPPORT_EVAL_DATASET_VERSION: string;
    BRUNO_SUPPORT_EVAL_DATASET_V1: SupportEvalDataset;
    loadBrunoSupportEvalDataset: typeof loadBrunoSupportEvalDataset;
    listBrunoSupportEvalCases: typeof listBrunoSupportEvalCases;
    listBrunoSupportEvalCasesByCategory: typeof listBrunoSupportEvalCasesByCategory;
    getBrunoSupportEvalCase: typeof getBrunoSupportEvalCase;
    clampSupportEvalMetricScore: typeof clampSupportEvalMetricScore;
    normalizeSupportEvalMetricScores: typeof normalizeSupportEvalMetricScores;
    calculateSupportEvalRunAggregates: typeof calculateSupportEvalRunAggregates;
    runSupportEvalCase: typeof runSupportEvalCase;
    runSupportEvalDataset: typeof runSupportEvalDataset;
    renderSupportEvalRunMarkdown: typeof renderSupportEvalRunMarkdown;
    normalizeSupportBotTelemetryFeedbackSignals: typeof normalizeSupportBotTelemetryFeedbackSignals;
    normalizeSupportEvalFeedbackSignals: typeof normalizeSupportEvalFeedbackSignals;
    aggregateSupportBotFeedbackSignals: typeof aggregateSupportBotFeedbackSignals;
    buildSupportBotFeedbackReport: typeof buildSupportBotFeedbackReport;
    renderSupportBotFeedbackMarkdown: typeof renderSupportBotFeedbackMarkdown;
    DEFAULT_SUPPORT_EVAL_GATE_THRESHOLDS: SupportEvalGateThresholds;
    parseSupportEvalGateThresholdOverrides: typeof parseSupportEvalGateThresholdOverrides;
    createSupportEvalGateThresholds: typeof createSupportEvalGateThresholds;
    evaluateSupportEvalGate: typeof evaluateSupportEvalGate;
    renderSupportEvalGateMarkdown: typeof renderSupportEvalGateMarkdown;
};

export { BRUNO_SUPPORT_EVAL_DATASET_V1, BRUNO_SUPPORT_EVAL_DATASET_VERSION, BuildSupportBotFeedbackReportOptions, DEFAULT_SUPPORT_EVAL_GATE_THRESHOLDS, DatasetValidationError, RunSupportEvalDatasetOptions, SUPPORT_BOT_FEEDBACK_CONSTANTS, SupportBotFeedbackCitationSignal, SupportBotFeedbackGapType, SupportBotFeedbackOutcome, SupportBotFeedbackReport, SupportBotFeedbackSeverity, SupportBotFeedbackSignal, SupportBotFeedbackSignalSource, SupportBotFeedbackSignalType, SupportBotFeedbackSourceGap, SupportBotFeedbackTelemetryCompletedEvent, SupportBotFeedbackTelemetryEvent, SupportBotFeedbackTelemetryFailedEvent, SupportBotFeedbackTelemetryFailureStage, SupportBotFeedbackTelemetryIgnoredEvent, SupportBotFeedbackTelemetryRouteSummary, SupportBotFeedbackTriageItem, SupportEvalAnswerRubric, SupportEvalCase, SupportEvalCaseRunError, SupportEvalCaseRunResult, SupportEvalCaseRunStatus, SupportEvalCategory, SupportEvalCitationImportance, SupportEvalCitationTarget, SupportEvalDataset, SupportEvalDatasetMetadata, SupportEvalDatasetStagedDelivery, SupportEvalDeliveryStage, SupportEvalDifficulty, SupportEvalEscalationChannel, SupportEvalExecutor, SupportEvalExecutorCitation, SupportEvalExecutorResult, SupportEvalFallbackPolicy, SupportEvalGateConfigError, SupportEvalGateFailure, SupportEvalGateFailureCode, SupportEvalGateMetricThresholds, SupportEvalGateResult, SupportEvalGateStatus, SupportEvalGateThresholdOverrides, SupportEvalGateThresholds, SupportEvalMetricName, SupportEvalMetricScores, SupportEvalRunAggregates, SupportEvalRunMetricSummary, SupportEvalRunOutput, SupportEvalSourceType, SupportEvalTrustTier, ZERO_SUPPORT_EVAL_METRICS, aggregateSupportBotFeedbackSignals, buildSupportBotFeedbackReport, calculateSupportEvalRunAggregates, clampSupportEvalMetricScore, createSupportEvalGateThresholds, dedupeSupportBotFeedbackSignals, evaluateSupportEvalGate, getBrunoSupportEvalCase, listBrunoSupportEvalCases, listBrunoSupportEvalCasesByCategory, loadBrunoSupportEvalDataset, normalizeSupportBotTelemetryFeedbackSignals, normalizeSupportEvalFeedbackSignals, normalizeSupportEvalMetricScores, parseSupportEvalGateThresholdOverrides, renderSupportBotFeedbackMarkdown, renderSupportEvalGateMarkdown, renderSupportEvalRunMarkdown, runSupportEvalCase, runSupportEvalDataset, supportBotFeedbackCitationSignals, supportBotFeedbackGapTypes, supportBotFeedbackOutcomes, supportBotFeedbackSeverities, supportBotFeedbackSignalSources, supportBotFeedbackSignalTypes, supportBotFeedbackTelemetryFailureStages, supportEvalCaseRunStatuses, supportEvalCategories, supportEvalCitationImportances, supportEvalDeliveryStages, supportEvalDifficulties, supportEvalEscalationChannels, supportEvalFallbackPolicies, supportEvalGateFailureCodes, supportEvalGateStatuses, supportEvalMetricNames, supportEvalSourceTypes, supportEvalTrustTiers, supportEvals, validateSupportEvalCase, validateSupportEvalDataset };
