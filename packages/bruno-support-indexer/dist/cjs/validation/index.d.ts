import { z, ZodError } from 'zod';
import { type Answer } from '../types/answer';
import { type Chunk } from '../types/chunk';
import { type Citation } from '../types/citation';
import { type EvalCase } from '../types/eval-case';
import { type SourceDocument } from '../types/source-document';
type SafeValidationResult<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: ZodError;
};
export declare function safeValidate<T>(schema: z.ZodType<T>, data: unknown): SafeValidationResult<T>;
export declare function validateSourceDocument(data: unknown): SourceDocument;
export declare function validateChunk(data: unknown): Chunk;
export declare function validateCitation(data: unknown): Citation;
export declare function validateAnswer(data: unknown): Answer;
export declare function validateEvalCase(data: unknown): EvalCase;
export {};
