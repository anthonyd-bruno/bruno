import type { SupportEvalRunMetricSummary, SupportEvalRunOutput } from './types';

function formatPercent(metric: SupportEvalRunMetricSummary): string {
  return `${(metric.average * 100).toFixed(1)}%`;
}

function formatStatus(status: 'completed' | 'failed'): string {
  return status === 'completed' ? 'completed' : 'failed';
}

export function renderSupportEvalRunMarkdown(run: SupportEvalRunOutput): string {
  const lines = [
    '# Bruno Support Eval Summary',
    '',
    `- Dataset: \`${run.datasetId}@${run.datasetVersion}\``,
    `- Started: ${run.startedAt}`,
    `- Completed: ${run.completedAt}`,
    `- Cases: ${run.aggregates.caseCount}`,
    `- Completed cases: ${run.aggregates.completedCaseCount}`,
    `- Failed cases: ${run.aggregates.failedCaseCount}`,
    '',
    '## Aggregate Metrics',
    '',
    '| Metric | Average |',
    '| --- | ---: |',
    `| Groundedness | ${formatPercent(run.aggregates.groundedness)} |`,
    `| Citation Precision | ${formatPercent(run.aggregates.citationPrecision)} |`,
    `| Correctness | ${formatPercent(run.aggregates.correctness)} |`,
    `| Fallback Quality | ${formatPercent(run.aggregates.fallbackQuality)} |`,
    '',
    '## Case Results',
    '',
    '| Case | Category | Status | Groundedness | Citation Precision | Correctness | Fallback Quality |',
    '| --- | --- | --- | ---: | ---: | ---: | ---: |',
    ...run.results.map(
      (result) =>
        `| ${result.caseId} | ${result.category} | ${formatStatus(result.status)} | ${formatPercent({ average: result.metrics.groundedness, total: result.metrics.groundedness, count: 1 })} | ${formatPercent({ average: result.metrics.citationPrecision, total: result.metrics.citationPrecision, count: 1 })} | ${formatPercent({ average: result.metrics.correctness, total: result.metrics.correctness, count: 1 })} | ${formatPercent({ average: result.metrics.fallbackQuality, total: result.metrics.fallbackQuality, count: 1 })} |`
    )
  ];

  const failures = run.results.filter((result) => result.status === 'failed');

  if (failures.length > 0) {
    lines.push('', '## Failures', '');
    lines.push(...failures.map((result) => `- \`${result.caseId}\`: ${result.error?.message ?? 'Execution failed'}`));
  }

  return lines.join('\n');
}