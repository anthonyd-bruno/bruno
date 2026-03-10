import { BRUNO_SUPPORT_EVAL_DATASET_V1 } from './datasets/bruno-support-v1';
import type { SupportEvalCase, SupportEvalCategory, SupportEvalDataset } from './types';
import { validateSupportEvalDataset } from './validation';

let cachedDataset: SupportEvalDataset | undefined;

export function loadBrunoSupportEvalDataset(): SupportEvalDataset {
  cachedDataset ??= validateSupportEvalDataset(BRUNO_SUPPORT_EVAL_DATASET_V1);
  return cachedDataset;
}

export function listBrunoSupportEvalCases(): SupportEvalCase[] {
  return loadBrunoSupportEvalDataset().cases;
}

export function listBrunoSupportEvalCasesByCategory(category: SupportEvalCategory): SupportEvalCase[] {
  return listBrunoSupportEvalCases().filter((entry) => entry.category === category);
}

export function getBrunoSupportEvalCase(caseId: string): SupportEvalCase | undefined {
  return listBrunoSupportEvalCases().find((entry) => entry.id === caseId);
}