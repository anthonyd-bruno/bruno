import { z } from 'zod';
import { type SourceType } from './source-document';
import { TrustTier } from './trust-tier';
export interface Citation {
    sourceType: SourceType;
    url: string;
    title: string;
    headingAnchor?: string;
    trustTier: TrustTier;
    retrievalScore: number;
}
export declare const citationSchema: z.ZodObject<{
    sourceType: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>;
    url: z.ZodString;
    title: z.ZodString;
    headingAnchor: z.ZodOptional<z.ZodString>;
    trustTier: z.ZodNativeEnum<typeof TrustTier>;
    retrievalScore: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
    url: string;
    title: string;
    trustTier: TrustTier;
    retrievalScore: number;
    headingAnchor?: string | undefined;
}, {
    sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
    url: string;
    title: string;
    trustTier: TrustTier;
    retrievalScore: number;
    headingAnchor?: string | undefined;
}>;
