import {
  supportBotFeedbackCitationSignals,
  supportBotFeedbackGapTypes,
  supportBotFeedbackSeverities,
  supportBotFeedbackSignalTypes,
  type BuildSupportBotFeedbackReportOptions,
  type SupportBotFeedbackCitationSignal,
  type SupportBotFeedbackGapType,
  type SupportBotFeedbackReport,
  type SupportBotFeedbackSeverity,
  type SupportBotFeedbackSignal,
  type SupportBotFeedbackSignalSource,
  type SupportBotFeedbackSignalType,
  type SupportBotFeedbackSourceGap,
  type SupportBotFeedbackTelemetryCompletedEvent,
  type SupportBotFeedbackTelemetryEvent,
  type SupportBotFeedbackTelemetryFailureStage,
  type SupportBotFeedbackTelemetryFailedEvent,
  type SupportBotFeedbackTriageItem,
  type SupportEvalCaseRunResult,
  type SupportEvalCategory,
  type SupportEvalMetricName,
  type SupportEvalRunOutput,
  type SupportEvalSourceType,
  type SupportEvalTrustTier
} from './types';

const SOURCE_HINTS_BY_TOPIC: Partial<Record<string, {
  sourceTypes: SupportEvalSourceType[];
  trustTiers: SupportEvalTrustTier[];
  sourceGroups: string[];
}>> = {
  install: { sourceTypes: ['docs_site', 'website'], trustTiers: ['official_docs'], sourceGroups: ['docs_site', 'website'] },
  cli: { sourceTypes: ['docs_site', 'repo'], trustTiers: ['official_docs', 'repo'], sourceGroups: ['docs_site', 'repo'] },
  scripting: { sourceTypes: ['docs_site', 'repo'], trustTiers: ['official_docs', 'repo'], sourceGroups: ['docs_site', 'repo'] },
  auth: { sourceTypes: ['docs_site'], trustTiers: ['official_docs'], sourceGroups: ['docs_site'] },
  pricing: { sourceTypes: ['website'], trustTiers: ['official_docs'], sourceGroups: ['website'] },
  troubleshooting: { sourceTypes: ['docs_site', 'repo', 'github'], trustTiers: ['official_docs', 'repo'], sourceGroups: ['docs_site', 'repo', 'github'] },
  version_release: { sourceTypes: ['github', 'website'], trustTiers: ['repo', 'official_docs'], sourceGroups: ['github_releases', 'website'] },
  fallback: { sourceTypes: ['docs_site', 'github'], trustTiers: ['official_docs', 'repo'], sourceGroups: ['docs_site', 'github_discussions'] },
  escalation: { sourceTypes: ['docs_site', 'github', 'website'], trustTiers: ['official_docs', 'repo'], sourceGroups: ['docs_site', 'github', 'website'] }
};

const SIGNAL_WEIGHT: Record<SupportBotFeedbackSignalType, number> = {
  unanswered: 3,
  request_failure: 4,
  citation_gap: 2,
  eval_failure: 4,
  quality_gap: 3
};

const SEVERITY_WEIGHT: Record<SupportBotFeedbackSeverity, number> = {
  low: 1,
  medium: 2,
  high: 4,
  critical: 6
};

const QUALITY_THRESHOLDS: Record<SupportEvalMetricName, number> = {
  groundedness: 0.7,
  citationPrecision: 0.6,
  correctness: 0.75,
  fallbackQuality: 0.6
};

function unique<T extends string>(values: readonly T[]): T[] {
  return Array.from(new Set(values.filter((value): value is T => value.length > 0)));
}

function toTitleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function getTopic(routeIntent?: string, category?: SupportEvalCategory): string {
  return routeIntent ?? category ?? 'unknown';
}

function inferHints(topic?: string, urls: readonly string[] = []): {
  sourceTypes: SupportEvalSourceType[];
  trustTiers: SupportEvalTrustTier[];
  sourceGroups: string[];
} {
  const topicHints = topic ? SOURCE_HINTS_BY_TOPIC[topic] : undefined;
  const sourceTypes = [...(topicHints?.sourceTypes ?? [])];
  const trustTiers = [...(topicHints?.trustTiers ?? [])];
  const sourceGroups = [...(topicHints?.sourceGroups ?? [])];

  urls.forEach((value) => {
    if (value.startsWith('mailto:')) {
      sourceTypes.push('website');
      trustTiers.push('official_docs');
      sourceGroups.push('security_email');
      return;
    }

    let url: URL;

    try {
      url = new URL(value);
    } catch {
      return;
    }

    if (url.hostname === 'docs.usebruno.com') {
      sourceTypes.push('docs_site');
      trustTiers.push('official_docs');
      sourceGroups.push('docs_site');
      return;
    }

    if (url.hostname === 'usebruno.com' || url.hostname === 'www.usebruno.com') {
      sourceTypes.push('website');
      trustTiers.push('official_docs');
      sourceGroups.push(url.pathname.includes('/pricing') ? 'pricing' : 'website');
      return;
    }

    if (url.hostname === 'github.com') {
      sourceTypes.push('github');
      trustTiers.push('repo');
      sourceGroups.push(
        url.pathname.includes('/discussions')
          ? 'github_discussions'
          : url.pathname.includes('/issues')
            ? 'github_issues'
            : url.pathname.includes('/releases')
              ? 'github_releases'
              : 'github'
      );
      return;
    }

    if (url.hostname.includes('stackoverflow.com')) {
      sourceTypes.push('stackoverflow');
      trustTiers.push('community');
      sourceGroups.push('stackoverflow');
    }
  });

  return {
    sourceTypes: unique(sourceTypes),
    trustTiers: unique(trustTiers),
    sourceGroups: unique(sourceGroups)
  };
}

function buildSourceGap(input: {
  gapType: SupportBotFeedbackGapType;
  routeIntent?: string;
  category?: SupportEvalCategory;
  failureStage?: SupportBotFeedbackTelemetryFailureStage;
  citationSignal?: Extract<SupportBotFeedbackCitationSignal, 'low_citation' | 'citation_miss'>;
  urls?: readonly string[];
}): SupportBotFeedbackSourceGap {
  const topic = getTopic(input.routeIntent, input.category);
  const hints = inferHints(topic, input.urls);
  const groupParts = [input.gapType, topic];

  if (input.failureStage) {
    groupParts.push(input.failureStage);
  }

  if (input.citationSignal) {
    groupParts.push(input.citationSignal);
  }

  return {
    gapType: input.gapType,
    groupKey: groupParts.join(':'),
    label: `${toTitleCase(topic)} ${toTitleCase(input.gapType.replace(/_gap$/, ' gap'))}`,
    routeIntent: input.routeIntent,
    category: input.category,
    failureStage: input.failureStage,
    citationSignal: input.citationSignal,
    sourceTypes: hints.sourceTypes,
    trustTiers: hints.trustTiers,
    sourceGroups: hints.sourceGroups
  };
}

function makeSignal(input: Omit<SupportBotFeedbackSignal, 'fingerprint'> & { fingerprintParts: string[] }): SupportBotFeedbackSignal {
  return {
    ...input,
    fingerprint: input.fingerprintParts.join(':')
  };
}

function getCitationSeverity(signal: Extract<SupportBotFeedbackCitationSignal, 'low_citation' | 'citation_miss'>): SupportBotFeedbackSeverity {
  return signal === 'citation_miss' ? 'high' : 'medium';
}

function getFailureSeverity(stage: SupportBotFeedbackTelemetryFailureStage): SupportBotFeedbackSeverity {
  if (stage === 'request_validation') {
    return 'medium';
  }

  if (stage === 'response_validation' || stage === 'generation') {
    return 'critical';
  }

  return 'high';
}

function mapFailureGapType(stage: SupportBotFeedbackTelemetryFailureStage): SupportBotFeedbackGapType {
  if (stage === 'retrieval') {
    return 'retrieval_gap';
  }

  if (stage === 'generation') {
    return 'generation_gap';
  }

  if (stage === 'request_validation' || stage === 'response_validation') {
    return 'validation_gap';
  }

  return 'quality_gap';
}

function normalizeTelemetryCompletedEvent(event: SupportBotFeedbackTelemetryCompletedEvent): SupportBotFeedbackSignal[] {
  const routeIntent = event.route?.intent;
  const signals: SupportBotFeedbackSignal[] = [];

  if (event.completion.unanswered || event.completion.outcome === 'fallback') {
    const gapType = event.route?.classificationFallback ? 'routing_gap' : 'content_gap';
    const sourceGap = buildSourceGap({ gapType, routeIntent });

    signals.push(
      makeSignal({
        source: 'telemetry',
        fingerprintParts: ['telemetry', event.requestId, 'unanswered', event.completion.fallbackReason ?? 'none'],
        signalType: 'unanswered',
        severity: gapType === 'routing_gap' ? 'high' : event.completion.fallbackReason === 'insufficient_evidence' ? 'high' : 'medium',
        occurredAt: event.timestamp,
        summary: `Request fell back for ${toTitleCase(getTopic(routeIntent))}${event.completion.fallbackReason ? ` (${event.completion.fallbackReason})` : ''}.`,
        routeIntent,
        requestId: event.requestId,
        outcome: event.completion.outcome,
        sourceGap,
        metadata: {
          fallbackReason: event.completion.fallbackReason,
          statusCode: event.completion.statusCode,
          unanswered: event.completion.unanswered
        }
      })
    );
  }

  if (event.completion.citationSignal === 'citation_miss' || event.completion.citationSignal === 'low_citation') {
    const sourceGap = buildSourceGap({
      gapType: 'citation_gap',
      routeIntent,
      citationSignal: event.completion.citationSignal
    });

    signals.push(
      makeSignal({
        source: 'telemetry',
        fingerprintParts: ['telemetry', event.requestId, 'citation', event.completion.citationSignal],
        signalType: 'citation_gap',
        severity: getCitationSeverity(event.completion.citationSignal),
        occurredAt: event.timestamp,
        summary: `${toTitleCase(getTopic(routeIntent))} response had ${event.completion.citationSignal.replace('_', ' ')} telemetry.`,
        routeIntent,
        requestId: event.requestId,
        outcome: event.completion.outcome,
        citationSignal: event.completion.citationSignal,
        sourceGap,
        metadata: {
          statusCode: event.completion.statusCode
        }
      })
    );
  }

  return signals;
}

function normalizeTelemetryFailedEvent(event: SupportBotFeedbackTelemetryFailedEvent): SupportBotFeedbackSignal[] {
  const routeIntent = event.route?.intent;
  const failureStage = event.failure.stage;
  const sourceGap = buildSourceGap({
    gapType: mapFailureGapType(failureStage),
    routeIntent,
    failureStage
  });

  return [
    makeSignal({
      source: 'telemetry',
      fingerprintParts: ['telemetry', event.requestId, 'failure', failureStage],
      signalType: 'request_failure',
      severity: getFailureSeverity(failureStage),
      occurredAt: event.timestamp,
      summary: `${toTitleCase(getTopic(routeIntent))} request failed during ${failureStage}.`,
      routeIntent,
      requestId: event.requestId,
      failureStage,
      sourceGap,
      metadata: {
        errorMessage: event.failure.error.message,
        errorName: event.failure.error.name,
        statusCode: event.failure.statusCode
      }
    })
  ];
}

function getWeakMetrics(result: SupportEvalCaseRunResult): SupportEvalMetricName[] {
  return Object.entries(QUALITY_THRESHOLDS)
    .filter(([metricName, threshold]) => result.metrics[metricName as SupportEvalMetricName] < threshold)
    .map(([metricName]) => metricName as SupportEvalMetricName);
}

function getQualitySeverity(result: SupportEvalCaseRunResult, weakMetrics: SupportEvalMetricName[]): SupportBotFeedbackSeverity {
  const weakestScore = Math.min(...weakMetrics.map((metricName) => result.metrics[metricName]));

  if (weakestScore < 0.35 || weakMetrics.length >= 3) {
    return 'critical';
  }

  if (weakestScore < 0.6 || weakMetrics.length >= 2) {
    return 'high';
  }

  return 'medium';
}

function normalizeEvalRun(run: SupportEvalRunOutput): SupportBotFeedbackSignal[] {
  const signals: SupportBotFeedbackSignal[] = [];

  run.results.forEach((result) => {
    if (result.status === 'failed') {
      const sourceGap = buildSourceGap({
        gapType: 'quality_gap',
        category: result.category,
        failureStage: 'eval_execution'
      });

      signals.push(
        makeSignal({
          source: 'eval',
          fingerprintParts: ['eval', run.datasetId, result.caseId, 'failed'],
          signalType: 'eval_failure',
          severity: 'high',
          occurredAt: run.completedAt,
          summary: `Eval case ${result.caseId} failed for ${toTitleCase(result.category)}.`,
          category: result.category,
          caseId: result.caseId,
          datasetId: run.datasetId,
          failureStage: 'eval_execution',
          sourceGap,
          metadata: {
            errorMessage: result.error?.message ?? 'Execution failed'
          }
        })
      );

      return;
    }

    if (result.missingCitationUrls.length > 0) {
      const sourceGap = buildSourceGap({
        gapType: 'citation_gap',
        category: result.category,
        citationSignal: 'citation_miss',
        urls: result.missingCitationUrls
      });

      signals.push(
        makeSignal({
          source: 'eval',
          fingerprintParts: ['eval', run.datasetId, result.caseId, 'citation_gap'],
          signalType: 'citation_gap',
          severity: result.missingCitationUrls.length > 1 ? 'high' : 'medium',
          occurredAt: run.completedAt,
          summary: `Eval case ${result.caseId} is missing ${result.missingCitationUrls.length} expected citation(s).`,
          category: result.category,
          caseId: result.caseId,
          datasetId: run.datasetId,
          citationSignal: 'citation_miss',
          sourceGap,
          metadata: {
            missingCitationUrls: result.missingCitationUrls
          }
        })
      );
    }

    const weakMetrics = getWeakMetrics(result);

    if (weakMetrics.length > 0) {
      const sourceGap = buildSourceGap({ gapType: 'quality_gap', category: result.category, urls: result.missingCitationUrls });

      signals.push(
        makeSignal({
          source: 'eval',
          fingerprintParts: ['eval', run.datasetId, result.caseId, 'quality_gap', weakMetrics.join(',')],
          signalType: 'quality_gap',
          severity: getQualitySeverity(result, weakMetrics),
          occurredAt: run.completedAt,
          summary: `Eval case ${result.caseId} underperformed on ${weakMetrics.join(', ')}.`,
          category: result.category,
          caseId: result.caseId,
          datasetId: run.datasetId,
          sourceGap,
          metadata: {
            weakMetrics,
            metrics: result.metrics
          }
        })
      );
    }
  });

  return signals;
}

export function normalizeSupportBotTelemetryFeedbackSignals(events: readonly SupportBotFeedbackTelemetryEvent[] = []): SupportBotFeedbackSignal[] {
  const signals = events.flatMap((event) => {
    if (event.type === 'support_bot.request.completed') {
      return normalizeTelemetryCompletedEvent(event);
    }

    if (event.type === 'support_bot.request.failed') {
      return normalizeTelemetryFailedEvent(event);
    }

    return [];
  });

  return dedupeSupportBotFeedbackSignals(signals);
}

export function normalizeSupportEvalFeedbackSignals(runs: readonly SupportEvalRunOutput[] = []): SupportBotFeedbackSignal[] {
  return dedupeSupportBotFeedbackSignals(runs.flatMap((run) => normalizeEvalRun(run)));
}

export function dedupeSupportBotFeedbackSignals(signals: readonly SupportBotFeedbackSignal[]): SupportBotFeedbackSignal[] {
  const uniqueSignals = new Map<string, SupportBotFeedbackSignal>();

  signals.forEach((signal) => {
    if (!uniqueSignals.has(signal.fingerprint)) {
      uniqueSignals.set(signal.fingerprint, signal);
    }
  });

  return Array.from(uniqueSignals.values()).sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
}

function toPriority(score: number, severities: SupportBotFeedbackSeverity[]): SupportBotFeedbackSeverity {
  if (severities.includes('critical') || score >= 15) {
    return 'critical';
  }

  if (severities.includes('high') || score >= 9) {
    return 'high';
  }

  if (score >= 4) {
    return 'medium';
  }

  return 'low';
}

function buildRecommendedActions(sourceGap: SupportBotFeedbackSourceGap): string[] {
  const sourceTargets = sourceGap.sourceGroups.length > 0 ? sourceGap.sourceGroups.join(', ') : 'official support sources';

  if (sourceGap.gapType === 'citation_gap') {
    return [
      `Review citation coverage for ${sourceTargets}.`,
      'Check retrieval/evidence packing to ensure the strongest sources are cited.'
    ];
  }

  if (sourceGap.gapType === 'retrieval_gap' || sourceGap.gapType === 'generation_gap') {
    return [
      `Investigate the ${sourceGap.failureStage ?? 'runtime'} failure path for ${toTitleCase(getTopic(sourceGap.routeIntent, sourceGap.category))}.`,
      `Verify the relevant source groups are fresh and queryable: ${sourceTargets}.`
    ];
  }

  if (sourceGap.gapType === 'routing_gap') {
    return ['Review route intent coverage and fallback triggers for this topic.'];
  }

  if (sourceGap.gapType === 'quality_gap') {
    return ['Review the failing eval cases and tighten grounded answer or fallback behavior.'];
  }

  return [`Expand or refresh source content for ${sourceTargets}.`];
}

export function aggregateSupportBotFeedbackSignals(signals: readonly SupportBotFeedbackSignal[]): SupportBotFeedbackTriageItem[] {
  const groups = new Map<string, SupportBotFeedbackSignal[]>();

  dedupeSupportBotFeedbackSignals(signals).forEach((signal) => {
    const groupSignals = groups.get(signal.sourceGap.groupKey) ?? [];
    groupSignals.push(signal);
    groups.set(signal.sourceGap.groupKey, groupSignals);
  });

  return Array.from(groups.entries())
    .map(([groupKey, groupSignals]) => {
      const severities = unique(groupSignals.map((signal) => signal.severity));
      const score = groupSignals.reduce(
        (total, signal) => total + SIGNAL_WEIGHT[signal.signalType] + SEVERITY_WEIGHT[signal.severity],
        Math.max(0, groupSignals.length - 1)
      );
      const sourceGap = groupSignals[0].sourceGap;

      return {
        groupKey,
        title: sourceGap.label,
        priority: toPriority(score, severities),
        priorityScore: score,
        signalCount: groupSignals.length,
        sourceCounts: {
          telemetry: groupSignals.filter((signal) => signal.source === 'telemetry').length,
          eval: groupSignals.filter((signal) => signal.source === 'eval').length
        } as Record<SupportBotFeedbackSignalSource, number>,
        signalTypes: unique(groupSignals.map((signal) => signal.signalType)),
        routeIntents: unique(groupSignals.map((signal) => signal.routeIntent ?? '')),
        categories: unique(groupSignals.map((signal) => signal.category ?? '')).filter(
          (value): value is SupportEvalCategory => value.length > 0
        ),
        sourceGap,
        signalFingerprints: groupSignals.map((signal) => signal.fingerprint),
        summaries: unique(groupSignals.map((signal) => signal.summary)).slice(0, 3),
        recommendedActions: buildRecommendedActions(sourceGap)
      };
    })
    .sort((left, right) => right.priorityScore - left.priorityScore || right.signalCount - left.signalCount || left.title.localeCompare(right.title));
}

export function buildSupportBotFeedbackReport(options: BuildSupportBotFeedbackReportOptions = {}): SupportBotFeedbackReport {
  const telemetrySignals = normalizeSupportBotTelemetryFeedbackSignals(options.telemetryEvents ?? []);
  const evalSignals = normalizeSupportEvalFeedbackSignals(options.evalRuns ?? []);
  const signals = dedupeSupportBotFeedbackSignals([...telemetrySignals, ...evalSignals]);
  const triageItems = aggregateSupportBotFeedbackSignals(signals);

  return {
    version: 1,
    generatedAt: (options.now ?? (() => new Date()))().toISOString(),
    inputs: {
      telemetryEventCount: options.telemetryEvents?.length ?? 0,
      evalRunCount: options.evalRuns?.length ?? 0,
      evalResultCount: (options.evalRuns ?? []).reduce((total, run) => total + run.results.length, 0)
    },
    totals: {
      signalCount: signals.length,
      triageItemCount: triageItems.length,
      telemetrySignalCount: telemetrySignals.length,
      evalSignalCount: evalSignals.length,
      highPriorityCount: triageItems.filter((item) => item.priority === 'high').length,
      criticalPriorityCount: triageItems.filter((item) => item.priority === 'critical').length
    },
    signals,
    triageItems
  };
}

export const SUPPORT_BOT_FEEDBACK_CONSTANTS = {
  signalTypes: supportBotFeedbackSignalTypes,
  severities: supportBotFeedbackSeverities,
  gapTypes: supportBotFeedbackGapTypes,
  citationSignals: supportBotFeedbackCitationSignals
};