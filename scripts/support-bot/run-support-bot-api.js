#!/usr/bin/env node

const fs = require('fs')
const { createServer } = require('http')
const path = require('path')

const {
  DEFAULT_LOCAL_PROVIDER,
  REPO_ROOT_DOTENV_PATH,
  getOllamaAnswerGenerationConfig,
  getOllamaEmbeddingProviderConfig,
  getOpenAIAnswerGenerationConfig,
  getOpenAIEmbeddingProviderConfig,
  loadRepoRootDotEnv,
  requireOpenAIApiKey,
  resolveLocalProvider
} = require('./local-provider-config')

const PLAYGROUND_HTML_PATH = path.resolve(__dirname, 'support-bot-playground.html')
const DEFAULT_INDEX_FILE = 'artifacts/support-bot-local-index.json'

function loadPackage(packagePath, buildMessage) {
  try {
    return require(packagePath)
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      throw new Error(buildMessage)
    }

    throw error
  }
}

function loadSupportBotApiPackage() {
  return loadPackage(
    path.resolve(__dirname, '../../packages/bruno-support-bot-api/dist/cjs/index.js'),
    'Build packages/bruno-support-bot-api before running the local support-bot API launcher.'
  )
}

function loadSupportIndexerPackage() {
  return loadPackage(
    path.resolve(__dirname, '../../packages/bruno-support-indexer/dist/cjs/index.js'),
    'Build packages/bruno-support-indexer before running the local support-bot API launcher.'
  )
}

function loadSupportRetrievalPackage() {
  return loadPackage(
    path.resolve(__dirname, '../../packages/bruno-support-retrieval/dist/cjs/index.js'),
    'Build packages/bruno-support-retrieval before running the local support-bot API launcher.'
  )
}

function readPlaygroundHtml() {
  return fs.readFileSync(PLAYGROUND_HTML_PATH, 'utf8')
}

function printUsage() {
  console.log(
    [
      'Usage: node scripts/support-bot/run-support-bot-api.js [options]',
      '',
      'Options:',
      '  --host <host>           Bind host (default: 127.0.0.1)',
      '  --port <port>           Bind port (default: 8787)',
      `  --index-file <path>     Local support index JSON (default: ${DEFAULT_INDEX_FILE})`,
      `  --provider <provider>   Local provider: openai or ollama (default: SUPPORT_BOT_LOCAL_PROVIDER or ${DEFAULT_LOCAL_PROVIDER})`,
      '  --service-name <name>   Service name returned by /health (default: support-bot-api-local)',
      '  --help                  Show this help text',
      '',
      `Repo-root .env: auto-loaded from ${REPO_ROOT_DOTENV_PATH} when present.`,
      'Precedence: CLI flags override existing process env; existing process env overrides .env values.'
    ].join('\n')
  )
}

function parseArgs(argv) {
  const options = {
    host: '127.0.0.1',
    port: 8787,
    indexFile: DEFAULT_INDEX_FILE,
    provider: '',
    serviceName: 'support-bot-api-local'
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '--help') {
      options.help = true
      continue
    }

    const value = argv[index + 1]

    if (!value) {
      throw new Error(`Missing value for ${token}`)
    }

    if (token === '--host') {
      options.host = value
    } else if (token === '--port') {
      const parsedPort = Number.parseInt(value, 10)

      if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
        throw new Error(`Invalid --port value: ${value}`)
      }

      options.port = parsedPort
    } else if (token === '--index-file') {
      options.indexFile = value
    } else if (token === '--provider') {
      options.provider = value
    } else if (token === '--service-name') {
      options.serviceName = value
    } else {
      throw new Error(`Unknown option: ${token}`)
    }

    index += 1
  }

  return options
}

function parseIsoDate(value, label) {
  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error(`Invalid ISO date for ${label}: ${value}`)
  }

  return parsedDate
}

function loadLocalIndexSnapshot(indexFile) {
  const absolutePath = path.resolve(process.cwd(), indexFile)
  let snapshot

  try {
    snapshot = JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error(
        `Missing local support index at ${absolutePath}. Run node scripts/support-bot/run-support-bot-sync.js --index-output ${indexFile} first.`
      )
    }

    throw new Error(`Unable to read local support index from ${absolutePath}: ${error.message}`)
  }

  if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.chunks)) {
    throw new Error(`Invalid local support index at ${absolutePath}. Rebuild it with run-support-bot-sync.js --index-output.`)
  }

  const chunkEmbeddingDimensions = inferSnapshotEmbeddingDimensions(snapshot.chunks)

  if (Number.isInteger(snapshot.embeddingDimensions) && snapshot.embeddingDimensions !== chunkEmbeddingDimensions) {
    throw new Error(
      `Local support index at ${absolutePath} declares ${snapshot.embeddingDimensions} embedding dimensions, but chunk vectors are ${chunkEmbeddingDimensions}-dimensional.`
    )
  }

  return {
    absolutePath,
    generatedAt: typeof snapshot.generatedAt === 'string' ? snapshot.generatedAt : undefined,
    embeddingProvider: snapshot.embeddingProvider === 'ollama' ? 'ollama' : 'openai',
    embeddingModel: typeof snapshot.embeddingModel === 'string' ? snapshot.embeddingModel : undefined,
    embeddingDimensions: Number.isInteger(snapshot.embeddingDimensions) ? snapshot.embeddingDimensions : chunkEmbeddingDimensions,
    documentsById: snapshot.documentsById && typeof snapshot.documentsById === 'object' ? snapshot.documentsById : {},
    chunks: snapshot.chunks.map((chunk, index) => ({
      ...chunk,
      lastModified: parseIsoDate(chunk.lastModified, `chunks[${index}].lastModified`)
    }))
  }
}

function inferSnapshotEmbeddingDimensions(chunks) {
  const dimensions = [...new Set(chunks.map((chunk) => (Array.isArray(chunk.embedding) ? chunk.embedding.length : 0)))]

  if (dimensions.length !== 1 || dimensions[0] <= 0) {
    throw new Error('Local support index contains invalid or mixed embedding vector dimensions. Rebuild the index snapshot.')
  }

  return dimensions[0]
}

function createQueryEmbedder(supportIndexer, provider, snapshot) {
  if (provider === 'openai') {
    const config = getOpenAIEmbeddingProviderConfig()

    return new supportIndexer.OpenAIEmbeddingProvider({
      ...config,
      model: config.model ?? snapshot.embeddingModel,
      dimensions: config.dimensions ?? snapshot.embeddingDimensions
    })
  }

  const config = getOllamaEmbeddingProviderConfig()

  return new supportIndexer.OllamaEmbeddingProvider({
    ...config,
    model: config.model ?? snapshot.embeddingModel,
    dimensions: config.dimensions ?? snapshot.embeddingDimensions
  })
}

function assertSnapshotCompatibility(snapshot, provider, queryEmbedder) {
  if (snapshot.embeddingProvider !== provider) {
    throw new Error(
      `Local support index was built with ${snapshot.embeddingProvider} embeddings, but the launcher is using ${provider}. Rebuild the index or select the matching provider.`
    )
  }

  if (snapshot.embeddingModel && queryEmbedder.modelName !== snapshot.embeddingModel) {
    throw new Error(
      `Local support index was built with embedding model ${snapshot.embeddingModel}, but the launcher is configured for ${queryEmbedder.modelName}. Rebuild the index or align the embedding model.`
    )
  }

  if (snapshot.embeddingDimensions && queryEmbedder.dimensions && queryEmbedder.dimensions !== snapshot.embeddingDimensions) {
    throw new Error(
      `Local support index was built with ${snapshot.embeddingDimensions}-dimensional embeddings, but the launcher is configured for ${queryEmbedder.dimensions}-dimensional query embeddings.`
    )
  }
}

function assertQueryEmbeddingDimensions(snapshot, queryEmbedding) {
  if (snapshot.embeddingDimensions && queryEmbedding.length !== snapshot.embeddingDimensions) {
    throw new Error(
      `Query embedding returned ${queryEmbedding.length} dimensions, but the local support index expects ${snapshot.embeddingDimensions}. Rebuild the index or align the embedding model.`
    )
  }
}

function createRetriever({ supportIndexer, supportRetrieval, snapshot, provider }) {
  const index = new supportRetrieval.HybridIndex()
  const queryEmbedder = createQueryEmbedder(supportIndexer, provider, snapshot)

  assertSnapshotCompatibility(snapshot, provider, queryEmbedder)

  index.add(snapshot.chunks)

  return {
    retrieve: async ({ query, route }) => {
      const [queryEmbedding] = await queryEmbedder.embed([query])

      assertQueryEmbeddingDimensions(snapshot, queryEmbedding)

      const searchResults = index.search(query, queryEmbedding, route.search)
      const evidence = supportRetrieval.packEvidence(searchResults, {
        ...(route.evidence ?? {}),
        documentsById: snapshot.documentsById
      })
      const visibleSources = supportRetrieval.packEvidence(searchResults, {
        minEvidence: 1,
        maxEvidence: route.evidence?.maxEvidence,
        documentsById: snapshot.documentsById
      })

      return {
        evidence,
        sources: visibleSources.status === 'ready' ? visibleSources.evidence : []
      }
    }
  }
}

function createAnswerGenerator(supportBotApi, provider) {
  if (provider === 'openai') {
    return new supportBotApi.OpenAIAnswerGenerationAdapter(getOpenAIAnswerGenerationConfig())
  }

  return new supportBotApi.OllamaAnswerGenerationAdapter(getOllamaAnswerGenerationConfig())
}

function createDependencies(options, packages) {
  const provider = resolveLocalProvider(options.provider)

  requireOpenAIApiKey(provider, 'for real local support-bot retrieval and answer generation')

  const snapshot = loadLocalIndexSnapshot(options.indexFile)
  const answerGenerator = createAnswerGenerator(packages.supportBotApi, provider)

  return {
    retriever: createRetriever({
      supportIndexer: packages.supportIndexer,
      supportRetrieval: packages.supportRetrieval,
      snapshot,
      provider
    }),
    answerGenerator,
    localProvider: provider,
    serviceName: options.serviceName,
    modelVersion: () => {
      const parts = [`${provider}:${answerGenerator.modelName}`]

      if (snapshot.embeddingModel) {
        parts.push(`retrieval:${snapshot.embeddingProvider}:${snapshot.embeddingModel}:${snapshot.embeddingDimensions}`)
      }

      return parts.join(' | ')
    },
    localIndexPath: snapshot.absolutePath,
    localIndexGeneratedAt: snapshot.generatedAt
  }
}

function writeHtmlResponse(response, html) {
  response.statusCode = 200
  response.setHeader('content-type', 'text/html; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.end(html)
}

function writeJsonResponse(response, apiResponse) {
  response.statusCode = apiResponse.statusCode

  for (const [name, value] of Object.entries(apiResponse.headers)) {
    response.setHeader(name, value)
  }

  response.end(JSON.stringify(apiResponse.body))
}

function createLauncherServer(supportBotApi, dependencies) {
  const playgroundHtml = readPlaygroundHtml()

  return createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://localhost')

    if (request.method === 'GET' && (requestUrl.pathname === '/' || requestUrl.pathname === '/playground')) {
      writeHtmlResponse(response, playgroundHtml)
      return
    }

    if (request.method === 'GET' && requestUrl.pathname === '/favicon.ico') {
      response.statusCode = 204
      response.end()
      return
    }

    const apiResponse = await supportBotApi.handleNodeHttpRequest(request, dependencies)
    writeJsonResponse(response, apiResponse)
  })
}

async function main() {
  const dotenvResult = loadRepoRootDotEnv()
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  const packages = {
    supportBotApi: loadSupportBotApiPackage(),
    supportIndexer: loadSupportIndexerPackage(),
    supportRetrieval: loadSupportRetrievalPackage()
  }
  const dependencies = createDependencies(options, packages)
  const server = createLauncherServer(packages.supportBotApi, dependencies)
  const baseUrl = `http://${options.host}:${options.port}`

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port, options.host, resolve)
  })

  console.log(`Local support-bot API listening at ${baseUrl}`)
  console.log(
    `Repo-root .env: ${dotenvResult.exists ? dotenvResult.path : `not found at ${dotenvResult.path}`} (applied ${dotenvResult.loadedKeys.length} missing value${dotenvResult.loadedKeys.length === 1 ? '' : 's'})`
  )
  console.log(
    `This launcher uses a persisted local retrieval index plus live ${dependencies.localProvider} answer generation and ${dependencies.localProvider} query embeddings.`
  )
  console.log(`Local index: ${dependencies.localIndexPath}`)

  if (dependencies.localIndexGeneratedAt) {
    console.log(`Index built: ${dependencies.localIndexGeneratedAt}`)
  }

  console.log('')
  console.log(`Playground: ${baseUrl}/`)
  console.log(`Health:     curl ${baseUrl}/health`)
  console.log(`Sources:    curl "${baseUrl}/sources?query=How%20do%20I%20install%20Bruno%3F"`)
  console.log(
    `Chat:       curl -X POST ${baseUrl}/chat -H 'content-type: application/json' -d '{"query":"How do I install Bruno?"}'`
  )

  const shutdown = (signal) => {
    console.log(`\nReceived ${signal}; shutting down local support-bot API...`)
    server.close(() => process.exit(0))
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})