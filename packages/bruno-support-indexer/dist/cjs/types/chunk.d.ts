import { z } from 'zod';
export interface Chunk {
    id: string;
    documentId: string;
    content: string;
    headingAnchor?: string;
    chunkIndex: number;
    metadata: Record<string, unknown>;
    contentHash: string;
}
export declare const chunkSchema: z.ZodObject<{
    id: z.ZodString;
    documentId: z.ZodString;
    content: z.ZodString;
    headingAnchor: z.ZodOptional<z.ZodString>;
    chunkIndex: z.ZodNumber;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    contentHash: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    content: string;
    contentHash: string;
    metadata: Record<string, unknown>;
    documentId: string;
    chunkIndex: number;
    headingAnchor?: string | undefined;
}, {
    id: string;
    content: string;
    contentHash: string;
    metadata: Record<string, unknown>;
    documentId: string;
    chunkIndex: number;
    headingAnchor?: string | undefined;
}>;
