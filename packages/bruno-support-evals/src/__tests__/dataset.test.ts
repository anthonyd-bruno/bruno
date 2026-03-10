import { describe, expect, it } from '@jest/globals';

import {
  BRUNO_SUPPORT_EVAL_DATASET_V1,
  BRUNO_SUPPORT_EVAL_DATASET_VERSION,
  DatasetValidationError,
  getBrunoSupportEvalCase,
  listBrunoSupportEvalCasesByCategory,
  loadBrunoSupportEvalDataset,
  supportEvalCategories,
  validateSupportEvalCase,
  validateSupportEvalDataset
} from '../index';

function cloneDataset() {
  return JSON.parse(JSON.stringify(BRUNO_SUPPORT_EVAL_DATASET_V1));
}

describe('bruno support eval dataset', () => {
  it('loads the seeded dataset fixture and exports a stable dataset version', () => {
    const dataset = loadBrunoSupportEvalDataset();

    expect(dataset.metadata.datasetVersion).toBe(BRUNO_SUPPORT_EVAL_DATASET_VERSION);
    expect(dataset.metadata.datasetId).toBe('bruno-support-evals');
    expect(dataset.metadata.schemaVersion).toBe(1);
    expect(dataset.metadata.stagedDelivery.stage).toBe('wave1_seed');
    expect(dataset.metadata.stagedDelivery.shippedCaseCount).toBe(dataset.cases.length);
    expect(dataset.metadata.stagedDelivery.targetCaseCount).toBeGreaterThanOrEqual(200);
    expect(dataset.metadata.stagedDelivery.notes).toContain('200');
  });

  it('covers every required category with representative cases', () => {
    const dataset = loadBrunoSupportEvalDataset();
    const categories = new Set(dataset.cases.map((entry) => entry.category));

    expect(new Set(dataset.metadata.declaredCategoryCoverage)).toEqual(new Set(supportEvalCategories));
    expect(categories).toEqual(new Set(supportEvalCategories));
    expect(listBrunoSupportEvalCasesByCategory('fallback').length).toBeGreaterThanOrEqual(1);
    expect(listBrunoSupportEvalCasesByCategory('escalation').length).toBeGreaterThanOrEqual(1);
  });

  it('keeps citation targets and rubric expectations for representative cases', () => {
    const authCase = getBrunoSupportEvalCase('auth-bearer-token');
    const fallbackCase = getBrunoSupportEvalCase('fallback-ambiguous-feature');
    const escalationCase = getBrunoSupportEvalCase('escalation-security-report');

    expect(authCase?.expectedCitationTargets[0].url).toBe('https://docs.usebruno.com/auth/bearer');
    expect(authCase?.answerRubric.minimumCitationCount).toBe(1);
    expect(fallbackCase?.answerRubric.fallbackPolicy).toBe('required');
    expect(fallbackCase?.answerRubric.requiredEscalationChannel).toBe('github_discussions');
    expect(escalationCase?.expectedCitationTargets[0].url).toBe('mailto:security@usebruno.com');
    expect(escalationCase?.answerRubric.requiredEscalationChannel).toBe('security_email');
  });

  it('validates a single case with scoring-ready rubric fields', () => {
    const entry = BRUNO_SUPPORT_EVAL_DATASET_V1.cases[0];

    expect(validateSupportEvalCase(entry)).toEqual(entry);
  });

  it('rejects invalid dataset entries with explicit path-based validation errors', () => {
    const invalidDataset = cloneDataset();
    invalidDataset.metadata.stagedDelivery.shippedCaseCount = 999;
    invalidDataset.cases[1].id = invalidDataset.cases[0].id;
    invalidDataset.cases[0].expectedCitationTargets[0].url = 'not-a-url';

    try {
      validateSupportEvalDataset(invalidDataset);
      throw new Error('Expected validateSupportEvalDataset to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DatasetValidationError);

      if (error instanceof DatasetValidationError) {
        expect(error.issues).toContain('metadata.stagedDelivery.shippedCaseCount: expected 18 to match the number of cases');
        expect(error.issues).toContain(`cases[1].id: duplicate case id "${invalidDataset.cases[0].id}"`);
        expect(error.issues).toContain('cases[0].expectedCitationTargets[0].url: expected a valid absolute URL or mailto target');
      }
    }
  });

  it('rejects invalid fallback cases and malformed rubric fields', () => {
    const invalidCase = JSON.parse(JSON.stringify(BRUNO_SUPPORT_EVAL_DATASET_V1.cases.find((entry) => entry.id === 'fallback-too-vague')));
    invalidCase.answerRubric.fallbackPolicy = 'never';
    invalidCase.answerRubric.minimumCitationCount = 3;
    invalidCase.answerRubric.requiredFacts = [];

    try {
      validateSupportEvalCase(invalidCase);
      throw new Error('Expected validateSupportEvalCase to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DatasetValidationError);

      if (error instanceof DatasetValidationError) {
        expect(error.issues).toContain('case.answerRubric.requiredFacts: expected at least 1 item(s)');
        expect(error.issues).toContain('case.answerRubric.minimumCitationCount: cannot exceed expectedCitationTargets.length (2)');
        expect(error.issues).toContain('case.answerRubric.fallbackPolicy: fallback cases must allow or require fallback behavior');
      }
    }
  });
});