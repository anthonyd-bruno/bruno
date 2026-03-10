import { describe, expect, it } from '@jest/globals'

import {
  getSupportSyncNextDueAt,
  isSupportSyncSourceGroupDue,
  parseSupportSyncScheduleConfig
} from '../cadence'

describe('support sync cadence config', () => {
  it('returns the default source-group cadence schedule', () => {
    const config = parseSupportSyncScheduleConfig()

    expect(config.retry).toEqual({
      maxAttempts: 3,
      baseDelayMs: 250
    })
    expect(config.sourceGroups).toEqual([
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
    ])
  })

  it('merges cadence overrides and allows groups to be disabled', () => {
    const config = parseSupportSyncScheduleConfig({
      retry: {
        maxAttempts: 2,
        baseDelayMs: 1000
      },
      sourceGroups: {
        website_high_churn: {
          cadenceHours: 6,
          staleAfterHours: 12
        },
        website_daily: {
          enabled: false
        }
      }
    })

    expect(config.retry).toEqual({
      maxAttempts: 2,
      baseDelayMs: 1000
    })
    expect(config.sourceGroups.map((group) => group.id)).toEqual([
      'repo',
      'docs',
      'website_high_churn',
      'github'
    ])
    expect(config.sourceGroups.find((group) => group.id === 'website_high_churn')).toMatchObject({
      cadenceHours: 6,
      staleAfterHours: 12
    })
  })

  it('computes due times from the last successful sync timestamp', () => {
    const [repoGroup] = parseSupportSyncScheduleConfig().sourceGroups
    const lastSuccessfulAt = new Date('2026-03-09T00:00:00.000Z')

    expect(getSupportSyncNextDueAt(repoGroup, lastSuccessfulAt).toISOString()).toBe('2026-03-10T00:00:00.000Z')
    expect(isSupportSyncSourceGroupDue(repoGroup, lastSuccessfulAt, new Date('2026-03-09T23:59:59.000Z'))).toBe(false)
    expect(isSupportSyncSourceGroupDue(repoGroup, lastSuccessfulAt, new Date('2026-03-10T00:00:00.000Z'))).toBe(true)
    expect(isSupportSyncSourceGroupDue(repoGroup, undefined, new Date('2026-03-09T01:00:00.000Z'))).toBe(true)
  })
})