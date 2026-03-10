import { z } from 'zod'

export const supportSyncSourceGroupIds = [
  'repo',
  'docs',
  'website_high_churn',
  'website_daily',
  'github'
] as const

export type SupportSyncSourceGroupId = (typeof supportSyncSourceGroupIds)[number]

export interface SupportSyncSourceGroupSchedule {
  id: SupportSyncSourceGroupId;
  label: string;
  cadenceHours: number;
  staleAfterHours: number;
}

export interface SupportSyncRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
}

export interface SupportSyncScheduleConfig {
  sourceGroups: SupportSyncSourceGroupSchedule[];
  retry: SupportSyncRetryPolicy;
}

const positiveNumberSchema = z.number().finite().positive()
const nonNegativeIntegerSchema = z.number().int().nonnegative()

const sourceGroupOverrideSchema = z.object({
  enabled: z.boolean().optional(),
  cadenceHours: positiveNumberSchema.optional(),
  staleAfterHours: positiveNumberSchema.optional()
})

const scheduleOverrideSchema = z.object({
  retry: z.object({
    maxAttempts: z.number().int().positive().optional(),
    baseDelayMs: nonNegativeIntegerSchema.optional()
  }).optional(),
  sourceGroups: z.object({
    repo: sourceGroupOverrideSchema.optional(),
    docs: sourceGroupOverrideSchema.optional(),
    website_high_churn: sourceGroupOverrideSchema.optional(),
    website_daily: sourceGroupOverrideSchema.optional(),
    github: sourceGroupOverrideSchema.optional()
  }).optional()
}).strict()

const DEFAULT_SOURCE_GROUPS: SupportSyncSourceGroupSchedule[] = [
  {
    id: 'repo',
    label: 'Repo docs/content',
    cadenceHours: 24,
    staleAfterHours: 36
  },
  {
    id: 'docs',
    label: 'Docs site',
    cadenceHours: 24,
    staleAfterHours: 36
  },
  {
    id: 'website_high_churn',
    label: 'Website changelog/downloads/pricing',
    cadenceHours: 4,
    staleAfterHours: 8
  },
  {
    id: 'website_daily',
    label: 'Website core/support pages',
    cadenceHours: 24,
    staleAfterHours: 36
  },
  {
    id: 'github',
    label: 'GitHub releases/issues/discussions',
    cadenceHours: 24,
    staleAfterHours: 36
  }
]

export const DEFAULT_SUPPORT_SYNC_RETRY_POLICY: SupportSyncRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250
}

export const DEFAULT_SUPPORT_SYNC_SCHEDULE_CONFIG: SupportSyncScheduleConfig = {
  sourceGroups: DEFAULT_SOURCE_GROUPS,
  retry: DEFAULT_SUPPORT_SYNC_RETRY_POLICY
}

export function parseSupportSyncScheduleConfig(input: unknown = {}): SupportSyncScheduleConfig {
  const overrides = scheduleOverrideSchema.parse(input)

  return {
    sourceGroups: DEFAULT_SOURCE_GROUPS.flatMap((group) => {
      const groupOverride = overrides.sourceGroups?.[group.id]

      if (groupOverride?.enabled === false) {
        return []
      }

      return [{
        ...group,
        cadenceHours: groupOverride?.cadenceHours ?? group.cadenceHours,
        staleAfterHours: groupOverride?.staleAfterHours ?? group.staleAfterHours
      }]
    }),
    retry: {
      maxAttempts: overrides.retry?.maxAttempts ?? DEFAULT_SUPPORT_SYNC_RETRY_POLICY.maxAttempts,
      baseDelayMs: overrides.retry?.baseDelayMs ?? DEFAULT_SUPPORT_SYNC_RETRY_POLICY.baseDelayMs
    }
  }
}

export function getSupportSyncSourceGroupSchedule(
  config: SupportSyncScheduleConfig,
  groupId: SupportSyncSourceGroupId
): SupportSyncSourceGroupSchedule {
  const group = config.sourceGroups.find((candidate) => candidate.id === groupId)

  if (!group) {
    throw new Error(`Unknown support sync source group: ${groupId}`)
  }

  return group
}

export function getSupportSyncNextDueAt(
  group: Pick<SupportSyncSourceGroupSchedule, 'cadenceHours'>,
  lastSuccessfulAt: Date
): Date {
  return new Date(lastSuccessfulAt.getTime() + group.cadenceHours * 60 * 60 * 1000)
}

export function isSupportSyncSourceGroupDue(
  group: Pick<SupportSyncSourceGroupSchedule, 'cadenceHours'>,
  lastSuccessfulAt: Date | undefined,
  now: Date
): boolean {
  if (!lastSuccessfulAt) {
    return true
  }

  return getSupportSyncNextDueAt(group, lastSuccessfulAt).getTime() <= now.getTime()
}