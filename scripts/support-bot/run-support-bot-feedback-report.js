#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

function loadSupportEvalsPackage() {
  try {
    return require(path.resolve(__dirname, '../../packages/bruno-support-evals/dist/cjs/index.js'))
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      throw new Error('Build packages/bruno-support-evals before running the support feedback script.')
    }

    throw error
  }
}

function printUsage() {
  console.log(
    [
      'Usage: node scripts/support-bot/run-support-bot-feedback-report.js [options]',
      '',
      'Options:',
      '  --telemetry-file <path>    JSON file containing support-bot telemetry events (repeatable)',
      '  --eval-file <path>         JSON file containing a support-evals run output (repeatable)',
      '  --output <path>            JSON report output (default: artifacts/support-bot-feedback-report.json)',
      '  --markdown-output <path>   Markdown summary output (default: artifacts/support-bot-feedback-summary.md)',
      '  --help                     Show this help text'
    ].join('\n')
  )
}

function parseArgs(argv) {
  const options = {
    telemetryFiles: [],
    evalFiles: [],
    output: 'artifacts/support-bot-feedback-report.json',
    markdownOutput: 'artifacts/support-bot-feedback-summary.md'
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

    if (token === '--telemetry-file') {
      options.telemetryFiles.push(value)
    } else if (token === '--eval-file') {
      options.evalFiles.push(value)
    } else if (token === '--output') {
      options.output = value
    } else if (token === '--markdown-output') {
      options.markdownOutput = value
    } else {
      throw new Error(`Unknown option: ${token}`)
    }

    index += 1
  }

  return options
}

function readJsonFile(filePath, label) {
  const absolutePath = path.resolve(process.cwd(), filePath)

  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  } catch (error) {
    throw new Error(`Unable to read ${label} JSON from ${absolutePath}: ${error.message}`)
  }
}

function writeFile(filePath, value, label) {
  const absolutePath = path.resolve(process.cwd(), filePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  fs.writeFileSync(absolutePath, value, 'utf8')
  console.log(`Wrote ${label} to ${absolutePath}`)
}

function appendGithubStepSummary(markdown) {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    return
  }

  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, 'utf8')
}

function flattenRecords(filePaths, label) {
  return filePaths.flatMap((filePath) => {
    const value = readJsonFile(filePath, label)
    return Array.isArray(value) ? value : [value]
  })
}

function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printUsage()
    return
  }

  if (options.telemetryFiles.length === 0 && options.evalFiles.length === 0) {
    throw new Error('Provide at least one --telemetry-file or --eval-file input.')
  }

  const supportEvals = loadSupportEvalsPackage()
  const telemetryEvents = flattenRecords(options.telemetryFiles, 'support-bot telemetry events')
  const evalRuns = flattenRecords(options.evalFiles, 'support eval run output')
  const report = supportEvals.buildSupportBotFeedbackReport({ telemetryEvents, evalRuns })
  const markdown = supportEvals.renderSupportBotFeedbackMarkdown(report)

  console.log(markdown)
  appendGithubStepSummary(markdown)
  writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, 'support feedback report')
  writeFile(options.markdownOutput, `${markdown}\n`, 'support feedback markdown summary')
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}