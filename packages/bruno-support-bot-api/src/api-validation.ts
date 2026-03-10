import { type ZodIssue, type ZodType } from 'zod';

import type { ApiValidationIssue } from './api-contracts';

function formatPath(path: Array<string | number>): string {
  return path.length > 0 ? path.map(String).join('.') : '(root)';
}

function formatIssue(issue: ZodIssue): ApiValidationIssue {
  return {
    path: formatPath(issue.path),
    message: issue.message,
    code: issue.code
  };
}

function formatIssues(issues: ZodIssue[]): string {
  return issues.map((issue) => `${formatPath(issue.path)}: ${issue.message}`).join('; ');
}

export class ApiValidationError extends Error {
  readonly issues: ApiValidationIssue[];

  constructor(message: string, issues: ApiValidationIssue[]) {
    super(message);
    this.name = 'ApiValidationError';
    this.issues = issues;
  }
}

export function createValidationError(path: string, message: string, code = 'custom'): ApiValidationError {
  return new ApiValidationError(message, [{ path, message, code }]);
}

export function parseWithSchema<T>(schema: ZodType<T>, data: unknown, message = 'Request validation failed.'): T {
  const result = schema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  throw new ApiValidationError(message, result.error.issues.map(formatIssue));
}

export function validateWithSchema<T>(schema: ZodType<T>, data: unknown, message: string): T {
  const result = schema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  throw new Error(`${message}: ${formatIssues(result.error.issues)}`);
}