import { type BuildSupportBotFeedbackReportOptions, type SupportBotFeedbackReport, type SupportBotFeedbackSignal, type SupportBotFeedbackTelemetryEvent, type SupportBotFeedbackTriageItem, type SupportEvalRunOutput } from './types';
export declare function normalizeSupportBotTelemetryFeedbackSignals(events?: readonly SupportBotFeedbackTelemetryEvent[]): SupportBotFeedbackSignal[];
export declare function normalizeSupportEvalFeedbackSignals(runs?: readonly SupportEvalRunOutput[]): SupportBotFeedbackSignal[];
export declare function dedupeSupportBotFeedbackSignals(signals: readonly SupportBotFeedbackSignal[]): SupportBotFeedbackSignal[];
export declare function aggregateSupportBotFeedbackSignals(signals: readonly SupportBotFeedbackSignal[]): SupportBotFeedbackTriageItem[];
export declare function buildSupportBotFeedbackReport(options?: BuildSupportBotFeedbackReportOptions): SupportBotFeedbackReport;
export declare const SUPPORT_BOT_FEEDBACK_CONSTANTS: {
    signalTypes: readonly ["unanswered", "request_failure", "citation_gap", "eval_failure", "quality_gap"];
    severities: readonly ["low", "medium", "high", "critical"];
    gapTypes: readonly ["content_gap", "citation_gap", "routing_gap", "retrieval_gap", "generation_gap", "validation_gap", "quality_gap"];
    citationSignals: readonly ["sufficient", "low_citation", "citation_miss", "not_applicable"];
};
