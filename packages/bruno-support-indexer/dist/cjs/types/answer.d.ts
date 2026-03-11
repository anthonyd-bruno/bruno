import { z } from 'zod';
import { type Citation } from './citation';
export interface Answer {
    id: string;
    query: string;
    content: string;
    citations: Citation[];
    confidence: number;
    generatedAt: Date;
    modelVersion?: string;
}
export declare const answerSchema: z.ZodObject<{
    id: z.ZodString;
    query: z.ZodString;
    content: z.ZodString;
    citations: z.ZodArray<z.ZodObject<{
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
    confidence: z.ZodNumber;
    generatedAt: z.ZodDate;
    modelVersion: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    id: string;
    content: string;
    query: string;
    citations: {
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        url: string;
        title: string;
        trustTier: import("./trust-tier").TrustTier;
        retrievalScore: number;
        headingAnchor?: string | undefined;
    }[];
    confidence: number;
    generatedAt: Date;
    modelVersion?: string | undefined;
}, {
    id: string;
    content: string;
    query: string;
    citations: {
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        url: string;
        title: string;
        trustTier: import("./trust-tier").TrustTier;
        retrievalScore: number;
        headingAnchor?: string | undefined;
    }[];
    confidence: number;
    generatedAt: Date;
    modelVersion?: string | undefined;
}>;
