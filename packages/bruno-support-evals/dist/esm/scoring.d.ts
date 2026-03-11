import { type SupportEvalCaseRunResult, type SupportEvalMetricScores, type SupportEvalRunAggregates } from './types';
export declare const ZERO_SUPPORT_EVAL_METRICS: SupportEvalMetricScores;
export declare function clampSupportEvalMetricScore(score: number): number;
export declare function normalizeSupportEvalMetricScores(scores: SupportEvalMetricScores): SupportEvalMetricScores;
export declare function calculateSupportEvalRunAggregates(results: SupportEvalCaseRunResult[]): SupportEvalRunAggregates;
