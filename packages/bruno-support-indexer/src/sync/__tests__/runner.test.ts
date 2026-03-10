import { describe, expect, it, jest } from '@jest/globals'

import { runScheduledSupportSync } from '../runner'

function createNowSequence(startIso: string, stepMs = 1000): () => Date {
  let index = 0
  const start = new Date(startIso).getTime()

  return () => new Date(start + stepMs * index++)
}

describe('runScheduledSupportSync', () => {
  it('retries failures, records attempts, and updates state after a later success', async () => {
    const sleep = jest.fn(async () => undefined)
    const repoHandler = jest.fn<() => Promise<never | { id: string }[]>>()

    repoHandler
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockResolvedValueOnce([{ id: 'repo-doc-1' } as never])

    const report = await runScheduledSupportSync({
      repoRoot: '/tmp/repo',
      now: createNowSequence('2026-03-09T00:00:00.000Z'),
      sleep,
      scheduleConfig: {
        retry: { maxAttempts: 3, baseDelayMs: 25 },
        sourceGroups: {
          docs: { enabled: false },
          website_high_churn: { enabled: false },
          website_daily: { enabled: false },
          github: { enabled: false }
        }
      },
      handlers: {
        repo: repoHandler as never
      }
    })

    expect(repoHandler).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(25)
    expect(report.status).toBe('completed')
    expect(report.totals).toMatchObject({
      executedGroupCount: 1,
      successfulGroupCount: 1,
      failedGroupCount: 0,
      skippedGroupCount: 0,
      documentCount: 1
    })
    expect(report.sourceGroups).toEqual([
      expect.objectContaining({
        id: 'repo',
        status: 'succeeded',
        documentCount: 1,
        attempts: [
          expect.objectContaining({ attempt: 1, status: 'failed', error: 'temporary outage' }),
          expect.objectContaining({ attempt: 2, status: 'succeeded', documentCount: 1 })
        ]
      })
    ])
    expect(report.state.lastSuccessfulRunByGroup.repo).toBeDefined()
    expect(report.staleReport.status).toBe('ok')
  })

  it('marks a group stale when retries are exhausted and the previous success is too old', async () => {
    const report = await runScheduledSupportSync({
      repoRoot: '/tmp/repo',
      now: createNowSequence('2026-03-09T12:00:00.000Z'),
      sleep: async () => undefined,
      previousState: {
        lastSuccessfulRunByGroup: {
          repo: '2026-03-07T00:00:00.000Z'
        }
      },
      scheduleConfig: {
        retry: { maxAttempts: 2, baseDelayMs: 10 },
        sourceGroups: {
          docs: { enabled: false },
          website_high_churn: { enabled: false },
          website_daily: { enabled: false },
          github: { enabled: false }
        }
      },
      handlers: {
        repo: async () => {
          throw new Error('still failing')
        }
      }
    })

    expect(report.status).toBe('failed')
    expect(report.sourceGroups[0]).toMatchObject({
      id: 'repo',
      status: 'failed',
      attempts: [
        expect.objectContaining({ attempt: 1, status: 'failed', error: 'still failing' }),
        expect.objectContaining({ attempt: 2, status: 'failed', error: 'still failing' })
      ],
      lastSuccessfulAtBeforeRun: '2026-03-07T00:00:00.000Z',
      lastSuccessfulAtAfterRun: '2026-03-07T00:00:00.000Z'
    })
    expect(report.staleReport.status).toBe('stale')
    expect(report.staleReport.staleGroupIds).toEqual(['repo'])
  })

  it('skips groups that are not yet due based on the cached success timestamp', async () => {
    const repoHandler = jest.fn(async () => [{ id: 'repo-doc-1' } as never])
    const report = await runScheduledSupportSync({
      repoRoot: '/tmp/repo',
      now: createNowSequence('2026-03-09T06:00:00.000Z'),
      previousState: {
        lastSuccessfulRunByGroup: {
          repo: '2026-03-09T02:00:00.000Z'
        }
      },
      scheduleConfig: {
        sourceGroups: {
          repo: { cadenceHours: 24, staleAfterHours: 36 },
          docs: { enabled: false },
          website_high_churn: { enabled: false },
          website_daily: { enabled: false },
          github: { enabled: false }
        }
      },
      handlers: {
        repo: repoHandler as never
      }
    })

    expect(repoHandler).not.toHaveBeenCalled()
    expect(report.status).toBe('completed')
    expect(report.sourceGroups).toEqual([
      expect.objectContaining({
        id: 'repo',
        status: 'skipped_not_due',
        attempts: [],
        documentCount: 0,
        lastSuccessfulAtAfterRun: '2026-03-09T02:00:00.000Z'
      })
    ])
  })
})