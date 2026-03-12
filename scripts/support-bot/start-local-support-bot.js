#!/usr/bin/env node

const { spawn } = require('child_process')
const path = require('path')

const REPO_ROOT = path.resolve(__dirname, '../..')
const DEFAULT_INDEX_FILE = 'artifacts/support-bot-local-index.json'
const BUILD_WORKSPACES = [
  'packages/bruno-support-indexer',
  'packages/bruno-support-retrieval',
  'packages/bruno-support-bot-api'
]
const NPM_COMMAND = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function printUsage() {
  console.log(
    [
      'Usage: node scripts/support-bot/start-local-support-bot.js [options]',
      '',
      'Build the local support-bot packages, refresh the local index, and start the local launcher.',
      '',
      'Options:',
      '  --host <host>           Forwarded to run-support-bot-api.js (default: 127.0.0.1)',
      '  --port <port>           Forwarded to run-support-bot-api.js (default: 8787)',
      `  --index-file <path>     Local support index JSON path (default: ${DEFAULT_INDEX_FILE})`,
      '  --provider <provider>   Forwarded to both sync and launcher (openai or ollama)',
      '  --service-name <name>   Forwarded to run-support-bot-api.js',
      '  --help                  Show this help text',
      '',
      'Wrapped commands:',
      '  - npm run build --workspace=packages/bruno-support-indexer',
      '  - npm run build --workspace=packages/bruno-support-retrieval',
      '  - npm run build --workspace=packages/bruno-support-bot-api',
      '  - node scripts/support-bot/run-support-bot-sync.js --index-output <index-file>',
      '  - node scripts/support-bot/run-support-bot-api.js --index-file <index-file>',
      '',
      'Provider selection, repo-root .env loading, and prerequisite validation are delegated to the wrapped scripts.'
    ].join('\n')
  )
}

function parseArgs(argv) {
  const options = {
    host: '',
    port: '',
    indexFile: DEFAULT_INDEX_FILE,
    provider: '',
    serviceName: ''
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
      options.port = value
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

function appendOption(args, flag, value) {
  if (value) {
    args.push(flag, value)
  }
}

function formatCommand(command, args) {
  return [command, ...args]
    .map((part) => (/[\s"]/u.test(part) ? JSON.stringify(part) : part))
    .join(' ')
}

function runCommand(command, args, description, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ ${description}`)
    console.log(`$ ${formatCommand(command, args)}`)

    const child = spawn(command, args, {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: 'inherit'
    })
    const signalHandlers = []

    if (options.forwardSignals) {
      for (const signal of ['SIGINT', 'SIGTERM']) {
        const handler = () => {
          if (!child.killed) {
            child.kill(signal)
          }
        }

        signalHandlers.push({ signal, handler })
        process.on(signal, handler)
      }
    }

    const cleanup = () => {
      for (const { signal, handler } of signalHandlers) {
        process.removeListener(signal, handler)
      }
    }

    child.on('error', (error) => {
      cleanup()
      reject(new Error(`Unable to start ${description}: ${error.message}`))
    })

    child.on('close', (code, signal) => {
      cleanup()

      if (signal) {
        if (options.forwardSignals && (signal === 'SIGINT' || signal === 'SIGTERM')) {
          resolve()
          return
        }

        reject(new Error(`${description} exited due to signal ${signal}.`))
        return
      }

      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${description} failed with exit code ${code}.`))
    })
  })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  console.log(`Running local support-bot startup flow from ${REPO_ROOT}`)

  for (const workspace of BUILD_WORKSPACES) {
    await runCommand(NPM_COMMAND, ['run', 'build', `--workspace=${workspace}`], `Build ${workspace}`)
  }

  const syncArgs = ['scripts/support-bot/run-support-bot-sync.js', '--index-output', options.indexFile]
  appendOption(syncArgs, '--provider', options.provider)

  await runCommand(process.execPath, syncArgs, 'Refresh local support-bot index')

  const launcherArgs = ['scripts/support-bot/run-support-bot-api.js', '--index-file', options.indexFile]
  appendOption(launcherArgs, '--host', options.host)
  appendOption(launcherArgs, '--port', options.port)
  appendOption(launcherArgs, '--provider', options.provider)
  appendOption(launcherArgs, '--service-name', options.serviceName)

  await runCommand(process.execPath, launcherArgs, 'Start local support-bot launcher', {
    forwardSignals: true
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})