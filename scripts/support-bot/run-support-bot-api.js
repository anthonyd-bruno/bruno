#!/usr/bin/env node

const fs = require('fs')
const { createServer } = require('http')
const path = require('path')

const PLAYGROUND_HTML_PATH = path.resolve(__dirname, 'support-bot-playground.html')

function loadSupportBotApiPackage() {
  try {
    return require(path.resolve(__dirname, '../../packages/bruno-support-bot-api/dist/cjs/index.js'))
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      throw new Error('Build packages/bruno-support-bot-api before running the local support-bot API launcher.')
    }

    throw error
  }
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
      '  --service-name <name>   Service name returned by /health (default: support-bot-api-local)',
      '  --help                  Show this help text'
    ].join('\n')
  )
}

function parseArgs(argv) {
  const options = {
    host: '127.0.0.1',
    port: 8787,
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
    } else if (token === '--service-name') {
      options.serviceName = value
    } else {
      throw new Error(`Unknown option: ${token}`)
    }

    index += 1
  }

  return options
}

function createEvidence(overrides = {}) {
  const { sourcePath, url, ...rest } = overrides
  const defaults = {
    documentId: 'install-docs',
    sourceType: 'docs_site',
    title: 'Install Bruno',
    headingAnchor: 'install',
    trustTier: 'official_docs',
    retrievalScore: 0.91,
    supportCount: 2,
    supportingChunkIds: ['chunk-1', 'chunk-2']
  }

  if (sourcePath) {
    return {
      ...defaults,
      ...rest,
      sourcePath
    }
  }

  return {
    ...defaults,
    ...rest,
    url: url ?? 'https://docs.usebruno.com/install'
  }
}

function createReadyEvidence(evidence, minEvidence = 1) {
  return {
    status: 'ready',
    evidence,
    totalHits: evidence.length,
    packedEvidenceCount: evidence.length,
    minEvidence
  }
}

function resolveFixtureIntent(query, route) {
  const normalizedQuery = query.toLowerCase()

  if (normalizedQuery.includes('install') || normalizedQuery.includes('download') || normalizedQuery.includes('brew')) {
    return 'install'
  }

  if (normalizedQuery.includes('auth') || normalizedQuery.includes('token') || normalizedQuery.includes('bearer')) {
    return 'auth'
  }

  if (normalizedQuery.includes('release') || normalizedQuery.includes('version')) {
    return 'version_release'
  }

  if (normalizedQuery.includes('price') || normalizedQuery.includes('pricing') || normalizedQuery.includes('cost')) {
    return 'pricing'
  }

  return route.intent
}

function createRetrievalResult({ query, route }) {
  switch (resolveFixtureIntent(query, route)) {
    case 'install': {
      const evidence = [
        createEvidence(),
        createEvidence({
          documentId: 'downloads-page',
          sourceType: 'website',
          title: 'Bruno Downloads',
          headingAnchor: 'downloads',
          retrievalScore: 0.88,
          url: 'https://www.usebruno.com/downloads'
        })
      ]

      return { evidence: createReadyEvidence(evidence, 2), sources: evidence }
    }
    case 'cli': {
      const evidence = [
        createEvidence({
          documentId: 'cli-readme',
          sourceType: 'repo',
          title: 'Bruno CLI README',
          headingAnchor: 'usage',
          trustTier: 'repo',
          retrievalScore: 0.87,
          sourcePath: 'packages/bruno-cli/README.md'
        }),
        createEvidence()
      ]

      return { evidence: createReadyEvidence(evidence, 2), sources: evidence }
    }
    case 'auth': {
      const evidence = [
        createEvidence({
          documentId: 'auth-bearer',
          title: 'Bearer Auth',
          headingAnchor: 'bearer',
          url: 'https://docs.usebruno.com/auth/bearer'
        }),
        createEvidence({
          documentId: 'auth-overview',
          title: 'Authentication Overview',
          headingAnchor: 'authentication',
          retrievalScore: 0.86,
          url: 'https://docs.usebruno.com/auth/overview'
        })
      ]

      return { evidence: createReadyEvidence(evidence, 2), sources: evidence }
    }
    case 'version_release': {
      const evidence = [
        createEvidence({
          documentId: 'release-notes',
          sourceType: 'website',
          title: 'Bruno Releases',
          headingAnchor: 'releases',
          retrievalScore: 0.85,
          url: 'https://github.com/usebruno/bruno/releases'
        })
      ]

      return { evidence: createReadyEvidence(evidence), sources: evidence }
    }
    case 'pricing':
    case 'unknown':
      return {
        evidence: {
          status: 'insufficient_evidence',
          reason: 'below_minimum_evidence',
          evidence: [],
          totalHits: 0,
          packedEvidenceCount: 0,
          minEvidence: 1
        },
        sources: []
      }
    case 'scripting':
    case 'troubleshooting':
    default: {
      const evidence = [
        createEvidence({
          documentId: 'community-thread',
          sourceType: 'stackoverflow',
          title: `Local fixture result for: ${query}`,
          headingAnchor: 'community',
          trustTier: 'external',
          retrievalScore: 0.52,
          supportCount: 1,
          supportingChunkIds: ['chunk-community-1'],
          url: 'https://stackoverflow.com/questions/tagged/bruno'
        })
      ]

      return { evidence: createReadyEvidence(evidence), sources: evidence }
    }
  }
}

function createAnswerDraft(request) {
  const leadSource = request.evidence[0]

  return {
    shortAnswer: `Local smoke-test answer for ${request.query}`,
    steps: [
      `Check the grounding assessment: ${request.assessment.strength}`,
      `Review the top evidence source: ${leadSource ? leadSource.title : 'no evidence available'}`
    ],
    commands: request.query.toLowerCase().includes('install') ? ['brew install bruno'] : [],
    citedEvidenceIndexes: request.evidence.slice(0, 2).map((_, index) => index + 1),
    confidence: leadSource ? 0.82 : 0.35,
    uncertainty: 'This local launcher uses deterministic fixture evidence for manual smoke testing only.'
  }
}

function createDependencies(options) {
  return {
    retriever: {
      retrieve: async (input) => createRetrievalResult(input)
    },
    answerGenerator: {
      generate: async (request) => createAnswerDraft(request)
    },
    serviceName: options.serviceName,
    modelVersion: 'local-fixture-v1'
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
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  const supportBotApi = loadSupportBotApiPackage()
  const server = createLauncherServer(supportBotApi, createDependencies(options))
  const baseUrl = `http://${options.host}:${options.port}`

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port, options.host, resolve)
  })

  console.log(`Local support-bot API listening at ${baseUrl}`)
  console.log('This launcher uses deterministic local fixture wiring for manual smoke testing only.')
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