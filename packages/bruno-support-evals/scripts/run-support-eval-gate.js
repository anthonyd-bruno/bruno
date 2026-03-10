#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function loadSupportEvalPackage() {
  try {
    return require(path.resolve(__dirname, '../dist/cjs/index.js'));
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      throw new Error('Build packages/bruno-support-evals before running the gate script.');
    }

    throw error;
  }
}

function printUsage() {
  console.log(
    [
      'Usage: npm run gate --workspace=packages/bruno-support-evals -- --input <run-output.json> [options]',
      '',
      'Options:',
      '  --input <path>             Path to SupportEvalRunOutput JSON (required)',
      '  --output <path>            Optional path for SupportEvalGateResult JSON',
      '  --thresholds-file <path>   Optional JSON file with threshold overrides',
      '  --thresholds-json <json>   Optional inline JSON with threshold overrides',
      '  --help                     Show this help text'
    ].join('\n')
  );
}

function parseArgs(argv) {
  const options = {
    input: '',
    output: '',
    thresholdsFile: '',
    thresholdsJson: ''
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--help') {
      options.help = true;
      continue;
    }

    const value = argv[index + 1];

    if (!value) {
      throw new Error(`Missing value for ${token}`);
    }

    if (token === '--input') {
      options.input = value;
    } else if (token === '--output') {
      options.output = value;
    } else if (token === '--thresholds-file') {
      options.thresholdsFile = value;
    } else if (token === '--thresholds-json') {
      options.thresholdsJson = value;
    } else {
      throw new Error(`Unknown option: ${token}`);
    }

    index += 1;
  }

  return options;
}

function readJsonFile(filePath, label) {
  const absolutePath = path.resolve(process.cwd(), filePath);

  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    throw new Error(`Unable to read ${label} JSON from ${absolutePath}: ${error.message}`);
  }
}

function mergeThresholdOverrides(base = {}, extra = {}) {
  return {
    ...base,
    ...extra,
    minimumAverageMetrics: {
      ...(base.minimumAverageMetrics || {}),
      ...(extra.minimumAverageMetrics || {})
    }
  };
}

function writeIfRequested(outputPath, content) {
  if (!outputPath) {
    return;
  }

  const absolutePath = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(content, null, 2)}\n`, 'utf8');
  console.log(`Wrote support eval gate result to ${absolutePath}`);
}

function appendGithubStepSummary(markdown) {
  if (!process.env.GITHUB_STEP_SUMMARY) {
    return;
  }

  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`, 'utf8');
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printUsage();
    return;
  }

  if (!options.input) {
    throw new Error('The --input option is required.');
  }

  const supportEvals = loadSupportEvalPackage();
  const run = readJsonFile(options.input, 'support eval run output');

  let overrides = {};

  if (options.thresholdsFile) {
    overrides = mergeThresholdOverrides(overrides, readJsonFile(options.thresholdsFile, 'support eval thresholds'));
  }

  if (options.thresholdsJson) {
    try {
      overrides = mergeThresholdOverrides(overrides, JSON.parse(options.thresholdsJson));
    } catch (error) {
      throw new Error(`Unable to parse --thresholds-json: ${error.message}`);
    }
  }

  const parsedOverrides = supportEvals.parseSupportEvalGateThresholdOverrides(overrides);
  const result = supportEvals.evaluateSupportEvalGate(run, parsedOverrides);
  const markdown = supportEvals.renderSupportEvalGateMarkdown(result);

  console.log(markdown);
  appendGithubStepSummary(markdown);
  writeIfRequested(options.output, result);

  if (result.status === 'failed') {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}