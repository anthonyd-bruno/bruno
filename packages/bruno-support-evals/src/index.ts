export * from './types';
export * from './validation';
export * from './loaders';
export * from './scoring';
export * from './runner';
export * from './reporting';
export * from './thresholds';
export * from './gate';
export * from './feedback';
export * from './datasets/bruno-support-v1';

import { BRUNO_SUPPORT_EVAL_DATASET_V1, BRUNO_SUPPORT_EVAL_DATASET_VERSION } from './datasets/bruno-support-v1';
import {
  getBrunoSupportEvalCase,
  listBrunoSupportEvalCases,
  listBrunoSupportEvalCasesByCategory,
  loadBrunoSupportEvalDataset
} from './loaders';
import { renderSupportEvalRunMarkdown } from './reporting';
import {
  aggregateSupportBotFeedbackSignals,
  buildSupportBotFeedbackReport,
  normalizeSupportBotTelemetryFeedbackSignals,
  normalizeSupportEvalFeedbackSignals
} from './feedback';
import { renderSupportBotFeedbackMarkdown } from './reporting';
import { calculateSupportEvalRunAggregates, clampSupportEvalMetricScore, normalizeSupportEvalMetricScores } from './scoring';
import {
  createSupportEvalGateThresholds,
  DEFAULT_SUPPORT_EVAL_GATE_THRESHOLDS,
  parseSupportEvalGateThresholdOverrides
} from './thresholds';
import { runSupportEvalCase, runSupportEvalDataset } from './runner';
import { evaluateSupportEvalGate, renderSupportEvalGateMarkdown } from './gate';

export const supportEvals = {
  BRUNO_SUPPORT_EVAL_DATASET_VERSION,
  BRUNO_SUPPORT_EVAL_DATASET_V1,
  loadBrunoSupportEvalDataset,
  listBrunoSupportEvalCases,
  listBrunoSupportEvalCasesByCategory,
  getBrunoSupportEvalCase,
  clampSupportEvalMetricScore,
  normalizeSupportEvalMetricScores,
  calculateSupportEvalRunAggregates,
  runSupportEvalCase,
  runSupportEvalDataset,
  renderSupportEvalRunMarkdown,
  normalizeSupportBotTelemetryFeedbackSignals,
  normalizeSupportEvalFeedbackSignals,
  aggregateSupportBotFeedbackSignals,
  buildSupportBotFeedbackReport,
  renderSupportBotFeedbackMarkdown,
  DEFAULT_SUPPORT_EVAL_GATE_THRESHOLDS,
  parseSupportEvalGateThresholdOverrides,
  createSupportEvalGateThresholds,
  evaluateSupportEvalGate,
  renderSupportEvalGateMarkdown
};