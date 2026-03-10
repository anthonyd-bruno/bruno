import { describe, expect, it } from '@jest/globals'

import { parseSupportSyncScheduleConfig } from '../cadence'
import { evaluateSupportSyncStaleness, parseSupportSyncState } from '../staleness'

describe('support sync staleness', () => {
  it('parses an empty state file safely', () => {
    expect(parseSupportSyncState()).toEqual({
      version: 1,
      lastSuccessfulRunByGroup: {}
    })
  })

  it('flags stale and never-synced groups explicitly', () => {
    const config = parseSupportSyncScheduleConfig({
      sourceGroups: {
        website_daily: { enabled: false }
      }
    })
    const report = evaluateSupportSyncStaleness(
      config,
      parseSupportSyncState({
        lastSuccessfulRunByGroup: {
          repo: '2026-03-08T22:00:00.000Z',
          docs: '2026-03-07T00:00:00.000Z',
          website_high_churn: '2026-03-09T08:00:00.000Z'
        }
      }),
      new Date('2026-03-09T12:00:00.000Z')
    )

    expect(report.status).toBe('stale')
    expect(report.staleGroupIds).toEqual(['docs', 'github'])
    expect(report.groups).toEqual([
      expect.objectContaining({ id: 'repo', status: 'fresh', ageHours: 14 }),
      expect.objectContaining({ id: 'docs', status: 'stale', ageHours: 60 }),
      expect.objectContaining({ id: 'website_high_churn', status: 'fresh', ageHours: 4 }),
      expect.objectContaining({ id: 'github', status: 'never_synced' })
    ])
  })
})