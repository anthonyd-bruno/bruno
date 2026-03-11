import { type SupportEvalGateResult, type SupportEvalGateThresholdOverrides, type SupportEvalRunOutput } from './types';
export declare function evaluateSupportEvalGate(run: SupportEvalRunOutput, thresholdOverrides?: SupportEvalGateThresholdOverrides): SupportEvalGateResult;
export declare function renderSupportEvalGateMarkdown(result: SupportEvalGateResult): string;
