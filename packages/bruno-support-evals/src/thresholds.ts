import { clampSupportEvalMetricScore } from './scoring';
import {
  supportEvalMetricNames,
  type SupportEvalGateMetricThresholds,
  type SupportEvalGateThresholdOverrides,
  type SupportEvalGateThresholds,
  type SupportEvalMetricName
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeMaxFailedCaseCount(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}

function normalizeMetricThresholds(partialThresholds: Partial<SupportEvalGateMetricThresholds> = {}): SupportEvalGateMetricThresholds {
  return supportEvalMetricNames.reduce<SupportEvalGateMetricThresholds>((thresholds, metricName) => {
    thresholds[metricName] = clampSupportEvalMetricScore(
      partialThresholds[metricName] ?? DEFAULT_SUPPORT_EVAL_GATE_THRESHOLDS.minimumAverageMetrics[metricName]
    );
    return thresholds;
  }, {} as SupportEvalGateMetricThresholds);
}

export class SupportEvalGateConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupportEvalGateConfigError';
  }
}

/**
 * Launch-readiness thresholds for Bruno support evals.
 *
 * Safe tuning path: update only the numbers here, or pass JSON/file overrides into the CI gate.
 * Keep the gate logic stable unless the `SupportEvalRunOutput` contract itself changes.
 */
export const DEFAULT_SUPPORT_EVAL_GATE_THRESHOLDS: SupportEvalGateThresholds = {
  maxFailedCaseCount: 0,
  minimumAverageMetrics: {
    groundedness: 0.85,
    citationPrecision: 0.85,
    correctness: 0.85,
    fallbackQuality: 0.8
  }
};

export function parseSupportEvalGateThresholdOverrides(input: unknown): SupportEvalGateThresholdOverrides {
  if (input == null) {
    return {};
  }

  if (!isRecord(input)) {
    throw new SupportEvalGateConfigError('Support eval gate thresholds must be a JSON object.');
  }

  const allowedKeys = new Set(['maxFailedCaseCount', 'minimumAverageMetrics']);

  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key)) {
      throw new SupportEvalGateConfigError(`Unsupported support eval gate threshold key: ${key}`);
    }
  }

  const overrides: SupportEvalGateThresholdOverrides = {};

  if ('maxFailedCaseCount' in input) {
    const value = input.maxFailedCaseCount;

    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new SupportEvalGateConfigError('support eval gate maxFailedCaseCount must be a finite number.');
    }

    overrides.maxFailedCaseCount = value;
  }

  if ('minimumAverageMetrics' in input) {
    const metricOverrides = input.minimumAverageMetrics;

    if (!isRecord(metricOverrides)) {
      throw new SupportEvalGateConfigError('support eval gate minimumAverageMetrics must be an object.');
    }

    const parsedMetricOverrides: Partial<SupportEvalGateMetricThresholds> = {};
    const metricNames = new Set(supportEvalMetricNames);

    for (const key of Object.keys(metricOverrides)) {
      if (!metricNames.has(key as SupportEvalMetricName)) {
        throw new SupportEvalGateConfigError(`Unsupported support eval gate metric threshold: ${key}`);
      }

      const value = metricOverrides[key];

      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new SupportEvalGateConfigError(`support eval gate metric threshold ${key} must be a finite number.`);
      }

      parsedMetricOverrides[key as SupportEvalMetricName] = value;
    }

    overrides.minimumAverageMetrics = parsedMetricOverrides;
  }

  return overrides;
}

export function createSupportEvalGateThresholds(
  overrides: SupportEvalGateThresholdOverrides = {}
): SupportEvalGateThresholds {
  return {
    maxFailedCaseCount: normalizeMaxFailedCaseCount(
      overrides.maxFailedCaseCount ?? DEFAULT_SUPPORT_EVAL_GATE_THRESHOLDS.maxFailedCaseCount
    ),
    minimumAverageMetrics: normalizeMetricThresholds(overrides.minimumAverageMetrics)
  };
}