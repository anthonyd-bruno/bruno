import type { SupportBotFeedbackReport, SupportEvalRunMetricSummary, SupportEvalRunOutput } from './types';

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

export function renderSupportBotFeedbackMarkdown(report: SupportBotFeedbackReport): string {
  const lines = [
    '# Bruno Support Feedback Triage',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Telemetry events processed: ${report.inputs.telemetryEventCount}`,
    `- Eval runs processed: ${report.inputs.evalRunCount}`,
    `- Normalized signals: ${report.totals.signalCount}`,
    `- Triage items: ${report.totals.triageItemCount}`,
    `- High priority items: ${report.totals.highPriorityCount}`,
    `- Critical priority items: ${report.totals.criticalPriorityCount}`,
    '',
    '## Prioritized Backlog',
    '',
    '| Priority | Signals | Gap | Topic | Sources |',
    '| --- | ---: | --- | --- | --- |',
    ...report.triageItems.map(
      (item) =>
        `| ${item.priority} | ${item.signalCount} | ${item.sourceGap.gapType} | ${item.routeIntents[0] ?? item.categories[0] ?? 'unknown'} | ${item.sourceGap.sourceGroups.join(', ') || 'n/a'} |`
    )
  ];

  report.triageItems.forEach((item) => {
    lines.push('', `### ${item.title}`, '');
    lines.push(`- Priority: **${item.priority}** (score: ${item.priorityScore})`);
    lines.push(`- Signals: ${item.signalCount} (${item.sourceCounts.telemetry} telemetry / ${item.sourceCounts.eval} eval)`);
    lines.push(`- Gap: ${item.sourceGap.gapType}`);

    if (item.recommendedActions.length > 0) {
      lines.push('- Recommended actions:');
      item.recommendedActions.forEach((action) => lines.push(`  - ${action}`));
    }

    if (item.summaries.length > 0) {
      lines.push('- Examples:');
      item.summaries.forEach((summary) => lines.push(`  - ${summary}`));
    }
  });

  return lines.join('\n');
}