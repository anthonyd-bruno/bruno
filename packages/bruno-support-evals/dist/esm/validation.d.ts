import { type SupportEvalCase, type SupportEvalDataset } from './types';
export declare class DatasetValidationError extends Error {
    readonly issues: string[];
    constructor(issues: string[]);
}
export declare function validateSupportEvalCase(value: unknown): SupportEvalCase;
export declare function validateSupportEvalDataset(value: unknown): SupportEvalDataset;
