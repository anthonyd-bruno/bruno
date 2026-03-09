import { loadBrunoSupportEvalDataset } from './loaders';
import { calculateSupportEvalRunAggregates, normalizeSupportEvalMetricScores, ZERO_SUPPORT_EVAL_METRICS } from './scoring';
import type {
  RunSupportEvalDatasetOptions,
  SupportEvalCase,
  SupportEvalCaseRunResult,
  SupportEvalExecutor,
  SupportEvalExecutorCitation,
  SupportEvalExecutorResult,
  SupportEvalRunOutput
} from './types';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

function getExpectedCitationUrls(evalCase: SupportEvalCase): string[] {
  return evalCase.expectedCitationTargets.map((target) => target.url);
}

function getMatchedCitationUrls(expectedCitationUrls: string[], citations: SupportEvalExecutorCitation[]): string[] {
  const citationUrls = new Set(citations.map((citation) => citation.url));
  return expectedCitationUrls.filter((url) => citationUrls.has(url));
}

function buildCompletedResult(evalCase: SupportEvalCase, execution: SupportEvalExecutorResult): SupportEvalCaseRunResult {
  const citations = execution.citations ?? [];
  const expectedCitationUrls = getExpectedCitationUrls(evalCase);
  const matchedCitationUrls = getMatchedCitationUrls(expectedCitationUrls, citations);

  return {
    caseId: evalCase.id,
    category: evalCase.category,
    status: 'completed',
    answer: execution.answer,
    citations,
    metrics: normalizeSupportEvalMetricScores(execution.metrics),
    matchedCitationUrls,
    missingCitationUrls: expectedCitationUrls.filter((url) => !matchedCitationUrls.includes(url)),
    fallbackApplied: Boolean(execution.fallbackApplied),
    escalationChannels: execution.escalationChannels ?? [],
    notes: execution.notes ?? []
  };
}

function buildFailedResult(evalCase: SupportEvalCase, error: unknown): SupportEvalCaseRunResult {
  return {
    caseId: evalCase.id,
    category: evalCase.category,
    status: 'failed',
    answer: '',
    citations: [],
    metrics: ZERO_SUPPORT_EVAL_METRICS,
    matchedCitationUrls: [],
    missingCitationUrls: getExpectedCitationUrls(evalCase),
    fallbackApplied: false,
    escalationChannels: [],
    notes: [],
    error: { message: toErrorMessage(error) }
  };
}

export async function runSupportEvalCase(evalCase: SupportEvalCase, executor: SupportEvalExecutor): Promise<SupportEvalCaseRunResult> {
  try {
    const execution = await executor.execute(evalCase);
    return buildCompletedResult(evalCase, execution);
  } catch (error) {
    return buildFailedResult(evalCase, error);
  }
}

export async function runSupportEvalDataset(options: RunSupportEvalDatasetOptions): Promise<SupportEvalRunOutput> {
  const dataset = options.dataset ?? loadBrunoSupportEvalDataset();
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const results: SupportEvalCaseRunResult[] = [];

  for (const evalCase of dataset.cases) {
    results.push(await runSupportEvalCase(evalCase, options.executor));
  }

  return {
    datasetId: dataset.metadata.datasetId,
    datasetVersion: dataset.metadata.datasetVersion,
    startedAt,
    completedAt: now().toISOString(),
    aggregates: calculateSupportEvalRunAggregates(results),
    results
  };
}