const {
  applyLocalGithubSkipToScheduleOverrides,
  collectDocumentsForLocalIndex,
  parseArgs: parseSyncArgs
} = require('../run-support-bot-sync')
const { createSyncArgs, parseArgs: parseStartArgs } = require('../start-local-support-bot')

describe('run-support-bot-sync local GitHub mode', () => {
  it('parses --skip-github and disables github in schedule overrides', () => {
    const options = parseSyncArgs(['--skip-github'])

    expect(options.skipGithub).toBe(true)
    expect(
      applyLocalGithubSkipToScheduleOverrides(
        { sourceGroups: { repo: { cadenceHours: 12 } } },
        options.skipGithub
      )
    ).toEqual({
      sourceGroups: {
        repo: { cadenceHours: 12 },
        github: { enabled: false }
      }
    })
  })

  it('skips github when collecting local index documents', async () => {
    const repoHandler = jest.fn(async () => [{ id: 'repo-doc-1' }])
    const githubHandler = jest.fn(async () => [{ id: 'gh-doc-1' }])
    const supportIndexer = {
      createDefaultSupportSyncHandlers: jest.fn(() => ({
        repo: repoHandler,
        github: githubHandler
      }))
    }

    const result = await collectDocumentsForLocalIndex(supportIndexer, '/tmp/repo', {
      skipGithub: true
    })

    expect(supportIndexer.createDefaultSupportSyncHandlers).toHaveBeenCalledWith('/tmp/repo')
    expect(repoHandler).toHaveBeenCalledTimes(1)
    expect(githubHandler).not.toHaveBeenCalled()
    expect(result).toEqual({
      documents: [{ id: 'repo-doc-1' }],
      sourceGroups: [{ id: 'repo', documentCount: 1 }]
    })
  })
})

describe('start-local-support-bot local GitHub mode', () => {
  it('skips github by default for the local wrapper', () => {
    const syncArgs = createSyncArgs(parseStartArgs([]))

    expect(syncArgs).toContain('--skip-github')
  })

  it('allows explicitly re-enabling github for the local wrapper', () => {
    const syncArgs = createSyncArgs(parseStartArgs(['--include-github']))

    expect(syncArgs).not.toContain('--skip-github')
  })
})