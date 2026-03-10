import { createSupportEvalGateThresholds } from './thresholds';
import {
  supportEvalMetricNames,
  type SupportEvalGateFailure,
  type SupportEvalGateResult,
  type SupportEvalGateThresholdOverrides,
  type SupportEvalMetricName,
  type SupportEvalRunOutput
} from './types';

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function buildMetricFailure(metricName: SupportEvalMetricName, actual: number, expected: number): SupportEvalGateFailure {
  return {
    code: 'metric_threshold',
    metricName,
    actual,
    expected,
    message: `Average ${metricName} ${formatPercent(actual)} is below the launch threshold ${formatPercent(expected)}.`
  };
}

export function evaluateSupportEvalGate(
  run: SupportEvalRunOutput,
  thresholdOverrides: SupportEvalGateThresholdOverrides = {}
): SupportEvalGateResult {
  const thresholds = createSupportEvalGateThresholds(thresholdOverrides);
  const failures: SupportEvalGateFailure[] = [];

  if (run.aggregates.failedCaseCount > thresholds.maxFailedCaseCount) {
    failures.push({
      code: 'failed_case_count',
      actual: run.aggregates.failedCaseCount,
      expected: thresholds.maxFailedCaseCount,
      message:
        `Failed case count ${run.aggregates.failedCaseCount} exceeds the launch threshold ` +
        `${thresholds.maxFailedCaseCount}.`
    });
  }

  for (const metricName of supportEvalMetricNames) {
    const actualAverage = run.aggregates[metricName].average;
    const expectedAverage = thresholds.minimumAverageMetrics[metricName];

    if (actualAverage < expectedAverage) {
      failures.push(buildMetricFailure(metricName, actualAverage, expectedAverage));
    }
  }

  return {
    status: failures.length === 0 ? 'passed' : 'failed',
    datasetId: run.datasetId,
    datasetVersion: run.datasetVersion,
    aggregates: run.aggregates,
    thresholds,
    failures
  };
}

export function renderSupportEvalGateMarkdown(result: SupportEvalGateResult): string {
  const lines = [
    '# Bruno Support Eval Gate',
    '',
    `- Dataset: \`${result.datasetId}@${result.datasetVersion}\``,
    `- Status: **${result.status}**`,
    `- Cases: ${result.aggregates.caseCount}`,
    `- Completed cases: ${result.aggregates.completedCaseCount}`,
    `- Failed cases: ${result.aggregates.failedCaseCount} (threshold: ${result.thresholds.maxFailedCaseCount})`,
    '',
    '## Metric Thresholds',
    '',
    '| Metric | Actual average | Minimum required |',
    '| --- | ---: | ---: |',
    ...supportEvalMetricNames.map(
      (metricName) =>
        `| ${metricName} | ${formatPercent(result.aggregates[metricName].average)} | ${formatPercent(result.thresholds.minimumAverageMetrics[metricName])} |`
    )
  ];

  if (result.failures.length > 0) {
    lines.push('', '## Gate Failures', '');
    lines.push(...result.failures.map((failure) => `- ${failure.message}`));
  }

  return lines.join('\n');
}