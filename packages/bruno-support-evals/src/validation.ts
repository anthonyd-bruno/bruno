import {
  supportEvalCategories,
  supportEvalCitationImportances,
  supportEvalDeliveryStages,
  supportEvalDifficulties,
  supportEvalEscalationChannels,
  supportEvalFallbackPolicies,
  supportEvalSourceTypes,
  supportEvalTrustTiers,
  type SupportEvalCase,
  type SupportEvalDataset
} from './types';

const DATASET_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i;

export class DatasetValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Support eval dataset validation failed:\n${issues.map((issue) => `- ${issue}`).join('\n')}`);
    this.name = 'DatasetValidationError';
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function includesOnlyAllowedValues(value: unknown, allowedValues: readonly string[]): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && allowedValues.includes(item));
}

function validateStringArray(value: unknown, path: string, issues: string[], minimumLength = 1): void {
  if (!Array.isArray(value)) {
    issues.push(`${path}: expected an array of non-empty strings`);
    return;
  }

  if (value.length < minimumLength) {
    issues.push(`${path}: expected at least ${minimumLength} item(s)`);
  }

  value.forEach((item, index) => {
    if (!isNonEmptyString(item)) {
      issues.push(`${path}[${index}]: expected a non-empty string`);
    }
  });
}

function validateCitationTargets(value: unknown, path: string, issues: string[]): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push(`${path}: expected at least one citation target`);
    return;
  }

  value.forEach((target, index) => {
    const targetPath = `${path}[${index}]`;

    if (!isRecord(target)) {
      issues.push(`${targetPath}: expected an object`);
      return;
    }

    if (!isNonEmptyString(target.url)) {
      issues.push(`${targetPath}.url: expected a non-empty URL string`);
    } else if (!isValidUrl(target.url)) {
      issues.push(`${targetPath}.url: expected a valid absolute URL or mailto target`);
    }

    if (!isNonEmptyString(target.title)) {
      issues.push(`${targetPath}.title: expected a non-empty string`);
    }

    if (!isNonEmptyString(target.rationale)) {
      issues.push(`${targetPath}.rationale: expected a non-empty string`);
    }

    if (!supportEvalSourceTypes.includes(target.sourceType as never)) {
      issues.push(`${targetPath}.sourceType: expected one of ${supportEvalSourceTypes.join(', ')}`);
    }

    if (!supportEvalTrustTiers.includes(target.trustTier as never)) {
      issues.push(`${targetPath}.trustTier: expected one of ${supportEvalTrustTiers.join(', ')}`);
    }

    if (!supportEvalCitationImportances.includes(target.importance as never)) {
      issues.push(`${targetPath}.importance: expected one of ${supportEvalCitationImportances.join(', ')}`);
    }
  });
}

function validateAnswerRubric(value: unknown, path: string, issues: string[], citationCount: number, category?: unknown): void {
  if (!isRecord(value)) {
    issues.push(`${path}: expected an object`);
    return;
  }

  validateStringArray(value.requiredFacts, `${path}.requiredFacts`, issues, 1);

  if (value.preferredFacts !== undefined) {
    validateStringArray(value.preferredFacts, `${path}.preferredFacts`, issues, 0);
  }

  if (value.prohibitedClaims !== undefined) {
    validateStringArray(value.prohibitedClaims, `${path}.prohibitedClaims`, issues, 0);
  }

  if (!isPositiveInteger(value.minimumCitationCount)) {
    issues.push(`${path}.minimumCitationCount: expected a positive integer`);
  } else if (value.minimumCitationCount > citationCount) {
    issues.push(`${path}.minimumCitationCount: cannot exceed expectedCitationTargets.length (${citationCount})`);
  }

  if (!supportEvalFallbackPolicies.includes(value.fallbackPolicy as never)) {
    issues.push(`${path}.fallbackPolicy: expected one of ${supportEvalFallbackPolicies.join(', ')}`);
  }

  if (value.requiredEscalationChannel !== undefined && !supportEvalEscalationChannels.includes(value.requiredEscalationChannel as never)) {
    issues.push(`${path}.requiredEscalationChannel: expected one of ${supportEvalEscalationChannels.join(', ')}`);
  }

  if (value.allowedEscalationChannels !== undefined) {
    if (!includesOnlyAllowedValues(value.allowedEscalationChannels, supportEvalEscalationChannels)) {
      issues.push(`${path}.allowedEscalationChannels: expected escalation channels from the supported list`);
    } else if (
      typeof value.requiredEscalationChannel === 'string'
      && !value.allowedEscalationChannels.includes(value.requiredEscalationChannel)
    ) {
      issues.push(`${path}.allowedEscalationChannels: must include requiredEscalationChannel`);
    }
  }

  if (value.gradingNotes !== undefined && !isNonEmptyString(value.gradingNotes)) {
    issues.push(`${path}.gradingNotes: expected a non-empty string when provided`);
  }

  if (category === 'fallback' && value.fallbackPolicy === 'never') {
    issues.push(`${path}.fallbackPolicy: fallback cases must allow or require fallback behavior`);
  }
}

function collectCaseIssues(value: unknown, path: string, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push(`${path}: expected an object`);
    return;
  }

  if (!isNonEmptyString(value.id)) {
    issues.push(`${path}.id: expected a non-empty string`);
  }

  if (!supportEvalCategories.includes(value.category as never)) {
    issues.push(`${path}.category: expected one of ${supportEvalCategories.join(', ')}`);
  }

  if (!isNonEmptyString(value.query)) {
    issues.push(`${path}.query: expected a non-empty string`);
  }

  if (!supportEvalDifficulties.includes(value.difficulty as never)) {
    issues.push(`${path}.difficulty: expected one of ${supportEvalDifficulties.join(', ')}`);
  }

  if (!isNonEmptyString(value.expectedAnswer)) {
    issues.push(`${path}.expectedAnswer: expected a non-empty string`);
  }

  validateCitationTargets(value.expectedCitationTargets, `${path}.expectedCitationTargets`, issues);
  validateAnswerRubric(
    value.answerRubric,
    `${path}.answerRubric`,
    issues,
    Array.isArray(value.expectedCitationTargets) ? value.expectedCitationTargets.length : 0,
    value.category
  );
  validateStringArray(value.tags, `${path}.tags`, issues, 1);
}

export function validateSupportEvalCase(value: unknown): SupportEvalCase {
  const issues: string[] = [];

  collectCaseIssues(value, 'case', issues);

  if (issues.length > 0) {
    throw new DatasetValidationError(issues);
  }

  return value as SupportEvalCase;
}

export function validateSupportEvalDataset(value: unknown): SupportEvalDataset {
  const issues: string[] = [];

  if (!isRecord(value)) {
    throw new DatasetValidationError(['dataset: expected an object']);
  }

  const metadata = value.metadata;
  const cases = value.cases;

  if (!isRecord(metadata)) {
    issues.push('metadata: expected an object');
  } else {
    if (!isNonEmptyString(metadata.datasetId)) {
      issues.push('metadata.datasetId: expected a non-empty string');
    }

    if (metadata.schemaVersion !== 1) {
      issues.push(`metadata.schemaVersion: expected 1, received ${String(metadata.schemaVersion)}`);
    }

    if (!isNonEmptyString(metadata.datasetVersion)) {
      issues.push('metadata.datasetVersion: expected a non-empty string');
    } else if (!DATASET_VERSION_PATTERN.test(metadata.datasetVersion)) {
      issues.push('metadata.datasetVersion: expected a semver-style version string');
    }

    if (!isNonEmptyString(metadata.createdAt)) {
      issues.push('metadata.createdAt: expected a non-empty string');
    } else if (Number.isNaN(Date.parse(metadata.createdAt))) {
      issues.push('metadata.createdAt: expected an ISO-8601 parseable timestamp');
    }

    if (!isNonEmptyString(metadata.description)) {
      issues.push('metadata.description: expected a non-empty string');
    }

    const declaredCategoryCoverage = metadata.declaredCategoryCoverage;

    if (!includesOnlyAllowedValues(declaredCategoryCoverage, supportEvalCategories)) {
      issues.push('metadata.declaredCategoryCoverage: expected the supported category values');
    } else {
      supportEvalCategories.forEach((category) => {
        if (!declaredCategoryCoverage.includes(category)) {
          issues.push(`metadata.declaredCategoryCoverage: missing category ${category}`);
        }
      });
    }

    if (!isRecord(metadata.stagedDelivery)) {
      issues.push('metadata.stagedDelivery: expected an object');
    } else {
      if (!supportEvalDeliveryStages.includes(metadata.stagedDelivery.stage as never)) {
        issues.push(`metadata.stagedDelivery.stage: expected one of ${supportEvalDeliveryStages.join(', ')}`);
      }

      if (!isPositiveInteger(metadata.stagedDelivery.shippedCaseCount)) {
        issues.push('metadata.stagedDelivery.shippedCaseCount: expected a positive integer');
      }

      if (!isPositiveInteger(metadata.stagedDelivery.targetCaseCount)) {
        issues.push('metadata.stagedDelivery.targetCaseCount: expected a positive integer');
      }

      if (
        isPositiveInteger(metadata.stagedDelivery.shippedCaseCount)
        && isPositiveInteger(metadata.stagedDelivery.targetCaseCount)
        && metadata.stagedDelivery.targetCaseCount < metadata.stagedDelivery.shippedCaseCount
      ) {
        issues.push('metadata.stagedDelivery.targetCaseCount: must be greater than or equal to shippedCaseCount');
      }

      if (!isNonEmptyString(metadata.stagedDelivery.notes)) {
        issues.push('metadata.stagedDelivery.notes: expected a non-empty string');
      }
    }
  }

  if (!Array.isArray(cases) || cases.length === 0) {
    issues.push('cases: expected a non-empty array');
  } else {
    const seenIds = new Set<string>();
    const seenCategories = new Set<string>();

    cases.forEach((entry, index) => {
      collectCaseIssues(entry, `cases[${index}]`, issues);

      if (isRecord(entry) && isNonEmptyString(entry.id)) {
        if (seenIds.has(entry.id)) {
          issues.push(`cases[${index}].id: duplicate case id "${entry.id}"`);
        }

        seenIds.add(entry.id);
      }

      if (isRecord(entry) && typeof entry.category === 'string') {
        seenCategories.add(entry.category);
      }
    });

    supportEvalCategories.forEach((category) => {
      if (!seenCategories.has(category)) {
        issues.push(`cases: missing required category coverage for ${category}`);
      }
    });

    if (
      isRecord(metadata)
      && isRecord(metadata.stagedDelivery)
      && isPositiveInteger(metadata.stagedDelivery.shippedCaseCount)
      && metadata.stagedDelivery.shippedCaseCount !== cases.length
    ) {
      issues.push(
        `metadata.stagedDelivery.shippedCaseCount: expected ${cases.length} to match the number of cases`
      );
    }
  }

  if (issues.length > 0) {
    throw new DatasetValidationError(issues);
  }

  return value as unknown as SupportEvalDataset;
}