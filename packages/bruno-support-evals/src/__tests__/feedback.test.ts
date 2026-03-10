import { describe, expect, it } from '@jest/globals';

import {
  aggregateSupportBotFeedbackSignals,
  buildSupportBotFeedbackReport,
  normalizeSupportBotTelemetryFeedbackSignals,
  normalizeSupportEvalFeedbackSignals,
  renderSupportBotFeedbackMarkdown,
  type SupportBotFeedbackTelemetryEvent,
  type SupportEvalRunOutput
} from '../index';

describe('support bot feedback automation', () => {
  it('normalizes telemetry fallback, citation, and failure events into feedback signals', () => {
    const signals = normalizeSupportBotTelemetryFeedbackSignals([
      {
        type: 'support_bot.request.completed',
        timestamp: '2026-03-09T10:00:00.000Z',
        requestId: 'req-1',
        route: { intent: 'install', classificationScore: 0.92, classificationFallback: false, matchedSignalCount: 2 },
        completion: {
          statusCode: 200,
          durationMs: 80,
          outcome: 'fallback',
          unanswered: true,
          fallbackReason: 'insufficient_evidence',
          citationSignal: 'not_applicable'
        }
      },
      {
        type: 'support_bot.request.completed',
        timestamp: '2026-03-09T10:05:00.000Z',
        requestId: 'req-2',
        route: { intent: 'troubleshooting', classificationScore: 0.88, classificationFallback: false, matchedSignalCount: 3 },
        completion: {
          statusCode: 200,
          durationMs: 120,
          outcome: 'answer',
          unanswered: false,
          citationSignal: 'citation_miss'
        }
      },
      {
        type: 'support_bot.request.failed',
        timestamp: '2026-03-09T10:10:00.000Z',
        requestId: 'req-3',
        route: { intent: 'pricing', classificationScore: 0.81, classificationFallback: false, matchedSignalCount: 1 },
        failure: {
          statusCode: 500,
          durationMs: 60,
          stage: 'retrieval',
          error: { name: 'Error', message: 'boom' }
        }
      }
    ] satisfies SupportBotFeedbackTelemetryEvent[]);

    expect(signals).toHaveLength(3);
    expect(signals.map((signal) => signal.signalType)).toEqual(['unanswered', 'citation_gap', 'request_failure']);
    expect(signals[0].sourceGap.gapType).toBe('content_gap');
    expect(signals[1].sourceGap.sourceTypes).toContain('docs_site');
    expect(signals[2].failureStage).toBe('retrieval');
  });

  it('normalizes eval failures, missing citations, and weak quality metrics into source-gap signals', () => {
    const run: SupportEvalRunOutput = {
      datasetId: 'support-evals-test',
      datasetVersion: '0.0.0-test',
      startedAt: '2026-03-09T11:00:00.000Z',
      completedAt: '2026-03-09T11:00:05.000Z',
      aggregates: {
        caseCount: 3,
        completedCaseCount: 2,
        failedCaseCount: 1,
        groundedness: { average: 0.4, total: 1.2, count: 3 },
        citationPrecision: { average: 0.2, total: 0.6, count: 3 },
        correctness: { average: 0.3, total: 0.9, count: 3 },
        fallbackQuality: { average: 0.4, total: 1.2, count: 3 }
      },
      results: [
        {
          caseId: 'pricing-current-plans',
          category: 'pricing',
          status: 'completed',
          answer: 'Use the pricing page.',
          citations: [],
          metrics: { groundedness: 0.6, citationPrecision: 0.2, correctness: 0.8, fallbackQuality: 1 },
          matchedCitationUrls: [],
          missingCitationUrls: ['https://www.usebruno.com/pricing'],
          fallbackApplied: false,
          escalationChannels: [],
          notes: []
        },
        {
          caseId: 'install-downloads-page',
          category: 'install',
          status: 'completed',
          answer: 'Maybe use Bruno somehow.',
          citations: [{ url: 'https://www.usebruno.com/downloads' }],
          metrics: { groundedness: 0.3, citationPrecision: 0.5, correctness: 0.4, fallbackQuality: 0.9 },
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
      ]
    };

    const signals = normalizeSupportEvalFeedbackSignals([run]);

    expect(signals).toHaveLength(4);
    expect(signals.map((signal) => signal.signalType)).toEqual([
      'citation_gap',
      'quality_gap',
      'quality_gap',
      'eval_failure'
    ]);
    expect(signals[0].sourceGap.sourceGroups).toContain('pricing');
    expect(signals[3].failureStage).toBe('eval_execution');
    expect(signals[2].metadata?.weakMetrics).toEqual(['groundedness', 'citationPrecision', 'correctness']);
  });

  it('dedupes repeated signals and prioritizes grouped gaps for triage reports', () => {
    const telemetryEvents: SupportBotFeedbackTelemetryEvent[] = [
      {
        type: 'support_bot.request.completed',
        timestamp: '2026-03-09T12:00:00.000Z',
        requestId: 'req-1',
        route: { intent: 'install', classificationScore: 0.91, classificationFallback: false, matchedSignalCount: 2 },
        completion: {
          statusCode: 200,
          durationMs: 70,
          outcome: 'fallback',
          unanswered: true,
          fallbackReason: 'insufficient_evidence',
          citationSignal: 'not_applicable'
        }
      },
      {
        type: 'support_bot.request.completed',
        timestamp: '2026-03-09T12:00:00.000Z',
        requestId: 'req-1',
        route: { intent: 'install', classificationScore: 0.91, classificationFallback: false, matchedSignalCount: 2 },
        completion: {
          statusCode: 200,
          durationMs: 70,
          outcome: 'fallback',
          unanswered: true,
          fallbackReason: 'insufficient_evidence',
          citationSignal: 'not_applicable'
        }
      },
      {
        type: 'support_bot.request.completed',
        timestamp: '2026-03-09T12:05:00.000Z',
        requestId: 'req-2',
        route: { intent: 'install', classificationScore: 0.87, classificationFallback: false, matchedSignalCount: 2 },
        completion: {
          statusCode: 200,
          durationMs: 95,
          outcome: 'fallback',
          unanswered: true,
          fallbackReason: 'weak_evidence',
          citationSignal: 'not_applicable'
        }
      },
      {
        type: 'support_bot.request.failed',
        timestamp: '2026-03-09T12:10:00.000Z',
        requestId: 'req-3',
        route: { intent: 'pricing', classificationScore: 0.84, classificationFallback: false, matchedSignalCount: 1 },
        failure: {
          statusCode: 500,
          durationMs: 60,
          stage: 'generation',
          error: { name: 'Error', message: 'generation broke' }
        }
      }
    ];
    const report = buildSupportBotFeedbackReport({ telemetryEvents, now: () => new Date('2026-03-09T12:15:00.000Z') });
    const triageItems = aggregateSupportBotFeedbackSignals(report.signals);
    const markdown = renderSupportBotFeedbackMarkdown(report);

    expect(report.totals.signalCount).toBe(3);
    expect(triageItems[0]).toMatchObject({
      groupKey: 'content_gap:install',
      signalCount: 2,
      priority: 'high'
    });
    expect(triageItems[1]).toMatchObject({
      groupKey: 'generation_gap:pricing:generation',
      priority: 'critical'
    });
    expect(markdown).toContain('# Bruno Support Feedback Triage');
    expect(markdown).toContain('Install Content Gap');
    expect(markdown).toContain('Pricing Generation Gap');
  });
});