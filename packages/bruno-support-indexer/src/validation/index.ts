import { z, ZodError } from 'zod';

import { type Answer, answerSchema } from '../types/answer';
import { type Chunk, chunkSchema } from '../types/chunk';
import { type Citation, citationSchema } from '../types/citation';
import { type EvalCase, evalCaseSchema } from '../types/eval-case';
import { type SourceDocument, sourceDocumentSchema } from '../types/source-document';

type SafeValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: ZodError };

export function safeValidate<T>(schema: z.ZodType<T>, data: unknown): SafeValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return { success: false, error: result.error };
}

function formatValidationError(typeName: string, error: ZodError): string {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('; ');

  return `${typeName} validation failed: ${details}`;
}

function validateWithSchema<T>(schema: z.ZodType<T>, data: unknown, typeName: string): T {
  const result = safeValidate(schema, data);

  if (result.success) {
    return result.data;
  }

  throw new Error(formatValidationError(typeName, result.error));
}

export function validateSourceDocument(data: unknown): SourceDocument {
  return validateWithSchema(sourceDocumentSchema, data, 'SourceDocument');
}

export function validateChunk(data: unknown): Chunk {
  return validateWithSchema(chunkSchema, data, 'Chunk');
}

export function validateCitation(data: unknown): Citation {
  return validateWithSchema(citationSchema, data, 'Citation');
}

export function validateAnswer(data: unknown): Answer {
  return validateWithSchema(answerSchema, data, 'Answer');
}

export function validateEvalCase(data: unknown): EvalCase {
  return validateWithSchema(evalCaseSchema, data, 'EvalCase');
}