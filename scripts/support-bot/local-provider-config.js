const fs = require('fs')
const path = require('path')

const parseDotEnv = require(path.resolve(__dirname, '../../packages/bruno-lang/v2/src/dotenvToJson.js'))

const DEFAULT_LOCAL_PROVIDER = 'openai'
const DEFAULT_OLLAMA_HOST = 'http://127.0.0.1:11434'
const REPO_ROOT_DOTENV_PATH = path.resolve(__dirname, '../../.env')

function loadRepoRootDotEnv(env = process.env) {
  let parsedValues

  try {
    parsedValues = parseDotEnv(fs.readFileSync(REPO_ROOT_DOTENV_PATH, 'utf8'))
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return {
        exists: false,
        loadedKeys: [],
        path: REPO_ROOT_DOTENV_PATH
      }
    }

    throw new Error(`Unable to load repo-root .env from ${REPO_ROOT_DOTENV_PATH}: ${error.message}`)
  }

  const loadedKeys = []

  for (const [name, value] of Object.entries(parsedValues)) {
    if (typeof env[name] !== 'undefined') {
      continue
    }

    env[name] = value
    loadedKeys.push(name)
  }

  return {
    exists: true,
    loadedKeys,
    path: REPO_ROOT_DOTENV_PATH
  }
}

function parseOptionalInteger(value, label) {
  if (!value) {
    return undefined
  }

  const parsed = Number.parseInt(value, 10)

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label} value: ${value}`)
  }

  return parsed
}

function normalizeLocalProvider(value, label = 'provider') {
  const normalized = String(value || '').trim().toLowerCase()

  if (normalized === 'openai' || normalized === 'ollama') {
    return normalized
  }

  throw new Error(`Unsupported ${label}: ${value}. Expected one of: openai, ollama.`)
}

function resolveLocalProvider(value) {
  return normalizeLocalProvider(value || process.env.SUPPORT_BOT_LOCAL_PROVIDER || DEFAULT_LOCAL_PROVIDER)
}

function requireOpenAIApiKey(provider, purpose) {
  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    throw new Error(`OPENAI_API_KEY is required ${purpose} when --provider openai is selected.`)
  }
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, '')
}

function getOllamaBaseUrl() {
  return trimTrailingSlash(process.env.SUPPORT_BOT_OLLAMA_HOST || DEFAULT_OLLAMA_HOST)
}

function getOpenAIAnswerGenerationConfig() {
  return {
    model: process.env.SUPPORT_BOT_OPENAI_MODEL || undefined
  }
}

function getOpenAIEmbeddingProviderConfig() {
  return {
    model: process.env.SUPPORT_BOT_OPENAI_EMBEDDING_MODEL || undefined,
    dimensions: parseOptionalInteger(process.env.SUPPORT_BOT_OPENAI_EMBEDDING_DIMENSIONS, 'SUPPORT_BOT_OPENAI_EMBEDDING_DIMENSIONS')
  }
}

function getOllamaAnswerGenerationConfig() {
  return {
    endpoint: `${getOllamaBaseUrl()}/api/chat`,
    model: process.env.SUPPORT_BOT_OLLAMA_MODEL || undefined
  }
}

function getOllamaEmbeddingProviderConfig() {
  return {
    endpoint: `${getOllamaBaseUrl()}/v1/embeddings`,
    model: process.env.SUPPORT_BOT_OLLAMA_EMBEDDING_MODEL || undefined,
    dimensions: parseOptionalInteger(process.env.SUPPORT_BOT_OLLAMA_EMBEDDING_DIMENSIONS, 'SUPPORT_BOT_OLLAMA_EMBEDDING_DIMENSIONS')
  }
}

module.exports = {
  DEFAULT_LOCAL_PROVIDER,
  DEFAULT_OLLAMA_HOST,
  REPO_ROOT_DOTENV_PATH,
  getOllamaAnswerGenerationConfig,
  getOllamaBaseUrl,
  getOllamaEmbeddingProviderConfig,
  getOpenAIAnswerGenerationConfig,
  getOpenAIEmbeddingProviderConfig,
  loadRepoRootDotEnv,
  parseOptionalInteger,
  requireOpenAIApiKey,
  resolveLocalProvider
}