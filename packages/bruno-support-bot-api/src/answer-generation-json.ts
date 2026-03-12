import type { AnswerGenerationDraft, PromptMessage } from './answer-generation-adapter';

export function buildJsonInstructionMessage(): PromptMessage {
  return {
    role: 'system',
    content: [
      'Return only valid JSON.',
      'Do not include markdown fences or explanatory text.',
      'Allowed keys: shortAnswer (string, required), steps (string[]), commands (string[]), citedEvidenceIndexes (integer[]), confidence (number 0-1), uncertainty (string).',
      'Only cite evidence indexes that appear in the provided evidence list.'
    ].join(' ')
  };
}

function toStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);

  return items.length > 0 ? items : undefined;
}

function toPositiveIntegerList(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .map((item) => (Number.isInteger(item) && (item as number) > 0 ? (item as number) : undefined))
    .filter((item): item is number => item !== undefined);

  return items.length > 0 ? items : undefined;
}

export function parseAnswerGenerationDraft(content: string, providerLabel: string): AnswerGenerationDraft {
  let value: unknown;

  try {
    value = JSON.parse(content) as unknown;
  } catch (error) {
    throw new Error(
      `${providerLabel} answer generation returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!value || typeof value !== 'object') {
    throw new Error(`${providerLabel} answer generation returned a non-object JSON payload.`);
  }

  const draft = value as Record<string, unknown>;

  if (typeof draft.shortAnswer !== 'string' || draft.shortAnswer.trim().length === 0) {
    throw new Error(`${providerLabel} answer generation payload must include a non-empty shortAnswer string.`);
  }

  return {
    shortAnswer: draft.shortAnswer.trim(),
    steps: toStringList(draft.steps),
    commands: toStringList(draft.commands),
    citedEvidenceIndexes: toPositiveIntegerList(draft.citedEvidenceIndexes),
    confidence:
      typeof draft.confidence === 'number' && draft.confidence >= 0 && draft.confidence <= 1
        ? draft.confidence
        : undefined,
    uncertainty: typeof draft.uncertainty === 'string' && draft.uncertainty.trim().length > 0 ? draft.uncertainty.trim() : undefined
  };
}