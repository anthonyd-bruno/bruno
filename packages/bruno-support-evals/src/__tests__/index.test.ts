import { describe, expect, it } from '@jest/globals';

import {
  BRUNO_SUPPORT_EVAL_DATASET_VERSION,
  buildSupportBotFeedbackReport,
  evaluateSupportEvalGate,
  loadBrunoSupportEvalDataset,
  parseSupportEvalGateThresholdOverrides,
  renderSupportBotFeedbackMarkdown,
  renderSupportEvalGateMarkdown,
  supportEvals
} from '../index';

describe('support eval package entrypoint', () => {
  it('exposes a named aggregate export that mirrors the named public API', () => {
    expect(supportEvals.BRUNO_SUPPORT_EVAL_DATASET_VERSION).toBe(BRUNO_SUPPORT_EVAL_DATASET_VERSION);
    expect(supportEvals.loadBrunoSupportEvalDataset).toBe(loadBrunoSupportEvalDataset);
    expect(supportEvals.parseSupportEvalGateThresholdOverrides).toBe(parseSupportEvalGateThresholdOverrides);
    expect(supportEvals.evaluateSupportEvalGate).toBe(evaluateSupportEvalGate);
    expect(supportEvals.renderSupportEvalGateMarkdown).toBe(renderSupportEvalGateMarkdown);
    expect(supportEvals.buildSupportBotFeedbackReport).toBe(buildSupportBotFeedbackReport);
    expect(supportEvals.renderSupportBotFeedbackMarkdown).toBe(renderSupportBotFeedbackMarkdown);
  });

  it('keeps the named aggregate export usable for dataset access', () => {
    expect(supportEvals.loadBrunoSupportEvalDataset()).toEqual(loadBrunoSupportEvalDataset());
  });
});