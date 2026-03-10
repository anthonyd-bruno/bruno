import { describe, expect, it } from '@jest/globals';

import {
  SupportEvalGateConfigError,
  calculateSupportEvalRunAggregates,
  createSupportEvalGateThresholds,
  evaluateSupportEvalGate,
  parseSupportEvalGateThresholdOverrides,
  renderSupportEvalGateMarkdown,
  type SupportEvalCaseRunResult,
  type SupportEvalRunOutput
} from '../index';

function buildRun(results: SupportEvalCaseRunResult[]): SupportEvalRunOutput {
  return {
    datasetId: 'bruno-support-evals',
    datasetVersion: '1.0.0-test',
    startedAt: '2026-03-09T14:00:00.000Z',
    completedAt: '2026-03-09T14:00:05.000Z',
    aggregates: calculateSupportEvalRunAggregates(results),
    results
  };
}

describe('support eval launch gate', () => {
  it('passes when failed-case and average-metric thresholds are met', () => {
    const run = buildRun([
      {
        caseId: 'install-downloads-page',
        category: 'install',
        status: 'completed',
        answer: 'Use the official downloads page.',
        citations: [{ url: 'https://www.usebruno.com/downloads' }],
        metrics: { groundedness: 0.92, citationPrecision: 0.91, correctness: 0.88, fallbackQuality: 0.86 },
        matchedCitationUrls: ['https://www.usebruno.com/downloads'],
        missingCitationUrls: [],
        fallbackApplied: false,
        escalationChannels: [],
        notes: []
      }
    ]);

    const result = evaluateSupportEvalGate(run, {
      maxFailedCaseCount: 0,
      minimumAverageMetrics: {
        groundedness: 0.9,
        citationPrecision: 0.9,
        correctness: 0.85,
        fallbackQuality: 0.8
      }
    });

    expect(result.status).toBe('passed');
    expect(result.failures).toEqual([]);
    expect(result.thresholds.minimumAverageMetrics.correctness).toBe(0.85);
  });

  it('returns explicit failures for failed cases and missed metric thresholds', () => {
    const run = buildRun([
      {
        caseId: 'install-downloads-page',
        category: 'install',
        status: 'completed',
        answer: 'Use the official downloads page.',
        citations: [{ url: 'https://www.usebruno.com/downloads' }],
        metrics: { groundedness: 0.8, citationPrecision: 0.6, correctness: 0.9, fallbackQuality: 0.7 },
        matchedCitationUrls: ['https://www.usebruno.com/downloads'],
        missingCitationUrls: [],
        fallbackApplied: false,
        escalationChannels: [],
        notes: []
      },
      {
        caseId: 'fallback-too-vague',
        category: 'fallback',
        status: 'failed',
        answer: '',
        citations: [],
        metrics: { groundedness: 0, citationPrecision: 0, correctness: 0, fallbackQuality: 0 },
        matchedCitationUrls: [],
        missingCitationUrls: ['https://github.com/usebruno/bruno/discussions'],
        fallbackApplied: false,
        escalationChannels: [],
        notes: [],
        error: { message: 'executor unavailable' }
      }
    ]);

    const result = evaluateSupportEvalGate(run, {
      maxFailedCaseCount: 0,
      minimumAverageMetrics: {
        groundedness: 0.75,
        citationPrecision: 0.5,
        correctness: 0.6,
        fallbackQuality: 0.5
      }
    });

    expect(result.status).toBe('failed');
    expect(result.failures.map((failure) => failure.code)).toEqual([
      'failed_case_count',
      'metric_threshold',
      'metric_threshold',
      'metric_threshold',
      'metric_threshold'
    ]);
    expect(result.failures[0].message).toContain('Failed case count 1 exceeds the launch threshold 0');
    expect(result.failures.find((failure) => failure.metricName === 'groundedness')).toMatchObject({
      actual: 0.4,
      expected: 0.75
    });
    expect(result.failures.find((failure) => failure.metricName === 'correctness')).toMatchObject({
      actual: 0.45,
      expected: 0.6
    });

    const markdown = renderSupportEvalGateMarkdown(result);
    expect(markdown).toContain('# Bruno Support Eval Gate');
    expect(markdown).toContain('- Status: **failed**');
    expect(markdown).toContain('## Gate Failures');
  });

  it('normalizes threshold values without changing the gate logic', () => {
    const thresholds = createSupportEvalGateThresholds({
      maxFailedCaseCount: 1.9,
      minimumAverageMetrics: {
        groundedness: 1.5,
        citationPrecision: -0.25
      }
    });

    expect(thresholds.maxFailedCaseCount).toBe(1);
    expect(thresholds.minimumAverageMetrics.groundedness).toBe(1);
    expect(thresholds.minimumAverageMetrics.citationPrecision).toBe(0);
    expect(thresholds.minimumAverageMetrics.correctness).toBeGreaterThan(0);
  });

  it('rejects malformed threshold overrides so CI tuning changes fail fast', () => {
    expect(() => parseSupportEvalGateThresholdOverrides({ unsupported: true })).toThrow(SupportEvalGateConfigError);
    expect(() =>
      parseSupportEvalGateThresholdOverrides({ minimumAverageMetrics: { madeUpMetric: 0.9 } })
    ).toThrow('Unsupported support eval gate metric threshold: madeUpMetric');
    expect(() => parseSupportEvalGateThresholdOverrides({ maxFailedCaseCount: 'zero' })).toThrow(
      'support eval gate maxFailedCaseCount must be a finite number.'
    );
  });
});