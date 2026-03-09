import {
  supportEvalMetricNames,
  type SupportEvalCaseRunResult,
  type SupportEvalMetricName,
  type SupportEvalMetricScores,
  type SupportEvalRunAggregates,
  type SupportEvalRunMetricSummary
} from './types';

export const ZERO_SUPPORT_EVAL_METRICS: SupportEvalMetricScores = {
  groundedness: 0,
  citationPrecision: 0,
  correctness: 0,
  fallbackQuality: 0
};

export function clampSupportEvalMetricScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  if (score <= 0) {
    return 0;
  }

  if (score >= 1) {
    return 1;
  }

  return score;
}

export function normalizeSupportEvalMetricScores(scores: SupportEvalMetricScores): SupportEvalMetricScores {
  return {
    groundedness: clampSupportEvalMetricScore(scores.groundedness),
    citationPrecision: clampSupportEvalMetricScore(scores.citationPrecision),
    correctness: clampSupportEvalMetricScore(scores.correctness),
    fallbackQuality: clampSupportEvalMetricScore(scores.fallbackQuality)
  };
}

function summarizeMetric(results: SupportEvalCaseRunResult[], metricName: SupportEvalMetricName): SupportEvalRunMetricSummary {
  const total = results.reduce((sum, result) => sum + result.metrics[metricName], 0);
  const count = results.length;

  return {
    average: count === 0 ? 0 : total / count,
    total,
    count
  };
}

export function calculateSupportEvalRunAggregates(results: SupportEvalCaseRunResult[]): SupportEvalRunAggregates {
  const completedCaseCount = results.filter((result) => result.status === 'completed').length;
  const failedCaseCount = results.length - completedCaseCount;

  return {
    caseCount: results.length,
    completedCaseCount,
    failedCaseCount,
    groundedness: summarizeMetric(results, supportEvalMetricNames[0]),
    citationPrecision: summarizeMetric(results, supportEvalMetricNames[1]),
    correctness: summarizeMetric(results, supportEvalMetricNames[2]),
    fallbackQuality: summarizeMetric(results, supportEvalMetricNames[3])
  };
}