import { type SupportEvalGateThresholdOverrides, type SupportEvalGateThresholds } from './types';
export declare class SupportEvalGateConfigError extends Error {
    constructor(message: string);
}
/**
 * Launch-readiness thresholds for Bruno support evals.
 *
 * Safe tuning path: update only the numbers here, or pass JSON/file overrides into the CI gate.
 * Keep the gate logic stable unless the `SupportEvalRunOutput` contract itself changes.
 */
export declare const DEFAULT_SUPPORT_EVAL_GATE_THRESHOLDS: SupportEvalGateThresholds;
export declare function parseSupportEvalGateThresholdOverrides(input: unknown): SupportEvalGateThresholdOverrides;
export declare function createSupportEvalGateThresholds(overrides?: SupportEvalGateThresholdOverrides): SupportEvalGateThresholds;
