import type { SupportEvalCase, SupportEvalCategory, SupportEvalDataset } from './types';
export declare function loadBrunoSupportEvalDataset(): SupportEvalDataset;
export declare function listBrunoSupportEvalCases(): SupportEvalCase[];
export declare function listBrunoSupportEvalCasesByCategory(category: SupportEvalCategory): SupportEvalCase[];
export declare function getBrunoSupportEvalCase(caseId: string): SupportEvalCase | undefined;
