import { DocsSiteIngester, GitHubIngester, RepoIngester, WebsiteIngester } from '../ingesters'
import type { SourceDocument } from '../types'
import {
  getSupportSyncNextDueAt,
  isSupportSyncSourceGroupDue,
  parseSupportSyncScheduleConfig,
  type SupportSyncScheduleConfig,
  type SupportSyncSourceGroupId
} from './cadence'
import {
  evaluateSupportSyncStaleness,
  parseSupportSyncState,
  recordSupportSyncSuccess,
  type SupportSyncStalenessReport,
  type SupportSyncState
} from './staleness'

const DOCS_EXCLUDED_PATHS = ['/git-integration/provider', '/git-integration/consumer', '/bruno-basics/run-a-collection']
const WEBSITE_HIGH_CHURN_TARGET_PATHS = ['/changelog', '/downloads', '/pricing']
const WEBSITE_HOME_TARGET_PATHS = ['/']
const WEBSITE_DAILY_TARGET_PATHS = ['/support', '/roadmap', '/terms', '/privacy-policy']

export type SupportSyncHandler = () => Promise<SourceDocument[]>

export type SupportSyncHandlerMap = Record<SupportSyncSourceGroupId, SupportSyncHandler>

export interface SupportSyncAttemptResult {
  attempt: number;
  status: 'succeeded' | 'failed';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  documentCount: number;
  error?: string;
}

export interface SupportSyncSourceGroupRunResult {
  id: SupportSyncSourceGroupId;
  label: string;
  cadenceHours: number;
  staleAfterHours: number;
  status: 'succeeded' | 'failed' | 'skipped_not_due';
  attempts: SupportSyncAttemptResult[];
  documentCount: number;
  lastSuccessfulAtBeforeRun?: string;
  lastSuccessfulAtAfterRun?: string;
  nextDueAt?: string;
}

export interface SupportSyncRunOutput {
  version: 1;
  status: 'completed' | 'failed';
  startedAt: string;
  completedAt: string;
  schedule: SupportSyncScheduleConfig;
  totals: {
    executedGroupCount: number;
    successfulGroupCount: number;
    failedGroupCount: number;
    skippedGroupCount: number;
    documentCount: number;
  };
  sourceGroups: SupportSyncSourceGroupRunResult[];
  staleReport: SupportSyncStalenessReport;
  state: SupportSyncState;
}

export interface RunScheduledSupportSyncInput {
  repoRoot: string;
  scheduleConfig?: unknown;
  previousState?: unknown;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  handlers?: Partial<SupportSyncHandlerMap>;
}

export function createDefaultSupportSyncHandlers(repoRoot: string): SupportSyncHandlerMap {
  return {
    repo: async () => new RepoIngester({ repoRoot }).ingest(),
    docs: async () => new DocsSiteIngester({ excludedPaths: DOCS_EXCLUDED_PATHS }).ingest(),
    website_high_churn: async () => new WebsiteIngester({
      targetPaths: WEBSITE_HIGH_CHURN_TARGET_PATHS,
      maxPages: WEBSITE_HIGH_CHURN_TARGET_PATHS.length
    }).ingest(),
    website_daily: async () => {
      const [homePages, supportPages] = await Promise.all([
        new WebsiteIngester({
          targetPaths: WEBSITE_HOME_TARGET_PATHS,
          maxPages: WEBSITE_HOME_TARGET_PATHS.length
        }).ingest(),
        new WebsiteIngester({
          targetPaths: WEBSITE_DAILY_TARGET_PATHS,
          maxPages: WEBSITE_DAILY_TARGET_PATHS.length
        }).ingest()
      ])

      return [...homePages, ...supportPages]
    },
    github: async () => new GitHubIngester().ingest()
  }
}

export async function runScheduledSupportSync(input: RunScheduledSupportSyncInput): Promise<SupportSyncRunOutput> {
  const now = input.now ?? (() => new Date())
  const sleep = input.sleep ?? defaultSleep
  const schedule = parseSupportSyncScheduleConfig(input.scheduleConfig)
  let state = parseSupportSyncState(input.previousState)
  const handlers = {
    ...createDefaultSupportSyncHandlers(input.repoRoot),
    ...input.handlers
  }
  const runStartedAt = now()
  const sourceGroups: SupportSyncSourceGroupRunResult[] = []

  for (const group of schedule.sourceGroups) {
    const lastSuccessfulAtBeforeRun = state.lastSuccessfulRunByGroup[group.id]
    const parsedLastSuccessfulAt = lastSuccessfulAtBeforeRun ? new Date(lastSuccessfulAtBeforeRun) : undefined

    if (!isSupportSyncSourceGroupDue(group, parsedLastSuccessfulAt, runStartedAt)) {
      sourceGroups.push({
        id: group.id,
        label: group.label,
        cadenceHours: group.cadenceHours,
        staleAfterHours: group.staleAfterHours,
        status: 'skipped_not_due',
        attempts: [],
        documentCount: 0,
        lastSuccessfulAtBeforeRun,
        lastSuccessfulAtAfterRun: lastSuccessfulAtBeforeRun,
        nextDueAt: parsedLastSuccessfulAt ? getSupportSyncNextDueAt(group, parsedLastSuccessfulAt).toISOString() : undefined
      })
      continue
    }

    const handler = handlers[group.id]

    if (!handler) {
      throw new Error(`Missing support sync handler for ${group.id}`)
    }

    const attempts: SupportSyncAttemptResult[] = []
    let finalStatus: SupportSyncSourceGroupRunResult['status'] = 'failed'
    let documentCount = 0

    for (let attempt = 1; attempt <= schedule.retry.maxAttempts; attempt += 1) {
      const attemptStartedAt = now()

      try {
        const documents = await handler()
        const attemptCompletedAt = now()

        documentCount = documents.length
        attempts.push({
          attempt,
          status: 'succeeded',
          startedAt: attemptStartedAt.toISOString(),
          completedAt: attemptCompletedAt.toISOString(),
          durationMs: attemptCompletedAt.getTime() - attemptStartedAt.getTime(),
          documentCount
        })
        state = recordSupportSyncSuccess(state, group.id, attemptCompletedAt)
        finalStatus = 'succeeded'
        break
      } catch (error) {
        const attemptCompletedAt = now()
        attempts.push({
          attempt,
          status: 'failed',
          startedAt: attemptStartedAt.toISOString(),
          completedAt: attemptCompletedAt.toISOString(),
          durationMs: attemptCompletedAt.getTime() - attemptStartedAt.getTime(),
          documentCount: 0,
          error: error instanceof Error ? error.message : String(error)
        })

        if (attempt < schedule.retry.maxAttempts) {
          await sleep(schedule.retry.baseDelayMs * 2 ** (attempt - 1))
        }
      }
    }

    const lastSuccessfulAtAfterRun = state.lastSuccessfulRunByGroup[group.id] ?? lastSuccessfulAtBeforeRun
    const parsedLastSuccessfulAtAfterRun = lastSuccessfulAtAfterRun ? new Date(lastSuccessfulAtAfterRun) : undefined

    sourceGroups.push({
      id: group.id,
      label: group.label,
      cadenceHours: group.cadenceHours,
      staleAfterHours: group.staleAfterHours,
      status: finalStatus,
      attempts,
      documentCount,
      lastSuccessfulAtBeforeRun,
      lastSuccessfulAtAfterRun,
      nextDueAt: parsedLastSuccessfulAtAfterRun
        ? getSupportSyncNextDueAt(group, parsedLastSuccessfulAtAfterRun).toISOString()
        : undefined
    })
  }

  const completedAt = now()

  state = {
    ...state,
    updatedAt: completedAt.toISOString()
  }

  const staleReport = evaluateSupportSyncStaleness(schedule, state, completedAt)
  const totals = sourceGroups.reduce(
    (summary, group) => ({
      executedGroupCount: summary.executedGroupCount + (group.status === 'skipped_not_due' ? 0 : 1),
      successfulGroupCount: summary.successfulGroupCount + (group.status === 'succeeded' ? 1 : 0),
      failedGroupCount: summary.failedGroupCount + (group.status === 'failed' ? 1 : 0),
      skippedGroupCount: summary.skippedGroupCount + (group.status === 'skipped_not_due' ? 1 : 0),
      documentCount: summary.documentCount + group.documentCount
    }),
    {
      executedGroupCount: 0,
      successfulGroupCount: 0,
      failedGroupCount: 0,
      skippedGroupCount: 0,
      documentCount: 0
    }
  )

  return {
    version: 1,
    status: totals.failedGroupCount > 0 ? 'failed' : 'completed',
    startedAt: runStartedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    schedule,
    totals,
    sourceGroups,
    staleReport,
    state
  }
}

export function renderSupportSyncRunMarkdown(output: SupportSyncRunOutput): string {
  const lines = [
    '# Bruno Support Sync Summary',
    '',
    `- Status: ${output.status}`,
    `- Started: ${output.startedAt}`,
    `- Completed: ${output.completedAt}`,
    `- Executed groups: ${output.totals.executedGroupCount}`,
    `- Failed groups: ${output.totals.failedGroupCount}`,
    `- Skipped groups: ${output.totals.skippedGroupCount}`,
    `- Documents produced: ${output.totals.documentCount}`,
    `- Staleness status: ${output.staleReport.status}`,
    '',
    '## Source Groups',
    '',
    '| Group | Status | Attempts | Documents | Last Successful | Next Due |',
    '| --- | --- | ---: | ---: | --- | --- |'
  ]

  output.sourceGroups.forEach((group) => {
    lines.push(
      `| ${group.label} | ${formatSourceGroupStatus(group.status)} | ${group.attempts.length} | ${group.documentCount} | ${group.lastSuccessfulAtAfterRun ?? 'never'} | ${group.nextDueAt ?? 'due now'} |`
    )
  })

  const failedAttempts = output.sourceGroups.flatMap((group) =>
    group.attempts
      .filter((attempt) => attempt.status === 'failed')
      .map((attempt) => `- ${group.label} attempt ${attempt.attempt}: ${attempt.error ?? 'unknown error'}`)
  )

  if (failedAttempts.length > 0) {
    lines.push('', '## Failures', '', ...failedAttempts)
  }

  const staleGroups = output.staleReport.groups.filter((group) => group.status !== 'fresh')

  if (staleGroups.length > 0) {
    lines.push('', '## Stale Groups', '')
    lines.push(
      ...staleGroups.map((group) =>
        `- ${group.label}: ${group.status === 'never_synced' ? 'never synced' : `last success ${group.lastSuccessfulAt} (${group.ageHours}h ago)`}`
      )
    )
  }

  return lines.join('\n')
}

function formatSourceGroupStatus(status: SupportSyncSourceGroupRunResult['status']): string {
  if (status === 'skipped_not_due') {
    return 'skipped (not due)'
  }

  return status
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}