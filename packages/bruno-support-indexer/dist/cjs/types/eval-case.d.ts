import { z } from 'zod';
import { type Citation } from './citation';
export declare const evalCaseDifficulties: readonly ["easy", "medium", "hard"];
export type EvalCaseDifficulty = (typeof evalCaseDifficulties)[number];
export interface EvalCase {
    id: string;
    query: string;
    expectedAnswer: string;
    expectedCitations: Citation[];
    category: string;
    difficulty: EvalCaseDifficulty;
}
export declare const evalCaseSchema: z.ZodObject<{
    id: z.ZodString;
    query: z.ZodString;
    expectedAnswer: z.ZodString;
    expectedCitations: z.ZodArray<z.ZodObject<{
        sourceType: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>;
        url: z.ZodString;
        title: z.ZodString;
        headingAnchor: z.ZodOptional<z.ZodString>;
        trustTier: z.ZodNativeEnum<typeof import("./trust-tier").TrustTier>;
        retrievalScore: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        url: string;
        title: string;
        trustTier: import("./trust-tier").TrustTier;
        retrievalScore: number;
        headingAnchor?: string | undefined;
    }, {
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        url: string;
        title: string;
        trustTier: import("./trust-tier").TrustTier;
        retrievalScore: number;
        headingAnchor?: string | undefined;
    }>, "many">;
    category: z.ZodString;
    difficulty: z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"easy">, z.ZodLiteral<"medium">]>, z.ZodLiteral<"hard">]>;
}, "strip", z.ZodTypeAny, {
    id: string;
    query: string;
    expectedAnswer: string;
    expectedCitations: {
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        url: string;
        title: string;
        trustTier: import("./trust-tier").TrustTier;
        retrievalScore: number;
        headingAnchor?: string | undefined;
    }[];
    category: string;
    difficulty: "easy" | "medium" | "hard";
}, {
    id: string;
    query: string;
    expectedAnswer: string;
    expectedCitations: {
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        url: string;
        title: string;
        trustTier: import("./trust-tier").TrustTier;
        retrievalScore: number;
        headingAnchor?: string | undefined;
    }[];
    category: string;
    difficulty: "easy" | "medium" | "hard";
}>;
