import type { RunSupportEvalDatasetOptions, SupportEvalCase, SupportEvalCaseRunResult, SupportEvalExecutor, SupportEvalRunOutput } from './types';
export declare function runSupportEvalCase(evalCase: SupportEvalCase, executor: SupportEvalExecutor): Promise<SupportEvalCaseRunResult>;
export declare function runSupportEvalDataset(options: RunSupportEvalDatasetOptions): Promise<SupportEvalRunOutput>;
