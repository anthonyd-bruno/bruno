#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const {
  DEFAULT_LOCAL_PROVIDER,
  formatRepoRootDotEnvResult,
  getOllamaEmbeddingProviderConfig,
  getRepoRootDotEnvHelpLines,
  loadRepoRootDotEnv,
  getOpenAIEmbeddingProviderConfig,
  requireOpenAIApiKey,
  resolveLocalProvider
} = require('./local-provider-config')

const DEFAULT_LOCAL_OLLAMA_EMBEDDING_BATCH_SIZE = 8
const DEFAULT_LOCAL_OLLAMA_MAX_CHUNK_SIZE = 800

function loadSupportIndexerPackage() {
  try {
    return require(path.resolve(__dirname, '../../packages/bruno-support-indexer/dist/cjs/index.js'))
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      throw new Error('Build packages/bruno-support-indexer before running the support sync script.')
    }

    throw error
  }
}

function printUsage() {
  console.log(
    [
      'Usage: node scripts/support-bot/run-support-bot-sync.js [options]',
      '',
      'Options:',
      '  --index-output <path>   Optional local retrieval index JSON path',
      '  --output <path>         Optional JSON output path (default: artifacts/support-bot-sync-report.json)',
      '  --state-file <path>     Optional sync state JSON path (default: artifacts/support-bot-sync-state.json)',
      '  --schedule-file <path>  Optional JSON file with schedule overrides',
      '  --schedule-json <json>  Optional inline JSON schedule overrides',
      '  --skip-github          Local-only: exclude GitHub ingest from the sync report and local index build',
      `  --provider <provider>   Local index provider: openai or ollama (default: SUPPORT_BOT_LOCAL_PROVIDER or ${DEFAULT_LOCAL_PROVIDER})`,
      '  --repo-root <path>      Repo root used by repo ingester (default: current working directory)',
      '  --help                  Show this help text',
      '',
      'By default this script remains strict: a failed or stale GitHub sync still exits non-zero unless you explicitly pass --skip-github for local smoke testing.',
      `Local Ollama index builds use smaller chunks (${DEFAULT_LOCAL_OLLAMA_MAX_CHUNK_SIZE} chars before overlap, about 1000 effective chars with default overlap) plus a smaller embedding batch size (${DEFAULT_LOCAL_OLLAMA_EMBEDDING_BATCH_SIZE}); multi-input context-length 400s still retry-split down to single inputs.`,
      '',
      ...getRepoRootDotEnvHelpLines()
    ].join('\n')
  )
}

function parseArgs(argv) {
  const options = {
    indexOutput: '',
    output: 'artifacts/support-bot-sync-report.json',
    stateFile: 'artifacts/support-bot-sync-state.json',
    scheduleFile: '',
    scheduleJson: '',
    skipGithub: false,
    provider: '',
    repoRoot: process.cwd()
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '--help') {
      options.help = true
      continue
    }

    if (token === '--skip-github') {
      options.skipGithub = true
      continue
    }

    const value = argv[index + 1]

    if (!value) {
      throw new Error(`Missing value for ${token}`)
    }

    if (token === '--output') {
      options.output = value
    } else if (token === '--index-output') {
      options.indexOutput = value
    } else if (token === '--state-file') {
      options.stateFile = value
    } else if (token === '--schedule-file') {
      options.scheduleFile = value
    } else if (token === '--schedule-json') {
      options.scheduleJson = value
    } else if (token === '--provider') {
      options.provider = value
    } else if (token === '--repo-root') {
      options.repoRoot = value
    } else {
      throw new Error(`Unknown option: ${token}`)
    }

    index += 1
  }

  return options
}

function applyLocalGithubSkipToScheduleOverrides(scheduleOverrides, skipGithub) {
  if (!skipGithub) {
    return scheduleOverrides
  }

  return {
    ...scheduleOverrides,
    sourceGroups: {
      ...(scheduleOverrides.sourceGroups ?? {}),
      github: {
        ...(scheduleOverrides.sourceGroups?.github ?? {}),
        enabled: false
      }
    }
  }
}

async function collectDocumentsForLocalIndex(supportIndexer, repoRoot, options = {}) {
  const handlers = supportIndexer.createDefaultSupportSyncHandlers(repoRoot)
  const sourceGroups = []
  const documents = []

  for (const [groupId, handler] of Object.entries(handlers)) {
    if (options.skipGithub && groupId === 'github') {
      continue
    }

    const groupDocuments = await handler()

    sourceGroups.push({
      id: groupId,
      documentCount: groupDocuments.length
    })
    documents.push(...groupDocuments)
  }

  return { documents, sourceGroups }
}

function toIndexedChunk(chunk, document) {
  return {
    ...chunk,
    metadata: {
      ...chunk.metadata,
      title: document.title,
      document_title: document.title,
      url: document.url,
      canonical_url: document.url,
      sourcePath: document.sourcePath,
      source_path: document.sourcePath
    },
    sourceType: document.sourceType,
    trustTier: document.trustTier,
    lastModified: document.lastModified
  }
}

function createEmbeddingProvider(supportIndexer, provider) {
  if (provider === 'openai') {
    requireOpenAIApiKey(provider, 'to build a local support retrieval index')

    return new supportIndexer.OpenAIEmbeddingProvider(getOpenAIEmbeddingProviderConfig())
  }

  return new supportIndexer.OllamaEmbeddingProvider(getOllamaEmbeddingProviderConfig())
}

function getLocalIndexEmbeddingBatchSize(provider) {
  return provider === 'ollama' ? DEFAULT_LOCAL_OLLAMA_EMBEDDING_BATCH_SIZE : undefined
}

function getLocalIndexChunkerConfig(provider) {
  if (provider !== 'ollama') {
    return undefined
  }

  return {
    // DocumentChunker prepends the default 200-char overlap to later chunks, so an 800-char
    // base chunk size keeps local Ollama embedding inputs around ~1000 chars instead of the
    // default path's ~1700-char effective ceiling.
    maxChunkSize: DEFAULT_LOCAL_OLLAMA_MAX_CHUNK_SIZE
  }
}

async function buildLocalIndexSnapshot(supportIndexer, repoRoot, provider, options = {}) {
  const { documents, sourceGroups } = await collectDocumentsForLocalIndex(supportIndexer, repoRoot, options)
  const chunker = new supportIndexer.DocumentChunker(getLocalIndexChunkerConfig(provider))
  const documentsById = new Map(documents.map((document) => [document.id, document]))
  const rawChunks = chunker.chunkMany(documents)
  const indexedChunks = rawChunks.map((chunk) => {
    const document = documentsById.get(chunk.documentId)

    if (!document) {
      throw new Error(`Missing source document for chunk ${chunk.id} (${chunk.documentId})`)
    }

    return toIndexedChunk(chunk, document)
  })
  const embeddingProvider = createEmbeddingProvider(supportIndexer, provider)
  const embeddingBatchSize = getLocalIndexEmbeddingBatchSize(provider)
  const pipeline = new supportIndexer.EmbeddingPipeline({
    provider: embeddingProvider,
    ...(embeddingBatchSize ? { batchSize: embeddingBatchSize } : {})
  })
  const embeddedChunks = await pipeline.embed(indexedChunks)

  if (embeddedChunks.length !== indexedChunks.length) {
    throw new Error(`Expected ${indexedChunks.length} embedded chunks but received ${embeddedChunks.length}.`)
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceDocumentCount: documents.length,
    chunkCount: embeddedChunks.length,
    embeddingProvider: provider,
    embeddingModel: embeddingProvider.modelName,
    embeddingDimensions: embeddingProvider.dimensions,
    sourceGroups,
    documentsById: Object.fromEntries(
      documents.map((document) => [
        document.id,
        {
          title: document.title,
          url: document.url,
          sourcePath: document.sourcePath
        }
      ])
    ),
    chunks: embeddedChunks.map((chunk) => ({
      ...chunk,
      lastModified: chunk.lastModified.toISOString()
    }))
  }
}

function readJsonFile(filePath, label, options = {}) {
  const absolutePath = path.resolve(process.cwd(), filePath)

  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  } catch (error) {
    if (options.allowMissing && error && error.code === 'ENOENT') {
      return undefined
    }

    throw new Error(`Unable to read ${label} JSON from ${absolutePath}: ${error.message}`)
  }
}

function writeJsonFile(filePath, value, label) {
  const absolutePath = path.resolve(process.cwd(), filePath)

  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  console.log(`Wrote ${label} to ${absolutePath}`)
}

function appendGithubStepSummary(markdown) {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    return
  }

  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, 'utf8')
}

async function main() {
  const dotenvResult = loadRepoRootDotEnv()
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  const supportIndexer = loadSupportIndexerPackage()
  const previousState = readJsonFile(options.stateFile, 'support sync state', { allowMissing: true })
  let scheduleOverrides = {}

  if (options.scheduleFile) {
    scheduleOverrides = readJsonFile(options.scheduleFile, 'support sync schedule overrides')
  }

  if (options.scheduleJson) {
    try {
      scheduleOverrides = {
        ...scheduleOverrides,
        ...JSON.parse(options.scheduleJson)
      }
    } catch (error) {
      throw new Error(`Unable to parse --schedule-json: ${error.message}`)
    }
  }

  scheduleOverrides = applyLocalGithubSkipToScheduleOverrides(scheduleOverrides, options.skipGithub)

  const report = await supportIndexer.runScheduledSupportSync({
    repoRoot: path.resolve(process.cwd(), options.repoRoot),
    scheduleConfig: scheduleOverrides,
    previousState
  })
  const markdown = supportIndexer.renderSupportSyncRunMarkdown(report)

  console.log(formatRepoRootDotEnvResult(dotenvResult))

  if (options.skipGithub) {
    console.log('Local-only mode: skipping GitHub ingest for this sync run and local index build.')
  }

  console.log(markdown)
  appendGithubStepSummary(markdown)
  writeJsonFile(options.output, report, 'support sync report')
  writeJsonFile(options.stateFile, report.state, 'support sync state')

  if (options.indexOutput) {
    const snapshot = await buildLocalIndexSnapshot(
      supportIndexer,
      path.resolve(process.cwd(), options.repoRoot),
      resolveLocalProvider(options.provider),
      { skipGithub: options.skipGithub }
    )

    writeJsonFile(options.indexOutput, snapshot, 'support-bot local index')
  }

  if (report.status === 'failed' || report.staleReport.status === 'stale') {
    process.exitCode = 1
  }
}

module.exports = {
  applyLocalGithubSkipToScheduleOverrides,
  buildLocalIndexSnapshot,
  collectDocumentsForLocalIndex,
  getLocalIndexChunkerConfig,
  getLocalIndexEmbeddingBatchSize,
  parseArgs
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}