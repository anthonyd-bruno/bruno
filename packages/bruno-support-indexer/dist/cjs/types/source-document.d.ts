import { z } from 'zod';
import { TrustTier } from './trust-tier';
export declare const sourceTypes: readonly ["repo", "docs_site", "website", "github", "stackoverflow"];
export type SourceType = (typeof sourceTypes)[number];
export interface SourceDocument {
    id: string;
    sourceType: SourceType;
    url?: string;
    sourcePath?: string;
    title: string;
    content: string;
    contentHash: string;
    trustTier: TrustTier;
    lastModified: Date;
    lastSeen: Date;
    metadata: Record<string, unknown>;
}
export declare const sourceTypeSchema: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>;
export declare const sourceDocumentSchema: z.ZodObject<{
    id: z.ZodString;
    sourceType: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>;
    url: z.ZodOptional<z.ZodString>;
    sourcePath: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    content: z.ZodString;
    contentHash: z.ZodString;
    trustTier: z.ZodNativeEnum<typeof TrustTier>;
    lastModified: z.ZodDate;
    lastSeen: z.ZodDate;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    id: string;
    sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
    title: string;
    content: string;
    contentHash: string;
    trustTier: TrustTier;
    lastModified: Date;
    lastSeen: Date;
    metadata: Record<string, unknown>;
    url?: string | undefined;
    sourcePath?: string | undefined;
}, {
    id: string;
    sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
    title: string;
    content: string;
    contentHash: string;
    trustTier: TrustTier;
    lastModified: Date;
    lastSeen: Date;
    metadata: Record<string, unknown>;
    url?: string | undefined;
    sourcePath?: string | undefined;
}>;
