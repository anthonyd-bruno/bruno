import { describe, expect, it, jest } from '@jest/globals';

import {
  BRUNO_SUPPORT_EVAL_DATASET_V1,
  calculateSupportEvalRunAggregates,
  renderSupportEvalRunMarkdown,
  runSupportEvalDataset,
  type SupportEvalCase,
  type SupportEvalDataset,
  type SupportEvalExecutor,
  type SupportEvalExecutorResult
} from '../index';

function buildDataset(caseIds: string[]): SupportEvalDataset {
  const cases = BRUNO_SUPPORT_EVAL_DATASET_V1.cases.filter((entry) => caseIds.includes(entry.id));

  return {
    metadata: {
      ...BRUNO_SUPPORT_EVAL_DATASET_V1.metadata,
      datasetId: 'support-evals-test',
      datasetVersion: '0.0.0-test',
      stagedDelivery: {
        ...BRUNO_SUPPORT_EVAL_DATASET_V1.metadata.stagedDelivery,
        shippedCaseCount: cases.length,
        targetCaseCount: cases.length
      }
    },
    cases
  };
}

describe('support eval runner', () => {
  it('runs multiple cases through an injected executor and returns JSON-friendly results', async () => {
    const dataset = buildDataset(['install-downloads-page', 'pricing-current-plans', 'fallback-too-vague']);
    const executionOrder: string[] = [];
    const resultsByCaseId: Record<string, SupportEvalExecutorResult> = {
      'install-downloads-page': {
        answer: 'Use the official Bruno downloads page.',
        citations: [{ url: 'https://www.usebruno.com/downloads', title: 'Bruno downloads' }],
        metrics: { groundedness: 1, citationPrecision: 1, correctness: 0.75, fallbackQuality: 0.5 },
        notes: ['direct answer']
      },
      'pricing-current-plans': {
        answer: 'Check the pricing page for current plans.',
        citations: [{ url: 'https://www.usebruno.com/pricing', title: 'Bruno pricing' }],
        metrics: { groundedness: 0.5, citationPrecision: 0.25, correctness: 1, fallbackQuality: 0 },
        escalationChannels: ['pricing']
      },
      'fallback-too-vague': {
        answer: 'Can you share more detail, or use GitHub Discussions for support?',
        citations: [{ url: 'https://github.com/usebruno/bruno/discussions', title: 'Bruno GitHub discussions' }],
        metrics: { groundedness: 0.25, citationPrecision: 1, correctness: 0.5, fallbackQuality: 1 },
        fallbackApplied: true,
        escalationChannels: ['github_discussions']
      }
    };
    const executor: SupportEvalExecutor = {
      execute: jest.fn(async (evalCase: SupportEvalCase) => {
        executionOrder.push(evalCase.id);
        return resultsByCaseId[evalCase.id];
      })
    };
    const timestamps = ['2026-03-09T10:00:00.000Z', '2026-03-09T10:00:05.000Z'];
    const now = jest.fn(() => new Date(timestamps.shift() ?? '2026-03-09T10:00:05.000Z'));

    const run = await runSupportEvalDataset({ dataset, executor, now });

    expect(executionOrder).toEqual(dataset.cases.map((entry) => entry.id));
    expect(run.datasetId).toBe('support-evals-test');
    expect(run.datasetVersion).toBe('0.0.0-test');
    expect(run.startedAt).toBe('2026-03-09T10:00:00.000Z');
    expect(run.completedAt).toBe('2026-03-09T10:00:05.000Z');
    expect(run.results).toHaveLength(3);
    expect(run.results[0]).toMatchObject({
      caseId: 'install-downloads-page',
      status: 'completed',
      matchedCitationUrls: ['https://www.usebruno.com/downloads'],
      missingCitationUrls: []
    });
    expect(run.results[2]).toMatchObject({
      caseId: 'fallback-too-vague',
      fallbackApplied: true,
      escalationChannels: ['github_discussions']
    });
    expect(run.aggregates).toMatchObject({
      caseCount: 3,
      completedCaseCount: 3,
      failedCaseCount: 0
    });
    expect(run.aggregates.groundedness.average).toBeCloseTo((1 + 0.5 + 0.25) / 3);
    expect(run.aggregates.citationPrecision.average).toBeCloseTo((1 + 0.25 + 1) / 3);
    expect(run.aggregates.correctness.average).toBeCloseTo((0.75 + 1 + 0.5) / 3);
    expect(run.aggregates.fallbackQuality.average).toBeCloseTo((0.5 + 0 + 1) / 3);
  });

  it('calculates aggregate metrics across completed and failed results', () => {
    const aggregates = calculateSupportEvalRunAggregates([
      {
        caseId: 'one',
        category: 'install',
        status: 'completed',
        answer: 'A',
        citations: [],
        metrics: { groundedness: 1, citationPrecision: 0.5, correctness: 0.25, fallbackQuality: 0 },
        matchedCitationUrls: [],
        missingCitationUrls: [],
        fallbackApplied: false,
        escalationChannels: [],
        notes: []
      },
      {
        caseId: 'two',
        category: 'fallback',
        status: 'failed',
        answer: '',
        citations: [],
        metrics: { groundedness: 0, citationPrecision: 0, correctness: 0, fallbackQuality: 0 },
        matchedCitationUrls: [],
        missingCitationUrls: ['https://example.com'],
        fallbackApplied: false,
        escalationChannels: [],
        notes: [],
        error: { message: 'boom' }
      }
    ]);

    expect(aggregates).toMatchObject({
      caseCount: 2,
      completedCaseCount: 1,
      failedCaseCount: 1
    });
    expect(aggregates.groundedness.average).toBe(0.5);
    expect(aggregates.citationPrecision.average).toBe(0.25);
    expect(aggregates.correctness.average).toBe(0.125);
    expect(aggregates.fallbackQuality.average).toBe(0);
  });

  it('renders a markdown summary with aggregate and per-case sections', async () => {
    const dataset = buildDataset(['install-downloads-page']);
    const executor: SupportEvalExecutor = {
      execute: async () => ({
        answer: 'Use the official Bruno downloads page.',
        citations: [{ url: 'https://www.usebruno.com/downloads' }],
        metrics: { groundedness: 1, citationPrecision: 1, correctness: 1, fallbackQuality: 0 }
      })
    };

    const run = await runSupportEvalDataset({
      dataset,
      executor,
      now: () => new Date('2026-03-09T12:00:00.000Z')
    });
    const markdown = renderSupportEvalRunMarkdown(run);

    expect(markdown).toContain('# Bruno Support Eval Summary');
    expect(markdown).toContain('| Metric | Average |');
    expect(markdown).toContain('| Groundedness | 100.0% |');
    expect(markdown).toContain('| install-downloads-page | install | completed | 100.0% | 100.0% | 100.0% | 0.0% |');
    expect(markdown).not.toContain('## Failures');
  });

  it('handles executor failures and clamps edge-case metric values', async () => {
    const dataset = buildDataset(['install-downloads-page', 'fallback-too-vague']);
    const executor: SupportEvalExecutor = {
      execute: async (evalCase) => {
        if (evalCase.id === 'install-downloads-page') {
          return {
            answer: 'Use the official Bruno downloads page.',
            citations: [{ url: 'https://www.usebruno.com/downloads' }],
            metrics: { groundedness: 2, citationPrecision: -1, correctness: Number.NaN, fallbackQuality: 0.4 }
          };
        }

        throw new Error('executor unavailable');
      }
    };

    const run = await runSupportEvalDataset({
      dataset,
      executor,
      now: () => new Date('2026-03-09T13:00:00.000Z')
    });
    const markdown = renderSupportEvalRunMarkdown(run);

    expect(run.results[0].metrics).toEqual({
      groundedness: 1,
      citationPrecision: 0,
      correctness: 0,
      fallbackQuality: 0.4
    });
    expect(run.results[1]).toMatchObject({
      caseId: 'fallback-too-vague',
      status: 'failed',
      error: { message: 'executor unavailable' }
    });
    expect(run.aggregates).toMatchObject({
      caseCount: 2,
      completedCaseCount: 1,
      failedCaseCount: 1
    });
    expect(markdown).toContain('## Failures');
    expect(markdown).toContain('- `fallback-too-vague`: executor unavailable');
  });
});