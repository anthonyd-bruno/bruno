import { z } from 'zod'

import type { SupportSyncScheduleConfig, SupportSyncSourceGroupId } from './cadence'

export interface SupportSyncState {
  version: 1;
  updatedAt?: string;
  lastSuccessfulRunByGroup: Partial<Record<SupportSyncSourceGroupId, string>>;
}

export interface SupportSyncGroupFreshness {
  id: SupportSyncSourceGroupId;
  label: string;
  cadenceHours: number;
  staleAfterHours: number;
  status: 'fresh' | 'stale' | 'never_synced';
  lastSuccessfulAt?: string;
  ageHours?: number;
}

export interface SupportSyncStalenessReport {
  checkedAt: string;
  status: 'ok' | 'stale';
  staleGroupIds: SupportSyncSourceGroupId[];
  groups: SupportSyncGroupFreshness[];
}

const isoDateTimeSchema = z.string().datetime()

const supportSyncStateSchema = z.object({
  version: z.literal(1).default(1),
  updatedAt: isoDateTimeSchema.optional(),
  lastSuccessfulRunByGroup: z.object({
    repo: isoDateTimeSchema.optional(),
    docs: isoDateTimeSchema.optional(),
    website_high_churn: isoDateTimeSchema.optional(),
    website_daily: isoDateTimeSchema.optional(),
    github: isoDateTimeSchema.optional()
  }).default({})
}).strict()

export function parseSupportSyncState(input: unknown = {}): SupportSyncState {
  return supportSyncStateSchema.parse(input)
}

export function recordSupportSyncSuccess(
  state: SupportSyncState,
  groupId: SupportSyncSourceGroupId,
  completedAt: Date
): SupportSyncState {
  return {
    ...state,
    updatedAt: completedAt.toISOString(),
    lastSuccessfulRunByGroup: {
      ...state.lastSuccessfulRunByGroup,
      [groupId]: completedAt.toISOString()
    }
  }
}

export function evaluateSupportSyncStaleness(
  config: SupportSyncScheduleConfig,
  state: SupportSyncState,
  now: Date
): SupportSyncStalenessReport {
  const groups = config.sourceGroups.map((group) => {
    const lastSuccessfulAt = state.lastSuccessfulRunByGroup[group.id]

    if (!lastSuccessfulAt) {
      return {
        id: group.id,
        label: group.label,
        cadenceHours: group.cadenceHours,
        staleAfterHours: group.staleAfterHours,
        status: 'never_synced' as const
      }
    }

    const ageHours = (now.getTime() - new Date(lastSuccessfulAt).getTime()) / (60 * 60 * 1000)

    return {
      id: group.id,
      label: group.label,
      cadenceHours: group.cadenceHours,
      staleAfterHours: group.staleAfterHours,
      status: ageHours >= group.staleAfterHours ? 'stale' as const : 'fresh' as const,
      lastSuccessfulAt,
      ageHours: Number(ageHours.toFixed(2))
    }
  })

  const staleGroupIds = groups
    .filter((group) => group.status !== 'fresh')
    .map((group) => group.id)

  return {
    checkedAt: now.toISOString(),
    status: staleGroupIds.length > 0 ? 'stale' : 'ok',
    staleGroupIds,
    groups
  }
}