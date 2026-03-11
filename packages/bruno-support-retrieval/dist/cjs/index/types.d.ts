import { z } from 'zod';
export declare const DEFAULT_TOP_K = 10;
export declare const DEFAULT_VECTOR_WEIGHT = 0.7;
export declare const DEFAULT_KEYWORD_WEIGHT = 0.3;
export declare const DEFAULT_TRUST_WEIGHT = 0.2;
export declare const DEFAULT_FRESHNESS_WEIGHT = 0.15;
export declare const DEFAULT_FRESHNESS_HALF_LIFE_DAYS = 180;
export declare const DEFAULT_VOLATILE_FRESHNESS_HALF_LIFE_DAYS = 30;
export declare const DEFAULT_MIN_EVIDENCE = 2;
export declare const indexedChunkSourceTypes: readonly ["repo", "docs_site", "website", "github", "stackoverflow"];
export declare const indexedChunkTrustTiers: readonly ["official_docs", "repo", "community", "external"];
export declare const rankingAdjustmentSignals: readonly ["trust", "freshness"];
export declare const rankingAdjustmentDirections: readonly ["boost", "penalty", "neutral"];
export declare const rankingAdjustmentBases: readonly ["trust_tier", "last_modified", "volatile_content"];
export declare const freshnessProfiles: readonly ["standard", "volatile"];
export declare const evidencePackStatuses: readonly ["ready", "insufficient_evidence"];
export declare const evidencePackReasons: readonly ["below_minimum_evidence"];
export declare const supportQueryIntents: readonly ["install", "cli", "scripting", "auth", "pricing", "troubleshooting", "version_release", "unknown"];
export declare const classifierOverrideMatchModes: readonly ["all", "any"];
export type IndexedChunkSourceType = (typeof indexedChunkSourceTypes)[number];
export type IndexedChunkTrustTier = (typeof indexedChunkTrustTiers)[number];
export type SearchMode = 'vector' | 'keyword' | 'hybrid';
export type RankingAdjustmentSignal = (typeof rankingAdjustmentSignals)[number];
export type RankingAdjustmentDirection = (typeof rankingAdjustmentDirections)[number];
export type RankingAdjustmentBasis = (typeof rankingAdjustmentBases)[number];
export type FreshnessProfile = (typeof freshnessProfiles)[number];
export type EvidencePackStatus = (typeof evidencePackStatuses)[number];
export type EvidencePackReason = (typeof evidencePackReasons)[number];
export type SupportQueryIntent = (typeof supportQueryIntents)[number];
export type ClassifierOverrideMatchMode = (typeof classifierOverrideMatchModes)[number];
export type TrustTierScoreOverrides = Partial<Record<IndexedChunkTrustTier, number>>;
export interface IndexedChunk {
    id: string;
    documentId: string;
    content: string;
    contentHash: string;
    headingAnchor?: string;
    chunkIndex: number;
    metadata: Record<string, unknown>;
    embedding: number[];
    sourceType: IndexedChunkSourceType;
    trustTier: IndexedChunkTrustTier;
    lastModified: Date;
}
export interface SearchResult {
    chunk: IndexedChunk;
    score: number;
    vectorScore?: number;
    keywordScore?: number;
    ranking?: RankingRationale;
}
export interface FilterOptions {
    sourceTypes?: IndexedChunkSourceType[];
    trustTiers?: IndexedChunkTrustTier[];
    minDate?: Date;
}
export interface RankingAdjustment {
    signal: RankingAdjustmentSignal;
    basis: RankingAdjustmentBasis;
    score: number;
    weight: number;
    baseline: number;
    contribution: number;
    direction: RankingAdjustmentDirection;
}
export interface RankingRationale {
    baseScore: number;
    finalScore: number;
    trustScore: number;
    freshnessScore: number;
    trustTier: IndexedChunkTrustTier;
    ageDays: number;
    freshnessProfile: FreshnessProfile;
    freshnessHalfLifeDays: number;
    matchedVolatilityIndicators: string[];
    adjustments: RankingAdjustment[];
}
export interface RankingOptions {
    enabled?: boolean;
    trustWeight?: number;
    freshnessWeight?: number;
    trustTierScores?: TrustTierScoreOverrides;
    freshnessHalfLifeDays?: number;
    volatileFreshnessHalfLifeDays?: number;
    volatilityIndicators?: string[];
    now?: Date;
}
export interface SearchOptions {
    mode: SearchMode;
    topK?: number;
    vectorWeight?: number;
    keywordWeight?: number;
    filter?: FilterOptions;
    ranking?: RankingOptions;
}
export interface EvidenceDocumentReference {
    title?: string;
    url?: string;
    sourcePath?: string;
}
export interface EvidenceBundleBase {
    documentId: string;
    sourceType: IndexedChunkSourceType;
    title: string;
    headingAnchor?: string;
    trustTier: IndexedChunkTrustTier;
    retrievalScore: number;
    ranking?: RankingRationale;
    supportCount: number;
    supportingChunkIds: string[];
}
export type EvidenceBundle = (EvidenceBundleBase & {
    url: string;
    sourcePath?: never;
}) | (EvidenceBundleBase & {
    sourcePath: string;
    url?: never;
});
export interface EvidencePackOptions {
    minEvidence?: number;
    maxEvidence?: number;
    documentsById?: Record<string, EvidenceDocumentReference>;
}
export interface SupportQueryIntentScores {
    install: number;
    cli: number;
    scripting: number;
    auth: number;
    pricing: number;
    troubleshooting: number;
    version_release: number;
    unknown: number;
}
export interface SupportQueryClassification {
    intent: SupportQueryIntent;
    score: number;
    matchedSignals: string[];
    scores: SupportQueryIntentScores;
    isFallback: boolean;
}
export interface SupportQueryIntentTermOverrides {
    install?: string[];
    cli?: string[];
    scripting?: string[];
    auth?: string[];
    pricing?: string[];
    troubleshooting?: string[];
    version_release?: string[];
}
export interface SupportQueryClassifierOverride {
    intent: SupportQueryIntent;
    terms: string[];
    matchMode?: ClassifierOverrideMatchMode;
}
export interface SupportQueryClassifierConfig {
    minimumScore?: number;
    minimumMargin?: number;
    overrides?: SupportQueryClassifierOverride[];
    extraTermsByIntent?: SupportQueryIntentTermOverrides;
}
export interface RoutedEvidenceOptions {
    minEvidence?: number;
    maxEvidence?: number;
}
export interface SupportQueryRoutingRule {
    search: SearchOptions;
    evidence?: RoutedEvidenceOptions;
}
export interface SupportQueryRoutingRuleOverride {
    search?: Partial<SearchOptions>;
    evidence?: RoutedEvidenceOptions;
}
export interface SupportQueryRouteOverrides {
    install?: SupportQueryRoutingRuleOverride;
    cli?: SupportQueryRoutingRuleOverride;
    scripting?: SupportQueryRoutingRuleOverride;
    auth?: SupportQueryRoutingRuleOverride;
    pricing?: SupportQueryRoutingRuleOverride;
    troubleshooting?: SupportQueryRoutingRuleOverride;
    version_release?: SupportQueryRoutingRuleOverride;
    unknown?: SupportQueryRoutingRuleOverride;
}
export interface SupportQueryRoutingConfig {
    classifier?: SupportQueryClassifierConfig;
    routeOverrides?: SupportQueryRouteOverrides;
}
export interface SupportQueryRoutePlan {
    query: string;
    intent: SupportQueryIntent;
    classification: SupportQueryClassification;
    search: SearchOptions;
    evidence?: RoutedEvidenceOptions;
}
export interface ReadyEvidencePackResult {
    status: 'ready';
    evidence: EvidenceBundle[];
    totalHits: number;
    packedEvidenceCount: number;
    minEvidence: number;
}
export interface InsufficientEvidencePackResult {
    status: 'insufficient_evidence';
    reason: 'below_minimum_evidence';
    evidence: [];
    totalHits: number;
    packedEvidenceCount: number;
    minEvidence: number;
}
export type EvidencePackResult = ReadyEvidencePackResult | InsufficientEvidencePackResult;
export declare const indexedChunkSourceTypeSchema: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>;
export declare const indexedChunkTrustTierSchema: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
export declare const rankingAdjustmentSignalSchema: z.ZodEnum<["trust", "freshness"]>;
export declare const rankingAdjustmentDirectionSchema: z.ZodEnum<["boost", "penalty", "neutral"]>;
export declare const rankingAdjustmentBasisSchema: z.ZodEnum<["trust_tier", "last_modified", "volatile_content"]>;
export declare const freshnessProfileSchema: z.ZodEnum<["standard", "volatile"]>;
export declare const evidencePackStatusSchema: z.ZodEnum<["ready", "insufficient_evidence"]>;
export declare const evidencePackReasonSchema: z.ZodEnum<["below_minimum_evidence"]>;
export declare const supportQueryIntentSchema: z.ZodEnum<["install", "cli", "scripting", "auth", "pricing", "troubleshooting", "version_release", "unknown"]>;
export declare const classifierOverrideMatchModeSchema: z.ZodEnum<["all", "any"]>;
export declare const searchModeSchema: z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>;
export declare const filterOptionsSchema: z.ZodObject<{
    sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
    trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
    minDate: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
    minDate?: Date | undefined;
}, {
    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
    minDate?: Date | undefined;
}>;
export declare const indexedChunkSchema: z.ZodObject<{
    id: z.ZodString;
    documentId: z.ZodString;
    content: z.ZodString;
    contentHash: z.ZodString;
    headingAnchor: z.ZodOptional<z.ZodString>;
    chunkIndex: z.ZodNumber;
    metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    embedding: z.ZodArray<z.ZodNumber, "many">;
    sourceType: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>;
    trustTier: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
    lastModified: z.ZodDate;
}, "strip", z.ZodTypeAny, {
    id: string;
    documentId: string;
    content: string;
    contentHash: string;
    chunkIndex: number;
    metadata: Record<string, unknown>;
    embedding: number[];
    sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
    trustTier: "repo" | "official_docs" | "community" | "external";
    lastModified: Date;
    headingAnchor?: string | undefined;
}, {
    id: string;
    documentId: string;
    content: string;
    contentHash: string;
    chunkIndex: number;
    metadata: Record<string, unknown>;
    embedding: number[];
    sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
    trustTier: "repo" | "official_docs" | "community" | "external";
    lastModified: Date;
    headingAnchor?: string | undefined;
}>;
export declare const trustTierScoreOverridesSchema: z.ZodObject<{
    official_docs: z.ZodOptional<z.ZodNumber>;
    repo: z.ZodOptional<z.ZodNumber>;
    community: z.ZodOptional<z.ZodNumber>;
    external: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    repo?: number | undefined;
    official_docs?: number | undefined;
    community?: number | undefined;
    external?: number | undefined;
}, {
    repo?: number | undefined;
    official_docs?: number | undefined;
    community?: number | undefined;
    external?: number | undefined;
}>;
export declare const rankingAdjustmentSchema: z.ZodObject<{
    signal: z.ZodEnum<["trust", "freshness"]>;
    basis: z.ZodEnum<["trust_tier", "last_modified", "volatile_content"]>;
    score: z.ZodNumber;
    weight: z.ZodNumber;
    baseline: z.ZodNumber;
    contribution: z.ZodNumber;
    direction: z.ZodEnum<["boost", "penalty", "neutral"]>;
}, "strip", z.ZodTypeAny, {
    signal: "trust" | "freshness";
    basis: "trust_tier" | "last_modified" | "volatile_content";
    score: number;
    weight: number;
    baseline: number;
    contribution: number;
    direction: "boost" | "penalty" | "neutral";
}, {
    signal: "trust" | "freshness";
    basis: "trust_tier" | "last_modified" | "volatile_content";
    score: number;
    weight: number;
    baseline: number;
    contribution: number;
    direction: "boost" | "penalty" | "neutral";
}>;
export declare const rankingRationaleSchema: z.ZodObject<{
    baseScore: z.ZodNumber;
    finalScore: z.ZodNumber;
    trustScore: z.ZodNumber;
    freshnessScore: z.ZodNumber;
    trustTier: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
    ageDays: z.ZodNumber;
    freshnessProfile: z.ZodEnum<["standard", "volatile"]>;
    freshnessHalfLifeDays: z.ZodNumber;
    matchedVolatilityIndicators: z.ZodArray<z.ZodString, "many">;
    adjustments: z.ZodArray<z.ZodObject<{
        signal: z.ZodEnum<["trust", "freshness"]>;
        basis: z.ZodEnum<["trust_tier", "last_modified", "volatile_content"]>;
        score: z.ZodNumber;
        weight: z.ZodNumber;
        baseline: z.ZodNumber;
        contribution: z.ZodNumber;
        direction: z.ZodEnum<["boost", "penalty", "neutral"]>;
    }, "strip", z.ZodTypeAny, {
        signal: "trust" | "freshness";
        basis: "trust_tier" | "last_modified" | "volatile_content";
        score: number;
        weight: number;
        baseline: number;
        contribution: number;
        direction: "boost" | "penalty" | "neutral";
    }, {
        signal: "trust" | "freshness";
        basis: "trust_tier" | "last_modified" | "volatile_content";
        score: number;
        weight: number;
        baseline: number;
        contribution: number;
        direction: "boost" | "penalty" | "neutral";
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    trustTier: "repo" | "official_docs" | "community" | "external";
    baseScore: number;
    finalScore: number;
    trustScore: number;
    freshnessScore: number;
    ageDays: number;
    freshnessProfile: "standard" | "volatile";
    freshnessHalfLifeDays: number;
    matchedVolatilityIndicators: string[];
    adjustments: {
        signal: "trust" | "freshness";
        basis: "trust_tier" | "last_modified" | "volatile_content";
        score: number;
        weight: number;
        baseline: number;
        contribution: number;
        direction: "boost" | "penalty" | "neutral";
    }[];
}, {
    trustTier: "repo" | "official_docs" | "community" | "external";
    baseScore: number;
    finalScore: number;
    trustScore: number;
    freshnessScore: number;
    ageDays: number;
    freshnessProfile: "standard" | "volatile";
    freshnessHalfLifeDays: number;
    matchedVolatilityIndicators: string[];
    adjustments: {
        signal: "trust" | "freshness";
        basis: "trust_tier" | "last_modified" | "volatile_content";
        score: number;
        weight: number;
        baseline: number;
        contribution: number;
        direction: "boost" | "penalty" | "neutral";
    }[];
}>;
export declare const rankingOptionsSchema: z.ZodObject<{
    enabled: z.ZodOptional<z.ZodBoolean>;
    trustWeight: z.ZodOptional<z.ZodNumber>;
    freshnessWeight: z.ZodOptional<z.ZodNumber>;
    trustTierScores: z.ZodOptional<z.ZodObject<{
        official_docs: z.ZodOptional<z.ZodNumber>;
        repo: z.ZodOptional<z.ZodNumber>;
        community: z.ZodOptional<z.ZodNumber>;
        external: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        repo?: number | undefined;
        official_docs?: number | undefined;
        community?: number | undefined;
        external?: number | undefined;
    }, {
        repo?: number | undefined;
        official_docs?: number | undefined;
        community?: number | undefined;
        external?: number | undefined;
    }>>;
    freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
    volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
    volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    now: z.ZodOptional<z.ZodDate>;
}, "strip", z.ZodTypeAny, {
    freshnessHalfLifeDays?: number | undefined;
    enabled?: boolean | undefined;
    trustWeight?: number | undefined;
    freshnessWeight?: number | undefined;
    trustTierScores?: {
        repo?: number | undefined;
        official_docs?: number | undefined;
        community?: number | undefined;
        external?: number | undefined;
    } | undefined;
    volatileFreshnessHalfLifeDays?: number | undefined;
    volatilityIndicators?: string[] | undefined;
    now?: Date | undefined;
}, {
    freshnessHalfLifeDays?: number | undefined;
    enabled?: boolean | undefined;
    trustWeight?: number | undefined;
    freshnessWeight?: number | undefined;
    trustTierScores?: {
        repo?: number | undefined;
        official_docs?: number | undefined;
        community?: number | undefined;
        external?: number | undefined;
    } | undefined;
    volatileFreshnessHalfLifeDays?: number | undefined;
    volatilityIndicators?: string[] | undefined;
    now?: Date | undefined;
}>;
export declare const searchResultSchema: z.ZodObject<{
    chunk: z.ZodObject<{
        id: z.ZodString;
        documentId: z.ZodString;
        content: z.ZodString;
        contentHash: z.ZodString;
        headingAnchor: z.ZodOptional<z.ZodString>;
        chunkIndex: z.ZodNumber;
        metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        embedding: z.ZodArray<z.ZodNumber, "many">;
        sourceType: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>;
        trustTier: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
        lastModified: z.ZodDate;
    }, "strip", z.ZodTypeAny, {
        id: string;
        documentId: string;
        content: string;
        contentHash: string;
        chunkIndex: number;
        metadata: Record<string, unknown>;
        embedding: number[];
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        lastModified: Date;
        headingAnchor?: string | undefined;
    }, {
        id: string;
        documentId: string;
        content: string;
        contentHash: string;
        chunkIndex: number;
        metadata: Record<string, unknown>;
        embedding: number[];
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        lastModified: Date;
        headingAnchor?: string | undefined;
    }>;
    score: z.ZodNumber;
    vectorScore: z.ZodOptional<z.ZodNumber>;
    keywordScore: z.ZodOptional<z.ZodNumber>;
    ranking: z.ZodOptional<z.ZodObject<{
        baseScore: z.ZodNumber;
        finalScore: z.ZodNumber;
        trustScore: z.ZodNumber;
        freshnessScore: z.ZodNumber;
        trustTier: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
        ageDays: z.ZodNumber;
        freshnessProfile: z.ZodEnum<["standard", "volatile"]>;
        freshnessHalfLifeDays: z.ZodNumber;
        matchedVolatilityIndicators: z.ZodArray<z.ZodString, "many">;
        adjustments: z.ZodArray<z.ZodObject<{
            signal: z.ZodEnum<["trust", "freshness"]>;
            basis: z.ZodEnum<["trust_tier", "last_modified", "volatile_content"]>;
            score: z.ZodNumber;
            weight: z.ZodNumber;
            baseline: z.ZodNumber;
            contribution: z.ZodNumber;
            direction: z.ZodEnum<["boost", "penalty", "neutral"]>;
        }, "strip", z.ZodTypeAny, {
            signal: "trust" | "freshness";
            basis: "trust_tier" | "last_modified" | "volatile_content";
            score: number;
            weight: number;
            baseline: number;
            contribution: number;
            direction: "boost" | "penalty" | "neutral";
        }, {
            signal: "trust" | "freshness";
            basis: "trust_tier" | "last_modified" | "volatile_content";
            score: number;
            weight: number;
            baseline: number;
            contribution: number;
            direction: "boost" | "penalty" | "neutral";
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        trustTier: "repo" | "official_docs" | "community" | "external";
        baseScore: number;
        finalScore: number;
        trustScore: number;
        freshnessScore: number;
        ageDays: number;
        freshnessProfile: "standard" | "volatile";
        freshnessHalfLifeDays: number;
        matchedVolatilityIndicators: string[];
        adjustments: {
            signal: "trust" | "freshness";
            basis: "trust_tier" | "last_modified" | "volatile_content";
            score: number;
            weight: number;
            baseline: number;
            contribution: number;
            direction: "boost" | "penalty" | "neutral";
        }[];
    }, {
        trustTier: "repo" | "official_docs" | "community" | "external";
        baseScore: number;
        finalScore: number;
        trustScore: number;
        freshnessScore: number;
        ageDays: number;
        freshnessProfile: "standard" | "volatile";
        freshnessHalfLifeDays: number;
        matchedVolatilityIndicators: string[];
        adjustments: {
            signal: "trust" | "freshness";
            basis: "trust_tier" | "last_modified" | "volatile_content";
            score: number;
            weight: number;
            baseline: number;
            contribution: number;
            direction: "boost" | "penalty" | "neutral";
        }[];
    }>>;
}, "strip", z.ZodTypeAny, {
    score: number;
    chunk: {
        id: string;
        documentId: string;
        content: string;
        contentHash: string;
        chunkIndex: number;
        metadata: Record<string, unknown>;
        embedding: number[];
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        lastModified: Date;
        headingAnchor?: string | undefined;
    };
    vectorScore?: number | undefined;
    keywordScore?: number | undefined;
    ranking?: {
        trustTier: "repo" | "official_docs" | "community" | "external";
        baseScore: number;
        finalScore: number;
        trustScore: number;
        freshnessScore: number;
        ageDays: number;
        freshnessProfile: "standard" | "volatile";
        freshnessHalfLifeDays: number;
        matchedVolatilityIndicators: string[];
        adjustments: {
            signal: "trust" | "freshness";
            basis: "trust_tier" | "last_modified" | "volatile_content";
            score: number;
            weight: number;
            baseline: number;
            contribution: number;
            direction: "boost" | "penalty" | "neutral";
        }[];
    } | undefined;
}, {
    score: number;
    chunk: {
        id: string;
        documentId: string;
        content: string;
        contentHash: string;
        chunkIndex: number;
        metadata: Record<string, unknown>;
        embedding: number[];
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        lastModified: Date;
        headingAnchor?: string | undefined;
    };
    vectorScore?: number | undefined;
    keywordScore?: number | undefined;
    ranking?: {
        trustTier: "repo" | "official_docs" | "community" | "external";
        baseScore: number;
        finalScore: number;
        trustScore: number;
        freshnessScore: number;
        ageDays: number;
        freshnessProfile: "standard" | "volatile";
        freshnessHalfLifeDays: number;
        matchedVolatilityIndicators: string[];
        adjustments: {
            signal: "trust" | "freshness";
            basis: "trust_tier" | "last_modified" | "volatile_content";
            score: number;
            weight: number;
            baseline: number;
            contribution: number;
            direction: "boost" | "penalty" | "neutral";
        }[];
    } | undefined;
}>;
export declare const searchOptionsSchema: z.ZodObject<{
    mode: z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>;
    topK: z.ZodOptional<z.ZodNumber>;
    vectorWeight: z.ZodOptional<z.ZodNumber>;
    keywordWeight: z.ZodOptional<z.ZodNumber>;
    filter: z.ZodOptional<z.ZodObject<{
        sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
        trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
        minDate: z.ZodOptional<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
        trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
        minDate?: Date | undefined;
    }, {
        sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
        trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
        minDate?: Date | undefined;
    }>>;
    ranking: z.ZodOptional<z.ZodObject<{
        enabled: z.ZodOptional<z.ZodBoolean>;
        trustWeight: z.ZodOptional<z.ZodNumber>;
        freshnessWeight: z.ZodOptional<z.ZodNumber>;
        trustTierScores: z.ZodOptional<z.ZodObject<{
            official_docs: z.ZodOptional<z.ZodNumber>;
            repo: z.ZodOptional<z.ZodNumber>;
            community: z.ZodOptional<z.ZodNumber>;
            external: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            repo?: number | undefined;
            official_docs?: number | undefined;
            community?: number | undefined;
            external?: number | undefined;
        }, {
            repo?: number | undefined;
            official_docs?: number | undefined;
            community?: number | undefined;
            external?: number | undefined;
        }>>;
        freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
        volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
        volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        now: z.ZodOptional<z.ZodDate>;
    }, "strip", z.ZodTypeAny, {
        freshnessHalfLifeDays?: number | undefined;
        enabled?: boolean | undefined;
        trustWeight?: number | undefined;
        freshnessWeight?: number | undefined;
        trustTierScores?: {
            repo?: number | undefined;
            official_docs?: number | undefined;
            community?: number | undefined;
            external?: number | undefined;
        } | undefined;
        volatileFreshnessHalfLifeDays?: number | undefined;
        volatilityIndicators?: string[] | undefined;
        now?: Date | undefined;
    }, {
        freshnessHalfLifeDays?: number | undefined;
        enabled?: boolean | undefined;
        trustWeight?: number | undefined;
        freshnessWeight?: number | undefined;
        trustTierScores?: {
            repo?: number | undefined;
            official_docs?: number | undefined;
            community?: number | undefined;
            external?: number | undefined;
        } | undefined;
        volatileFreshnessHalfLifeDays?: number | undefined;
        volatilityIndicators?: string[] | undefined;
        now?: Date | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    mode: "vector" | "keyword" | "hybrid";
    filter?: {
        sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
        trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
        minDate?: Date | undefined;
    } | undefined;
    ranking?: {
        freshnessHalfLifeDays?: number | undefined;
        enabled?: boolean | undefined;
        trustWeight?: number | undefined;
        freshnessWeight?: number | undefined;
        trustTierScores?: {
            repo?: number | undefined;
            official_docs?: number | undefined;
            community?: number | undefined;
            external?: number | undefined;
        } | undefined;
        volatileFreshnessHalfLifeDays?: number | undefined;
        volatilityIndicators?: string[] | undefined;
        now?: Date | undefined;
    } | undefined;
    topK?: number | undefined;
    vectorWeight?: number | undefined;
    keywordWeight?: number | undefined;
}, {
    mode: "vector" | "keyword" | "hybrid";
    filter?: {
        sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
        trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
        minDate?: Date | undefined;
    } | undefined;
    ranking?: {
        freshnessHalfLifeDays?: number | undefined;
        enabled?: boolean | undefined;
        trustWeight?: number | undefined;
        freshnessWeight?: number | undefined;
        trustTierScores?: {
            repo?: number | undefined;
            official_docs?: number | undefined;
            community?: number | undefined;
            external?: number | undefined;
        } | undefined;
        volatileFreshnessHalfLifeDays?: number | undefined;
        volatilityIndicators?: string[] | undefined;
        now?: Date | undefined;
    } | undefined;
    topK?: number | undefined;
    vectorWeight?: number | undefined;
    keywordWeight?: number | undefined;
}>;
export declare const evidenceDocumentReferenceSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    url: z.ZodOptional<z.ZodString>;
    sourcePath: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title?: string | undefined;
    url?: string | undefined;
    sourcePath?: string | undefined;
}, {
    title?: string | undefined;
    url?: string | undefined;
    sourcePath?: string | undefined;
}>;
export declare const evidenceBundleSchema: z.ZodEffects<z.ZodObject<{
    documentId: z.ZodString;
    sourceType: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>;
    title: z.ZodString;
    headingAnchor: z.ZodOptional<z.ZodString>;
    trustTier: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
    retrievalScore: z.ZodNumber;
    ranking: z.ZodOptional<z.ZodObject<{
        baseScore: z.ZodNumber;
        finalScore: z.ZodNumber;
        trustScore: z.ZodNumber;
        freshnessScore: z.ZodNumber;
        trustTier: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
        ageDays: z.ZodNumber;
        freshnessProfile: z.ZodEnum<["standard", "volatile"]>;
        freshnessHalfLifeDays: z.ZodNumber;
        matchedVolatilityIndicators: z.ZodArray<z.ZodString, "many">;
        adjustments: z.ZodArray<z.ZodObject<{
            signal: z.ZodEnum<["trust", "freshness"]>;
            basis: z.ZodEnum<["trust_tier", "last_modified", "volatile_content"]>;
            score: z.ZodNumber;
            weight: z.ZodNumber;
            baseline: z.ZodNumber;
            contribution: z.ZodNumber;
            direction: z.ZodEnum<["boost", "penalty", "neutral"]>;
        }, "strip", z.ZodTypeAny, {
            signal: "trust" | "freshness";
            basis: "trust_tier" | "last_modified" | "volatile_content";
            score: number;
            weight: number;
            baseline: number;
            contribution: number;
            direction: "boost" | "penalty" | "neutral";
        }, {
            signal: "trust" | "freshness";
            basis: "trust_tier" | "last_modified" | "volatile_content";
            score: number;
            weight: number;
            baseline: number;
            contribution: number;
            direction: "boost" | "penalty" | "neutral";
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        trustTier: "repo" | "official_docs" | "community" | "external";
        baseScore: number;
        finalScore: number;
        trustScore: number;
        freshnessScore: number;
        ageDays: number;
        freshnessProfile: "standard" | "volatile";
        freshnessHalfLifeDays: number;
        matchedVolatilityIndicators: string[];
        adjustments: {
            signal: "trust" | "freshness";
            basis: "trust_tier" | "last_modified" | "volatile_content";
            score: number;
            weight: number;
            baseline: number;
            contribution: number;
            direction: "boost" | "penalty" | "neutral";
        }[];
    }, {
        trustTier: "repo" | "official_docs" | "community" | "external";
        baseScore: number;
        finalScore: number;
        trustScore: number;
        freshnessScore: number;
        ageDays: number;
        freshnessProfile: "standard" | "volatile";
        freshnessHalfLifeDays: number;
        matchedVolatilityIndicators: string[];
        adjustments: {
            signal: "trust" | "freshness";
            basis: "trust_tier" | "last_modified" | "volatile_content";
            score: number;
            weight: number;
            baseline: number;
            contribution: number;
            direction: "boost" | "penalty" | "neutral";
        }[];
    }>>;
    supportCount: z.ZodNumber;
    supportingChunkIds: z.ZodArray<z.ZodString, "many">;
    url: z.ZodOptional<z.ZodString>;
    sourcePath: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    documentId: string;
    sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
    trustTier: "repo" | "official_docs" | "community" | "external";
    title: string;
    retrievalScore: number;
    supportCount: number;
    supportingChunkIds: string[];
    headingAnchor?: string | undefined;
    ranking?: {
        trustTier: "repo" | "official_docs" | "community" | "external";
        baseScore: number;
        finalScore: number;
        trustScore: number;
        freshnessScore: number;
        ageDays: number;
        freshnessProfile: "standard" | "volatile";
        freshnessHalfLifeDays: number;
        matchedVolatilityIndicators: string[];
        adjustments: {
            signal: "trust" | "freshness";
            basis: "trust_tier" | "last_modified" | "volatile_content";
            score: number;
            weight: number;
            baseline: number;
            contribution: number;
            direction: "boost" | "penalty" | "neutral";
        }[];
    } | undefined;
    url?: string | undefined;
    sourcePath?: string | undefined;
}, {
    documentId: string;
    sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
    trustTier: "repo" | "official_docs" | "community" | "external";
    title: string;
    retrievalScore: number;
    supportCount: number;
    supportingChunkIds: string[];
    headingAnchor?: string | undefined;
    ranking?: {
        trustTier: "repo" | "official_docs" | "community" | "external";
        baseScore: number;
        finalScore: number;
        trustScore: number;
        freshnessScore: number;
        ageDays: number;
        freshnessProfile: "standard" | "volatile";
        freshnessHalfLifeDays: number;
        matchedVolatilityIndicators: string[];
        adjustments: {
            signal: "trust" | "freshness";
            basis: "trust_tier" | "last_modified" | "volatile_content";
            score: number;
            weight: number;
            baseline: number;
            contribution: number;
            direction: "boost" | "penalty" | "neutral";
        }[];
    } | undefined;
    url?: string | undefined;
    sourcePath?: string | undefined;
}>, {
    documentId: string;
    sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
    trustTier: "repo" | "official_docs" | "community" | "external";
    title: string;
    retrievalScore: number;
    supportCount: number;
    supportingChunkIds: string[];
    headingAnchor?: string | undefined;
    ranking?: {
        trustTier: "repo" | "official_docs" | "community" | "external";
        baseScore: number;
        finalScore: number;
        trustScore: number;
        freshnessScore: number;
        ageDays: number;
        freshnessProfile: "standard" | "volatile";
        freshnessHalfLifeDays: number;
        matchedVolatilityIndicators: string[];
        adjustments: {
            signal: "trust" | "freshness";
            basis: "trust_tier" | "last_modified" | "volatile_content";
            score: number;
            weight: number;
            baseline: number;
            contribution: number;
            direction: "boost" | "penalty" | "neutral";
        }[];
    } | undefined;
    url?: string | undefined;
    sourcePath?: string | undefined;
}, {
    documentId: string;
    sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
    trustTier: "repo" | "official_docs" | "community" | "external";
    title: string;
    retrievalScore: number;
    supportCount: number;
    supportingChunkIds: string[];
    headingAnchor?: string | undefined;
    ranking?: {
        trustTier: "repo" | "official_docs" | "community" | "external";
        baseScore: number;
        finalScore: number;
        trustScore: number;
        freshnessScore: number;
        ageDays: number;
        freshnessProfile: "standard" | "volatile";
        freshnessHalfLifeDays: number;
        matchedVolatilityIndicators: string[];
        adjustments: {
            signal: "trust" | "freshness";
            basis: "trust_tier" | "last_modified" | "volatile_content";
            score: number;
            weight: number;
            baseline: number;
            contribution: number;
            direction: "boost" | "penalty" | "neutral";
        }[];
    } | undefined;
    url?: string | undefined;
    sourcePath?: string | undefined;
}>;
export declare const evidencePackOptionsSchema: z.ZodObject<{
    minEvidence: z.ZodOptional<z.ZodNumber>;
    maxEvidence: z.ZodOptional<z.ZodNumber>;
    documentsById: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodObject<{
        title: z.ZodOptional<z.ZodString>;
        url: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        title?: string | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }, {
        title?: string | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }>>>;
}, "strip", z.ZodTypeAny, {
    minEvidence?: number | undefined;
    maxEvidence?: number | undefined;
    documentsById?: Record<string, {
        title?: string | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }> | undefined;
}, {
    minEvidence?: number | undefined;
    maxEvidence?: number | undefined;
    documentsById?: Record<string, {
        title?: string | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }> | undefined;
}>;
export declare const supportQueryIntentScoresSchema: z.ZodObject<{
    install: z.ZodNumber;
    cli: z.ZodNumber;
    scripting: z.ZodNumber;
    auth: z.ZodNumber;
    pricing: z.ZodNumber;
    troubleshooting: z.ZodNumber;
    version_release: z.ZodNumber;
    unknown: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    install: number;
    cli: number;
    scripting: number;
    auth: number;
    pricing: number;
    troubleshooting: number;
    version_release: number;
    unknown: number;
}, {
    install: number;
    cli: number;
    scripting: number;
    auth: number;
    pricing: number;
    troubleshooting: number;
    version_release: number;
    unknown: number;
}>;
export declare const supportQueryClassificationSchema: z.ZodObject<{
    intent: z.ZodEnum<["install", "cli", "scripting", "auth", "pricing", "troubleshooting", "version_release", "unknown"]>;
    score: z.ZodNumber;
    matchedSignals: z.ZodArray<z.ZodString, "many">;
    scores: z.ZodObject<{
        install: z.ZodNumber;
        cli: z.ZodNumber;
        scripting: z.ZodNumber;
        auth: z.ZodNumber;
        pricing: z.ZodNumber;
        troubleshooting: z.ZodNumber;
        version_release: z.ZodNumber;
        unknown: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        install: number;
        cli: number;
        scripting: number;
        auth: number;
        pricing: number;
        troubleshooting: number;
        version_release: number;
        unknown: number;
    }, {
        install: number;
        cli: number;
        scripting: number;
        auth: number;
        pricing: number;
        troubleshooting: number;
        version_release: number;
        unknown: number;
    }>;
    isFallback: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    score: number;
    intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
    matchedSignals: string[];
    scores: {
        install: number;
        cli: number;
        scripting: number;
        auth: number;
        pricing: number;
        troubleshooting: number;
        version_release: number;
        unknown: number;
    };
    isFallback: boolean;
}, {
    score: number;
    intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
    matchedSignals: string[];
    scores: {
        install: number;
        cli: number;
        scripting: number;
        auth: number;
        pricing: number;
        troubleshooting: number;
        version_release: number;
        unknown: number;
    };
    isFallback: boolean;
}>;
export declare const supportQueryIntentTermOverridesSchema: z.ZodObject<{
    install: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    cli: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    scripting: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    auth: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    pricing: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    troubleshooting: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    version_release: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    install?: string[] | undefined;
    cli?: string[] | undefined;
    scripting?: string[] | undefined;
    auth?: string[] | undefined;
    pricing?: string[] | undefined;
    troubleshooting?: string[] | undefined;
    version_release?: string[] | undefined;
}, {
    install?: string[] | undefined;
    cli?: string[] | undefined;
    scripting?: string[] | undefined;
    auth?: string[] | undefined;
    pricing?: string[] | undefined;
    troubleshooting?: string[] | undefined;
    version_release?: string[] | undefined;
}>;
export declare const supportQueryClassifierOverrideSchema: z.ZodObject<{
    intent: z.ZodEnum<["install", "cli", "scripting", "auth", "pricing", "troubleshooting", "version_release", "unknown"]>;
    terms: z.ZodArray<z.ZodString, "many">;
    matchMode: z.ZodOptional<z.ZodEnum<["all", "any"]>>;
}, "strip", z.ZodTypeAny, {
    intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
    terms: string[];
    matchMode?: "all" | "any" | undefined;
}, {
    intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
    terms: string[];
    matchMode?: "all" | "any" | undefined;
}>;
export declare const supportQueryClassifierConfigSchema: z.ZodObject<{
    minimumScore: z.ZodOptional<z.ZodNumber>;
    minimumMargin: z.ZodOptional<z.ZodNumber>;
    overrides: z.ZodOptional<z.ZodArray<z.ZodObject<{
        intent: z.ZodEnum<["install", "cli", "scripting", "auth", "pricing", "troubleshooting", "version_release", "unknown"]>;
        terms: z.ZodArray<z.ZodString, "many">;
        matchMode: z.ZodOptional<z.ZodEnum<["all", "any"]>>;
    }, "strip", z.ZodTypeAny, {
        intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
        terms: string[];
        matchMode?: "all" | "any" | undefined;
    }, {
        intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
        terms: string[];
        matchMode?: "all" | "any" | undefined;
    }>, "many">>;
    extraTermsByIntent: z.ZodOptional<z.ZodObject<{
        install: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        cli: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        scripting: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        auth: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        pricing: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        troubleshooting: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        version_release: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        install?: string[] | undefined;
        cli?: string[] | undefined;
        scripting?: string[] | undefined;
        auth?: string[] | undefined;
        pricing?: string[] | undefined;
        troubleshooting?: string[] | undefined;
        version_release?: string[] | undefined;
    }, {
        install?: string[] | undefined;
        cli?: string[] | undefined;
        scripting?: string[] | undefined;
        auth?: string[] | undefined;
        pricing?: string[] | undefined;
        troubleshooting?: string[] | undefined;
        version_release?: string[] | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    minimumScore?: number | undefined;
    minimumMargin?: number | undefined;
    overrides?: {
        intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
        terms: string[];
        matchMode?: "all" | "any" | undefined;
    }[] | undefined;
    extraTermsByIntent?: {
        install?: string[] | undefined;
        cli?: string[] | undefined;
        scripting?: string[] | undefined;
        auth?: string[] | undefined;
        pricing?: string[] | undefined;
        troubleshooting?: string[] | undefined;
        version_release?: string[] | undefined;
    } | undefined;
}, {
    minimumScore?: number | undefined;
    minimumMargin?: number | undefined;
    overrides?: {
        intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
        terms: string[];
        matchMode?: "all" | "any" | undefined;
    }[] | undefined;
    extraTermsByIntent?: {
        install?: string[] | undefined;
        cli?: string[] | undefined;
        scripting?: string[] | undefined;
        auth?: string[] | undefined;
        pricing?: string[] | undefined;
        troubleshooting?: string[] | undefined;
        version_release?: string[] | undefined;
    } | undefined;
}>;
export declare const routedEvidenceOptionsSchema: z.ZodObject<{
    minEvidence: z.ZodOptional<z.ZodNumber>;
    maxEvidence: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    minEvidence?: number | undefined;
    maxEvidence?: number | undefined;
}, {
    minEvidence?: number | undefined;
    maxEvidence?: number | undefined;
}>;
export declare const supportQueryRoutingRuleSchema: z.ZodObject<{
    search: z.ZodObject<{
        mode: z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>;
        topK: z.ZodOptional<z.ZodNumber>;
        vectorWeight: z.ZodOptional<z.ZodNumber>;
        keywordWeight: z.ZodOptional<z.ZodNumber>;
        filter: z.ZodOptional<z.ZodObject<{
            sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
            trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
            minDate: z.ZodOptional<z.ZodDate>;
        }, "strip", z.ZodTypeAny, {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        }, {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        }>>;
        ranking: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodOptional<z.ZodBoolean>;
            trustWeight: z.ZodOptional<z.ZodNumber>;
            freshnessWeight: z.ZodOptional<z.ZodNumber>;
            trustTierScores: z.ZodOptional<z.ZodObject<{
                official_docs: z.ZodOptional<z.ZodNumber>;
                repo: z.ZodOptional<z.ZodNumber>;
                community: z.ZodOptional<z.ZodNumber>;
                external: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            }, {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            }>>;
            freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
            volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
            volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            now: z.ZodOptional<z.ZodDate>;
        }, "strip", z.ZodTypeAny, {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        }, {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        mode: "vector" | "keyword" | "hybrid";
        filter?: {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        } | undefined;
        ranking?: {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        } | undefined;
        topK?: number | undefined;
        vectorWeight?: number | undefined;
        keywordWeight?: number | undefined;
    }, {
        mode: "vector" | "keyword" | "hybrid";
        filter?: {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        } | undefined;
        ranking?: {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        } | undefined;
        topK?: number | undefined;
        vectorWeight?: number | undefined;
        keywordWeight?: number | undefined;
    }>;
    evidence: z.ZodOptional<z.ZodObject<{
        minEvidence: z.ZodOptional<z.ZodNumber>;
        maxEvidence: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        minEvidence?: number | undefined;
        maxEvidence?: number | undefined;
    }, {
        minEvidence?: number | undefined;
        maxEvidence?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    search: {
        mode: "vector" | "keyword" | "hybrid";
        filter?: {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        } | undefined;
        ranking?: {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        } | undefined;
        topK?: number | undefined;
        vectorWeight?: number | undefined;
        keywordWeight?: number | undefined;
    };
    evidence?: {
        minEvidence?: number | undefined;
        maxEvidence?: number | undefined;
    } | undefined;
}, {
    search: {
        mode: "vector" | "keyword" | "hybrid";
        filter?: {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        } | undefined;
        ranking?: {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        } | undefined;
        topK?: number | undefined;
        vectorWeight?: number | undefined;
        keywordWeight?: number | undefined;
    };
    evidence?: {
        minEvidence?: number | undefined;
        maxEvidence?: number | undefined;
    } | undefined;
}>;
export declare const supportQueryRoutingRuleOverrideSchema: z.ZodObject<{
    search: z.ZodOptional<z.ZodObject<{
        mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
        topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
            trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
            minDate: z.ZodOptional<z.ZodDate>;
        }, "strip", z.ZodTypeAny, {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        }, {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        }>>>;
        ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
            enabled: z.ZodOptional<z.ZodBoolean>;
            trustWeight: z.ZodOptional<z.ZodNumber>;
            freshnessWeight: z.ZodOptional<z.ZodNumber>;
            trustTierScores: z.ZodOptional<z.ZodObject<{
                official_docs: z.ZodOptional<z.ZodNumber>;
                repo: z.ZodOptional<z.ZodNumber>;
                community: z.ZodOptional<z.ZodNumber>;
                external: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            }, {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            }>>;
            freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
            volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
            volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            now: z.ZodOptional<z.ZodDate>;
        }, "strip", z.ZodTypeAny, {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        }, {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        filter?: {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        } | undefined;
        ranking?: {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        } | undefined;
        mode?: "vector" | "keyword" | "hybrid" | undefined;
        topK?: number | undefined;
        vectorWeight?: number | undefined;
        keywordWeight?: number | undefined;
    }, {
        filter?: {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        } | undefined;
        ranking?: {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        } | undefined;
        mode?: "vector" | "keyword" | "hybrid" | undefined;
        topK?: number | undefined;
        vectorWeight?: number | undefined;
        keywordWeight?: number | undefined;
    }>>;
    evidence: z.ZodOptional<z.ZodObject<{
        minEvidence: z.ZodOptional<z.ZodNumber>;
        maxEvidence: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        minEvidence?: number | undefined;
        maxEvidence?: number | undefined;
    }, {
        minEvidence?: number | undefined;
        maxEvidence?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    search?: {
        filter?: {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        } | undefined;
        ranking?: {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        } | undefined;
        mode?: "vector" | "keyword" | "hybrid" | undefined;
        topK?: number | undefined;
        vectorWeight?: number | undefined;
        keywordWeight?: number | undefined;
    } | undefined;
    evidence?: {
        minEvidence?: number | undefined;
        maxEvidence?: number | undefined;
    } | undefined;
}, {
    search?: {
        filter?: {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        } | undefined;
        ranking?: {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        } | undefined;
        mode?: "vector" | "keyword" | "hybrid" | undefined;
        topK?: number | undefined;
        vectorWeight?: number | undefined;
        keywordWeight?: number | undefined;
    } | undefined;
    evidence?: {
        minEvidence?: number | undefined;
        maxEvidence?: number | undefined;
    } | undefined;
}>;
export declare const supportQueryRouteOverridesSchema: z.ZodObject<{
    install: z.ZodOptional<z.ZodObject<{
        search: z.ZodOptional<z.ZodObject<{
            mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
            topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                minDate: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }>>>;
            ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                enabled: z.ZodOptional<z.ZodBoolean>;
                trustWeight: z.ZodOptional<z.ZodNumber>;
                freshnessWeight: z.ZodOptional<z.ZodNumber>;
                trustTierScores: z.ZodOptional<z.ZodObject<{
                    official_docs: z.ZodOptional<z.ZodNumber>;
                    repo: z.ZodOptional<z.ZodNumber>;
                    community: z.ZodOptional<z.ZodNumber>;
                    external: z.ZodOptional<z.ZodNumber>;
                }, "strip", z.ZodTypeAny, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }>>;
                freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                now: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }>>;
        evidence: z.ZodOptional<z.ZodObject<{
            minEvidence: z.ZodOptional<z.ZodNumber>;
            maxEvidence: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }>>;
    cli: z.ZodOptional<z.ZodObject<{
        search: z.ZodOptional<z.ZodObject<{
            mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
            topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                minDate: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }>>>;
            ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                enabled: z.ZodOptional<z.ZodBoolean>;
                trustWeight: z.ZodOptional<z.ZodNumber>;
                freshnessWeight: z.ZodOptional<z.ZodNumber>;
                trustTierScores: z.ZodOptional<z.ZodObject<{
                    official_docs: z.ZodOptional<z.ZodNumber>;
                    repo: z.ZodOptional<z.ZodNumber>;
                    community: z.ZodOptional<z.ZodNumber>;
                    external: z.ZodOptional<z.ZodNumber>;
                }, "strip", z.ZodTypeAny, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }>>;
                freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                now: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }>>;
        evidence: z.ZodOptional<z.ZodObject<{
            minEvidence: z.ZodOptional<z.ZodNumber>;
            maxEvidence: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }>>;
    scripting: z.ZodOptional<z.ZodObject<{
        search: z.ZodOptional<z.ZodObject<{
            mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
            topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                minDate: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }>>>;
            ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                enabled: z.ZodOptional<z.ZodBoolean>;
                trustWeight: z.ZodOptional<z.ZodNumber>;
                freshnessWeight: z.ZodOptional<z.ZodNumber>;
                trustTierScores: z.ZodOptional<z.ZodObject<{
                    official_docs: z.ZodOptional<z.ZodNumber>;
                    repo: z.ZodOptional<z.ZodNumber>;
                    community: z.ZodOptional<z.ZodNumber>;
                    external: z.ZodOptional<z.ZodNumber>;
                }, "strip", z.ZodTypeAny, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }>>;
                freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                now: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }>>;
        evidence: z.ZodOptional<z.ZodObject<{
            minEvidence: z.ZodOptional<z.ZodNumber>;
            maxEvidence: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }>>;
    auth: z.ZodOptional<z.ZodObject<{
        search: z.ZodOptional<z.ZodObject<{
            mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
            topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                minDate: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }>>>;
            ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                enabled: z.ZodOptional<z.ZodBoolean>;
                trustWeight: z.ZodOptional<z.ZodNumber>;
                freshnessWeight: z.ZodOptional<z.ZodNumber>;
                trustTierScores: z.ZodOptional<z.ZodObject<{
                    official_docs: z.ZodOptional<z.ZodNumber>;
                    repo: z.ZodOptional<z.ZodNumber>;
                    community: z.ZodOptional<z.ZodNumber>;
                    external: z.ZodOptional<z.ZodNumber>;
                }, "strip", z.ZodTypeAny, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }>>;
                freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                now: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }>>;
        evidence: z.ZodOptional<z.ZodObject<{
            minEvidence: z.ZodOptional<z.ZodNumber>;
            maxEvidence: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }>>;
    pricing: z.ZodOptional<z.ZodObject<{
        search: z.ZodOptional<z.ZodObject<{
            mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
            topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                minDate: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }>>>;
            ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                enabled: z.ZodOptional<z.ZodBoolean>;
                trustWeight: z.ZodOptional<z.ZodNumber>;
                freshnessWeight: z.ZodOptional<z.ZodNumber>;
                trustTierScores: z.ZodOptional<z.ZodObject<{
                    official_docs: z.ZodOptional<z.ZodNumber>;
                    repo: z.ZodOptional<z.ZodNumber>;
                    community: z.ZodOptional<z.ZodNumber>;
                    external: z.ZodOptional<z.ZodNumber>;
                }, "strip", z.ZodTypeAny, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }>>;
                freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                now: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }>>;
        evidence: z.ZodOptional<z.ZodObject<{
            minEvidence: z.ZodOptional<z.ZodNumber>;
            maxEvidence: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }>>;
    troubleshooting: z.ZodOptional<z.ZodObject<{
        search: z.ZodOptional<z.ZodObject<{
            mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
            topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                minDate: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }>>>;
            ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                enabled: z.ZodOptional<z.ZodBoolean>;
                trustWeight: z.ZodOptional<z.ZodNumber>;
                freshnessWeight: z.ZodOptional<z.ZodNumber>;
                trustTierScores: z.ZodOptional<z.ZodObject<{
                    official_docs: z.ZodOptional<z.ZodNumber>;
                    repo: z.ZodOptional<z.ZodNumber>;
                    community: z.ZodOptional<z.ZodNumber>;
                    external: z.ZodOptional<z.ZodNumber>;
                }, "strip", z.ZodTypeAny, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }>>;
                freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                now: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }>>;
        evidence: z.ZodOptional<z.ZodObject<{
            minEvidence: z.ZodOptional<z.ZodNumber>;
            maxEvidence: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }>>;
    version_release: z.ZodOptional<z.ZodObject<{
        search: z.ZodOptional<z.ZodObject<{
            mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
            topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                minDate: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }>>>;
            ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                enabled: z.ZodOptional<z.ZodBoolean>;
                trustWeight: z.ZodOptional<z.ZodNumber>;
                freshnessWeight: z.ZodOptional<z.ZodNumber>;
                trustTierScores: z.ZodOptional<z.ZodObject<{
                    official_docs: z.ZodOptional<z.ZodNumber>;
                    repo: z.ZodOptional<z.ZodNumber>;
                    community: z.ZodOptional<z.ZodNumber>;
                    external: z.ZodOptional<z.ZodNumber>;
                }, "strip", z.ZodTypeAny, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }>>;
                freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                now: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }>>;
        evidence: z.ZodOptional<z.ZodObject<{
            minEvidence: z.ZodOptional<z.ZodNumber>;
            maxEvidence: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }>>;
    unknown: z.ZodOptional<z.ZodObject<{
        search: z.ZodOptional<z.ZodObject<{
            mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
            topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
            filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                minDate: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }, {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            }>>>;
            ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                enabled: z.ZodOptional<z.ZodBoolean>;
                trustWeight: z.ZodOptional<z.ZodNumber>;
                freshnessWeight: z.ZodOptional<z.ZodNumber>;
                trustTierScores: z.ZodOptional<z.ZodObject<{
                    official_docs: z.ZodOptional<z.ZodNumber>;
                    repo: z.ZodOptional<z.ZodNumber>;
                    community: z.ZodOptional<z.ZodNumber>;
                    external: z.ZodOptional<z.ZodNumber>;
                }, "strip", z.ZodTypeAny, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }, {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                }>>;
                freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                now: z.ZodOptional<z.ZodDate>;
            }, "strip", z.ZodTypeAny, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }, {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            }>>>;
        }, "strip", z.ZodTypeAny, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }, {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        }>>;
        evidence: z.ZodOptional<z.ZodObject<{
            minEvidence: z.ZodOptional<z.ZodNumber>;
            maxEvidence: z.ZodOptional<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }, {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }, {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    install?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
    cli?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
    scripting?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
    auth?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
    pricing?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
    troubleshooting?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
    version_release?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
    unknown?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
}, {
    install?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
    cli?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
    scripting?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
    auth?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
    pricing?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
    troubleshooting?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
    version_release?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
    unknown?: {
        search?: {
            filter?: {
                sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                minDate?: Date | undefined;
            } | undefined;
            ranking?: {
                freshnessHalfLifeDays?: number | undefined;
                enabled?: boolean | undefined;
                trustWeight?: number | undefined;
                freshnessWeight?: number | undefined;
                trustTierScores?: {
                    repo?: number | undefined;
                    official_docs?: number | undefined;
                    community?: number | undefined;
                    external?: number | undefined;
                } | undefined;
                volatileFreshnessHalfLifeDays?: number | undefined;
                volatilityIndicators?: string[] | undefined;
                now?: Date | undefined;
            } | undefined;
            mode?: "vector" | "keyword" | "hybrid" | undefined;
            topK?: number | undefined;
            vectorWeight?: number | undefined;
            keywordWeight?: number | undefined;
        } | undefined;
        evidence?: {
            minEvidence?: number | undefined;
            maxEvidence?: number | undefined;
        } | undefined;
    } | undefined;
}>;
export declare const supportQueryRoutingConfigSchema: z.ZodObject<{
    classifier: z.ZodOptional<z.ZodObject<{
        minimumScore: z.ZodOptional<z.ZodNumber>;
        minimumMargin: z.ZodOptional<z.ZodNumber>;
        overrides: z.ZodOptional<z.ZodArray<z.ZodObject<{
            intent: z.ZodEnum<["install", "cli", "scripting", "auth", "pricing", "troubleshooting", "version_release", "unknown"]>;
            terms: z.ZodArray<z.ZodString, "many">;
            matchMode: z.ZodOptional<z.ZodEnum<["all", "any"]>>;
        }, "strip", z.ZodTypeAny, {
            intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
            terms: string[];
            matchMode?: "all" | "any" | undefined;
        }, {
            intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
            terms: string[];
            matchMode?: "all" | "any" | undefined;
        }>, "many">>;
        extraTermsByIntent: z.ZodOptional<z.ZodObject<{
            install: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            cli: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            scripting: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            auth: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            pricing: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            troubleshooting: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            version_release: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            install?: string[] | undefined;
            cli?: string[] | undefined;
            scripting?: string[] | undefined;
            auth?: string[] | undefined;
            pricing?: string[] | undefined;
            troubleshooting?: string[] | undefined;
            version_release?: string[] | undefined;
        }, {
            install?: string[] | undefined;
            cli?: string[] | undefined;
            scripting?: string[] | undefined;
            auth?: string[] | undefined;
            pricing?: string[] | undefined;
            troubleshooting?: string[] | undefined;
            version_release?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        minimumScore?: number | undefined;
        minimumMargin?: number | undefined;
        overrides?: {
            intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
            terms: string[];
            matchMode?: "all" | "any" | undefined;
        }[] | undefined;
        extraTermsByIntent?: {
            install?: string[] | undefined;
            cli?: string[] | undefined;
            scripting?: string[] | undefined;
            auth?: string[] | undefined;
            pricing?: string[] | undefined;
            troubleshooting?: string[] | undefined;
            version_release?: string[] | undefined;
        } | undefined;
    }, {
        minimumScore?: number | undefined;
        minimumMargin?: number | undefined;
        overrides?: {
            intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
            terms: string[];
            matchMode?: "all" | "any" | undefined;
        }[] | undefined;
        extraTermsByIntent?: {
            install?: string[] | undefined;
            cli?: string[] | undefined;
            scripting?: string[] | undefined;
            auth?: string[] | undefined;
            pricing?: string[] | undefined;
            troubleshooting?: string[] | undefined;
            version_release?: string[] | undefined;
        } | undefined;
    }>>;
    routeOverrides: z.ZodOptional<z.ZodObject<{
        install: z.ZodOptional<z.ZodObject<{
            search: z.ZodOptional<z.ZodObject<{
                mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
                topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                    trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                    minDate: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }>>>;
                ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    trustWeight: z.ZodOptional<z.ZodNumber>;
                    freshnessWeight: z.ZodOptional<z.ZodNumber>;
                    trustTierScores: z.ZodOptional<z.ZodObject<{
                        official_docs: z.ZodOptional<z.ZodNumber>;
                        repo: z.ZodOptional<z.ZodNumber>;
                        community: z.ZodOptional<z.ZodNumber>;
                        external: z.ZodOptional<z.ZodNumber>;
                    }, "strip", z.ZodTypeAny, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }>>;
                    freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    now: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }>>>;
            }, "strip", z.ZodTypeAny, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }>>;
            evidence: z.ZodOptional<z.ZodObject<{
                minEvidence: z.ZodOptional<z.ZodNumber>;
                maxEvidence: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }>>;
        cli: z.ZodOptional<z.ZodObject<{
            search: z.ZodOptional<z.ZodObject<{
                mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
                topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                    trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                    minDate: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }>>>;
                ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    trustWeight: z.ZodOptional<z.ZodNumber>;
                    freshnessWeight: z.ZodOptional<z.ZodNumber>;
                    trustTierScores: z.ZodOptional<z.ZodObject<{
                        official_docs: z.ZodOptional<z.ZodNumber>;
                        repo: z.ZodOptional<z.ZodNumber>;
                        community: z.ZodOptional<z.ZodNumber>;
                        external: z.ZodOptional<z.ZodNumber>;
                    }, "strip", z.ZodTypeAny, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }>>;
                    freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    now: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }>>>;
            }, "strip", z.ZodTypeAny, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }>>;
            evidence: z.ZodOptional<z.ZodObject<{
                minEvidence: z.ZodOptional<z.ZodNumber>;
                maxEvidence: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }>>;
        scripting: z.ZodOptional<z.ZodObject<{
            search: z.ZodOptional<z.ZodObject<{
                mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
                topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                    trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                    minDate: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }>>>;
                ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    trustWeight: z.ZodOptional<z.ZodNumber>;
                    freshnessWeight: z.ZodOptional<z.ZodNumber>;
                    trustTierScores: z.ZodOptional<z.ZodObject<{
                        official_docs: z.ZodOptional<z.ZodNumber>;
                        repo: z.ZodOptional<z.ZodNumber>;
                        community: z.ZodOptional<z.ZodNumber>;
                        external: z.ZodOptional<z.ZodNumber>;
                    }, "strip", z.ZodTypeAny, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }>>;
                    freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    now: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }>>>;
            }, "strip", z.ZodTypeAny, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }>>;
            evidence: z.ZodOptional<z.ZodObject<{
                minEvidence: z.ZodOptional<z.ZodNumber>;
                maxEvidence: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }>>;
        auth: z.ZodOptional<z.ZodObject<{
            search: z.ZodOptional<z.ZodObject<{
                mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
                topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                    trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                    minDate: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }>>>;
                ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    trustWeight: z.ZodOptional<z.ZodNumber>;
                    freshnessWeight: z.ZodOptional<z.ZodNumber>;
                    trustTierScores: z.ZodOptional<z.ZodObject<{
                        official_docs: z.ZodOptional<z.ZodNumber>;
                        repo: z.ZodOptional<z.ZodNumber>;
                        community: z.ZodOptional<z.ZodNumber>;
                        external: z.ZodOptional<z.ZodNumber>;
                    }, "strip", z.ZodTypeAny, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }>>;
                    freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    now: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }>>>;
            }, "strip", z.ZodTypeAny, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }>>;
            evidence: z.ZodOptional<z.ZodObject<{
                minEvidence: z.ZodOptional<z.ZodNumber>;
                maxEvidence: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }>>;
        pricing: z.ZodOptional<z.ZodObject<{
            search: z.ZodOptional<z.ZodObject<{
                mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
                topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                    trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                    minDate: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }>>>;
                ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    trustWeight: z.ZodOptional<z.ZodNumber>;
                    freshnessWeight: z.ZodOptional<z.ZodNumber>;
                    trustTierScores: z.ZodOptional<z.ZodObject<{
                        official_docs: z.ZodOptional<z.ZodNumber>;
                        repo: z.ZodOptional<z.ZodNumber>;
                        community: z.ZodOptional<z.ZodNumber>;
                        external: z.ZodOptional<z.ZodNumber>;
                    }, "strip", z.ZodTypeAny, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }>>;
                    freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    now: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }>>>;
            }, "strip", z.ZodTypeAny, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }>>;
            evidence: z.ZodOptional<z.ZodObject<{
                minEvidence: z.ZodOptional<z.ZodNumber>;
                maxEvidence: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }>>;
        troubleshooting: z.ZodOptional<z.ZodObject<{
            search: z.ZodOptional<z.ZodObject<{
                mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
                topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                    trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                    minDate: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }>>>;
                ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    trustWeight: z.ZodOptional<z.ZodNumber>;
                    freshnessWeight: z.ZodOptional<z.ZodNumber>;
                    trustTierScores: z.ZodOptional<z.ZodObject<{
                        official_docs: z.ZodOptional<z.ZodNumber>;
                        repo: z.ZodOptional<z.ZodNumber>;
                        community: z.ZodOptional<z.ZodNumber>;
                        external: z.ZodOptional<z.ZodNumber>;
                    }, "strip", z.ZodTypeAny, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }>>;
                    freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    now: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }>>>;
            }, "strip", z.ZodTypeAny, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }>>;
            evidence: z.ZodOptional<z.ZodObject<{
                minEvidence: z.ZodOptional<z.ZodNumber>;
                maxEvidence: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }>>;
        version_release: z.ZodOptional<z.ZodObject<{
            search: z.ZodOptional<z.ZodObject<{
                mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
                topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                    trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                    minDate: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }>>>;
                ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    trustWeight: z.ZodOptional<z.ZodNumber>;
                    freshnessWeight: z.ZodOptional<z.ZodNumber>;
                    trustTierScores: z.ZodOptional<z.ZodObject<{
                        official_docs: z.ZodOptional<z.ZodNumber>;
                        repo: z.ZodOptional<z.ZodNumber>;
                        community: z.ZodOptional<z.ZodNumber>;
                        external: z.ZodOptional<z.ZodNumber>;
                    }, "strip", z.ZodTypeAny, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }>>;
                    freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    now: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }>>>;
            }, "strip", z.ZodTypeAny, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }>>;
            evidence: z.ZodOptional<z.ZodObject<{
                minEvidence: z.ZodOptional<z.ZodNumber>;
                maxEvidence: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }>>;
        unknown: z.ZodOptional<z.ZodObject<{
            search: z.ZodOptional<z.ZodObject<{
                mode: z.ZodOptional<z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>>;
                topK: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                vectorWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                keywordWeight: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
                filter: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
                    trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
                    minDate: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }, {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                }>>>;
                ranking: z.ZodOptional<z.ZodOptional<z.ZodObject<{
                    enabled: z.ZodOptional<z.ZodBoolean>;
                    trustWeight: z.ZodOptional<z.ZodNumber>;
                    freshnessWeight: z.ZodOptional<z.ZodNumber>;
                    trustTierScores: z.ZodOptional<z.ZodObject<{
                        official_docs: z.ZodOptional<z.ZodNumber>;
                        repo: z.ZodOptional<z.ZodNumber>;
                        community: z.ZodOptional<z.ZodNumber>;
                        external: z.ZodOptional<z.ZodNumber>;
                    }, "strip", z.ZodTypeAny, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }, {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    }>>;
                    freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
                    volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
                    now: z.ZodOptional<z.ZodDate>;
                }, "strip", z.ZodTypeAny, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }, {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                }>>>;
            }, "strip", z.ZodTypeAny, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }, {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            }>>;
            evidence: z.ZodOptional<z.ZodObject<{
                minEvidence: z.ZodOptional<z.ZodNumber>;
                maxEvidence: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }, {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }, {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        install?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        cli?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        scripting?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        auth?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        pricing?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        troubleshooting?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        version_release?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        unknown?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
    }, {
        install?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        cli?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        scripting?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        auth?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        pricing?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        troubleshooting?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        version_release?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        unknown?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    classifier?: {
        minimumScore?: number | undefined;
        minimumMargin?: number | undefined;
        overrides?: {
            intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
            terms: string[];
            matchMode?: "all" | "any" | undefined;
        }[] | undefined;
        extraTermsByIntent?: {
            install?: string[] | undefined;
            cli?: string[] | undefined;
            scripting?: string[] | undefined;
            auth?: string[] | undefined;
            pricing?: string[] | undefined;
            troubleshooting?: string[] | undefined;
            version_release?: string[] | undefined;
        } | undefined;
    } | undefined;
    routeOverrides?: {
        install?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        cli?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        scripting?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        auth?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        pricing?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        troubleshooting?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        version_release?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        unknown?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
    } | undefined;
}, {
    classifier?: {
        minimumScore?: number | undefined;
        minimumMargin?: number | undefined;
        overrides?: {
            intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
            terms: string[];
            matchMode?: "all" | "any" | undefined;
        }[] | undefined;
        extraTermsByIntent?: {
            install?: string[] | undefined;
            cli?: string[] | undefined;
            scripting?: string[] | undefined;
            auth?: string[] | undefined;
            pricing?: string[] | undefined;
            troubleshooting?: string[] | undefined;
            version_release?: string[] | undefined;
        } | undefined;
    } | undefined;
    routeOverrides?: {
        install?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        cli?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        scripting?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        auth?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        pricing?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        troubleshooting?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        version_release?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
        unknown?: {
            search?: {
                filter?: {
                    sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
                    trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
                    minDate?: Date | undefined;
                } | undefined;
                ranking?: {
                    freshnessHalfLifeDays?: number | undefined;
                    enabled?: boolean | undefined;
                    trustWeight?: number | undefined;
                    freshnessWeight?: number | undefined;
                    trustTierScores?: {
                        repo?: number | undefined;
                        official_docs?: number | undefined;
                        community?: number | undefined;
                        external?: number | undefined;
                    } | undefined;
                    volatileFreshnessHalfLifeDays?: number | undefined;
                    volatilityIndicators?: string[] | undefined;
                    now?: Date | undefined;
                } | undefined;
                mode?: "vector" | "keyword" | "hybrid" | undefined;
                topK?: number | undefined;
                vectorWeight?: number | undefined;
                keywordWeight?: number | undefined;
            } | undefined;
            evidence?: {
                minEvidence?: number | undefined;
                maxEvidence?: number | undefined;
            } | undefined;
        } | undefined;
    } | undefined;
}>;
export declare const supportQueryRoutePlanSchema: z.ZodObject<{
    query: z.ZodString;
    intent: z.ZodEnum<["install", "cli", "scripting", "auth", "pricing", "troubleshooting", "version_release", "unknown"]>;
    classification: z.ZodObject<{
        intent: z.ZodEnum<["install", "cli", "scripting", "auth", "pricing", "troubleshooting", "version_release", "unknown"]>;
        score: z.ZodNumber;
        matchedSignals: z.ZodArray<z.ZodString, "many">;
        scores: z.ZodObject<{
            install: z.ZodNumber;
            cli: z.ZodNumber;
            scripting: z.ZodNumber;
            auth: z.ZodNumber;
            pricing: z.ZodNumber;
            troubleshooting: z.ZodNumber;
            version_release: z.ZodNumber;
            unknown: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            install: number;
            cli: number;
            scripting: number;
            auth: number;
            pricing: number;
            troubleshooting: number;
            version_release: number;
            unknown: number;
        }, {
            install: number;
            cli: number;
            scripting: number;
            auth: number;
            pricing: number;
            troubleshooting: number;
            version_release: number;
            unknown: number;
        }>;
        isFallback: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        score: number;
        intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
        matchedSignals: string[];
        scores: {
            install: number;
            cli: number;
            scripting: number;
            auth: number;
            pricing: number;
            troubleshooting: number;
            version_release: number;
            unknown: number;
        };
        isFallback: boolean;
    }, {
        score: number;
        intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
        matchedSignals: string[];
        scores: {
            install: number;
            cli: number;
            scripting: number;
            auth: number;
            pricing: number;
            troubleshooting: number;
            version_release: number;
            unknown: number;
        };
        isFallback: boolean;
    }>;
    search: z.ZodObject<{
        mode: z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>;
        topK: z.ZodOptional<z.ZodNumber>;
        vectorWeight: z.ZodOptional<z.ZodNumber>;
        keywordWeight: z.ZodOptional<z.ZodNumber>;
        filter: z.ZodOptional<z.ZodObject<{
            sourceTypes: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>, "many">>;
            trustTiers: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>, "many">>;
            minDate: z.ZodOptional<z.ZodDate>;
        }, "strip", z.ZodTypeAny, {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        }, {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        }>>;
        ranking: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodOptional<z.ZodBoolean>;
            trustWeight: z.ZodOptional<z.ZodNumber>;
            freshnessWeight: z.ZodOptional<z.ZodNumber>;
            trustTierScores: z.ZodOptional<z.ZodObject<{
                official_docs: z.ZodOptional<z.ZodNumber>;
                repo: z.ZodOptional<z.ZodNumber>;
                community: z.ZodOptional<z.ZodNumber>;
                external: z.ZodOptional<z.ZodNumber>;
            }, "strip", z.ZodTypeAny, {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            }, {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            }>>;
            freshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
            volatileFreshnessHalfLifeDays: z.ZodOptional<z.ZodNumber>;
            volatilityIndicators: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            now: z.ZodOptional<z.ZodDate>;
        }, "strip", z.ZodTypeAny, {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        }, {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        mode: "vector" | "keyword" | "hybrid";
        filter?: {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        } | undefined;
        ranking?: {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        } | undefined;
        topK?: number | undefined;
        vectorWeight?: number | undefined;
        keywordWeight?: number | undefined;
    }, {
        mode: "vector" | "keyword" | "hybrid";
        filter?: {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        } | undefined;
        ranking?: {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        } | undefined;
        topK?: number | undefined;
        vectorWeight?: number | undefined;
        keywordWeight?: number | undefined;
    }>;
    evidence: z.ZodOptional<z.ZodObject<{
        minEvidence: z.ZodOptional<z.ZodNumber>;
        maxEvidence: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        minEvidence?: number | undefined;
        maxEvidence?: number | undefined;
    }, {
        minEvidence?: number | undefined;
        maxEvidence?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
    search: {
        mode: "vector" | "keyword" | "hybrid";
        filter?: {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        } | undefined;
        ranking?: {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        } | undefined;
        topK?: number | undefined;
        vectorWeight?: number | undefined;
        keywordWeight?: number | undefined;
    };
    query: string;
    classification: {
        score: number;
        intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
        matchedSignals: string[];
        scores: {
            install: number;
            cli: number;
            scripting: number;
            auth: number;
            pricing: number;
            troubleshooting: number;
            version_release: number;
            unknown: number;
        };
        isFallback: boolean;
    };
    evidence?: {
        minEvidence?: number | undefined;
        maxEvidence?: number | undefined;
    } | undefined;
}, {
    intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
    search: {
        mode: "vector" | "keyword" | "hybrid";
        filter?: {
            sourceTypes?: ("repo" | "docs_site" | "website" | "github" | "stackoverflow")[] | undefined;
            trustTiers?: ("repo" | "official_docs" | "community" | "external")[] | undefined;
            minDate?: Date | undefined;
        } | undefined;
        ranking?: {
            freshnessHalfLifeDays?: number | undefined;
            enabled?: boolean | undefined;
            trustWeight?: number | undefined;
            freshnessWeight?: number | undefined;
            trustTierScores?: {
                repo?: number | undefined;
                official_docs?: number | undefined;
                community?: number | undefined;
                external?: number | undefined;
            } | undefined;
            volatileFreshnessHalfLifeDays?: number | undefined;
            volatilityIndicators?: string[] | undefined;
            now?: Date | undefined;
        } | undefined;
        topK?: number | undefined;
        vectorWeight?: number | undefined;
        keywordWeight?: number | undefined;
    };
    query: string;
    classification: {
        score: number;
        intent: "install" | "cli" | "scripting" | "auth" | "pricing" | "troubleshooting" | "version_release" | "unknown";
        matchedSignals: string[];
        scores: {
            install: number;
            cli: number;
            scripting: number;
            auth: number;
            pricing: number;
            troubleshooting: number;
            version_release: number;
            unknown: number;
        };
        isFallback: boolean;
    };
    evidence?: {
        minEvidence?: number | undefined;
        maxEvidence?: number | undefined;
    } | undefined;
}>;
export declare const readyEvidencePackResultSchema: z.ZodObject<{
    status: z.ZodLiteral<"ready">;
    evidence: z.ZodArray<z.ZodEffects<z.ZodObject<{
        documentId: z.ZodString;
        sourceType: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>;
        title: z.ZodString;
        headingAnchor: z.ZodOptional<z.ZodString>;
        trustTier: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
        retrievalScore: z.ZodNumber;
        ranking: z.ZodOptional<z.ZodObject<{
            baseScore: z.ZodNumber;
            finalScore: z.ZodNumber;
            trustScore: z.ZodNumber;
            freshnessScore: z.ZodNumber;
            trustTier: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
            ageDays: z.ZodNumber;
            freshnessProfile: z.ZodEnum<["standard", "volatile"]>;
            freshnessHalfLifeDays: z.ZodNumber;
            matchedVolatilityIndicators: z.ZodArray<z.ZodString, "many">;
            adjustments: z.ZodArray<z.ZodObject<{
                signal: z.ZodEnum<["trust", "freshness"]>;
                basis: z.ZodEnum<["trust_tier", "last_modified", "volatile_content"]>;
                score: z.ZodNumber;
                weight: z.ZodNumber;
                baseline: z.ZodNumber;
                contribution: z.ZodNumber;
                direction: z.ZodEnum<["boost", "penalty", "neutral"]>;
            }, "strip", z.ZodTypeAny, {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }, {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        }, {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        }>>;
        supportCount: z.ZodNumber;
        supportingChunkIds: z.ZodArray<z.ZodString, "many">;
        url: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }>, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }>, "many">;
    totalHits: z.ZodNumber;
    packedEvidenceCount: z.ZodNumber;
    minEvidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "ready";
    minEvidence: number;
    evidence: {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }[];
    totalHits: number;
    packedEvidenceCount: number;
}, {
    status: "ready";
    minEvidence: number;
    evidence: {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }[];
    totalHits: number;
    packedEvidenceCount: number;
}>;
export declare const insufficientEvidencePackResultSchema: z.ZodObject<{
    status: z.ZodLiteral<"insufficient_evidence">;
    reason: z.ZodLiteral<"below_minimum_evidence">;
    evidence: z.ZodArray<z.ZodEffects<z.ZodObject<{
        documentId: z.ZodString;
        sourceType: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>;
        title: z.ZodString;
        headingAnchor: z.ZodOptional<z.ZodString>;
        trustTier: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
        retrievalScore: z.ZodNumber;
        ranking: z.ZodOptional<z.ZodObject<{
            baseScore: z.ZodNumber;
            finalScore: z.ZodNumber;
            trustScore: z.ZodNumber;
            freshnessScore: z.ZodNumber;
            trustTier: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
            ageDays: z.ZodNumber;
            freshnessProfile: z.ZodEnum<["standard", "volatile"]>;
            freshnessHalfLifeDays: z.ZodNumber;
            matchedVolatilityIndicators: z.ZodArray<z.ZodString, "many">;
            adjustments: z.ZodArray<z.ZodObject<{
                signal: z.ZodEnum<["trust", "freshness"]>;
                basis: z.ZodEnum<["trust_tier", "last_modified", "volatile_content"]>;
                score: z.ZodNumber;
                weight: z.ZodNumber;
                baseline: z.ZodNumber;
                contribution: z.ZodNumber;
                direction: z.ZodEnum<["boost", "penalty", "neutral"]>;
            }, "strip", z.ZodTypeAny, {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }, {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        }, {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        }>>;
        supportCount: z.ZodNumber;
        supportingChunkIds: z.ZodArray<z.ZodString, "many">;
        url: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }>, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }>, "many">;
    totalHits: z.ZodNumber;
    packedEvidenceCount: z.ZodNumber;
    minEvidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "insufficient_evidence";
    minEvidence: number;
    evidence: {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }[];
    totalHits: number;
    packedEvidenceCount: number;
    reason: "below_minimum_evidence";
}, {
    status: "insufficient_evidence";
    minEvidence: number;
    evidence: {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }[];
    totalHits: number;
    packedEvidenceCount: number;
    reason: "below_minimum_evidence";
}>;
export declare const evidencePackResultSchema: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
    status: z.ZodLiteral<"ready">;
    evidence: z.ZodArray<z.ZodEffects<z.ZodObject<{
        documentId: z.ZodString;
        sourceType: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>;
        title: z.ZodString;
        headingAnchor: z.ZodOptional<z.ZodString>;
        trustTier: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
        retrievalScore: z.ZodNumber;
        ranking: z.ZodOptional<z.ZodObject<{
            baseScore: z.ZodNumber;
            finalScore: z.ZodNumber;
            trustScore: z.ZodNumber;
            freshnessScore: z.ZodNumber;
            trustTier: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
            ageDays: z.ZodNumber;
            freshnessProfile: z.ZodEnum<["standard", "volatile"]>;
            freshnessHalfLifeDays: z.ZodNumber;
            matchedVolatilityIndicators: z.ZodArray<z.ZodString, "many">;
            adjustments: z.ZodArray<z.ZodObject<{
                signal: z.ZodEnum<["trust", "freshness"]>;
                basis: z.ZodEnum<["trust_tier", "last_modified", "volatile_content"]>;
                score: z.ZodNumber;
                weight: z.ZodNumber;
                baseline: z.ZodNumber;
                contribution: z.ZodNumber;
                direction: z.ZodEnum<["boost", "penalty", "neutral"]>;
            }, "strip", z.ZodTypeAny, {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }, {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        }, {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        }>>;
        supportCount: z.ZodNumber;
        supportingChunkIds: z.ZodArray<z.ZodString, "many">;
        url: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }>, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }>, "many">;
    totalHits: z.ZodNumber;
    packedEvidenceCount: z.ZodNumber;
    minEvidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "ready";
    minEvidence: number;
    evidence: {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }[];
    totalHits: number;
    packedEvidenceCount: number;
}, {
    status: "ready";
    minEvidence: number;
    evidence: {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }[];
    totalHits: number;
    packedEvidenceCount: number;
}>, z.ZodObject<{
    status: z.ZodLiteral<"insufficient_evidence">;
    reason: z.ZodLiteral<"below_minimum_evidence">;
    evidence: z.ZodArray<z.ZodEffects<z.ZodObject<{
        documentId: z.ZodString;
        sourceType: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>;
        title: z.ZodString;
        headingAnchor: z.ZodOptional<z.ZodString>;
        trustTier: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
        retrievalScore: z.ZodNumber;
        ranking: z.ZodOptional<z.ZodObject<{
            baseScore: z.ZodNumber;
            finalScore: z.ZodNumber;
            trustScore: z.ZodNumber;
            freshnessScore: z.ZodNumber;
            trustTier: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
            ageDays: z.ZodNumber;
            freshnessProfile: z.ZodEnum<["standard", "volatile"]>;
            freshnessHalfLifeDays: z.ZodNumber;
            matchedVolatilityIndicators: z.ZodArray<z.ZodString, "many">;
            adjustments: z.ZodArray<z.ZodObject<{
                signal: z.ZodEnum<["trust", "freshness"]>;
                basis: z.ZodEnum<["trust_tier", "last_modified", "volatile_content"]>;
                score: z.ZodNumber;
                weight: z.ZodNumber;
                baseline: z.ZodNumber;
                contribution: z.ZodNumber;
                direction: z.ZodEnum<["boost", "penalty", "neutral"]>;
            }, "strip", z.ZodTypeAny, {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }, {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        }, {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        }>>;
        supportCount: z.ZodNumber;
        supportingChunkIds: z.ZodArray<z.ZodString, "many">;
        url: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }>, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }, {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }>, "many">;
    totalHits: z.ZodNumber;
    packedEvidenceCount: z.ZodNumber;
    minEvidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    status: "insufficient_evidence";
    minEvidence: number;
    evidence: {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }[];
    totalHits: number;
    packedEvidenceCount: number;
    reason: "below_minimum_evidence";
}, {
    status: "insufficient_evidence";
    minEvidence: number;
    evidence: {
        documentId: string;
        sourceType: "repo" | "docs_site" | "website" | "github" | "stackoverflow";
        trustTier: "repo" | "official_docs" | "community" | "external";
        title: string;
        retrievalScore: number;
        supportCount: number;
        supportingChunkIds: string[];
        headingAnchor?: string | undefined;
        ranking?: {
            trustTier: "repo" | "official_docs" | "community" | "external";
            baseScore: number;
            finalScore: number;
            trustScore: number;
            freshnessScore: number;
            ageDays: number;
            freshnessProfile: "standard" | "volatile";
            freshnessHalfLifeDays: number;
            matchedVolatilityIndicators: string[];
            adjustments: {
                signal: "trust" | "freshness";
                basis: "trust_tier" | "last_modified" | "volatile_content";
                score: number;
                weight: number;
                baseline: number;
                contribution: number;
                direction: "boost" | "penalty" | "neutral";
            }[];
        } | undefined;
        url?: string | undefined;
        sourcePath?: string | undefined;
    }[];
    totalHits: number;
    packedEvidenceCount: number;
    reason: "below_minimum_evidence";
}>]>;
