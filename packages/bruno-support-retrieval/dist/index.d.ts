import { z } from 'zod';

declare const DEFAULT_TOP_K = 10;
declare const DEFAULT_VECTOR_WEIGHT = 0.7;
declare const DEFAULT_KEYWORD_WEIGHT = 0.3;
declare const DEFAULT_TRUST_WEIGHT = 0.2;
declare const DEFAULT_FRESHNESS_WEIGHT = 0.15;
declare const DEFAULT_FRESHNESS_HALF_LIFE_DAYS = 180;
declare const DEFAULT_VOLATILE_FRESHNESS_HALF_LIFE_DAYS = 30;
declare const DEFAULT_MIN_EVIDENCE = 2;
declare const indexedChunkSourceTypes: readonly ["repo", "docs_site", "website", "github", "stackoverflow"];
declare const indexedChunkTrustTiers: readonly ["official_docs", "repo", "community", "external"];
declare const rankingAdjustmentSignals: readonly ["trust", "freshness"];
declare const rankingAdjustmentDirections: readonly ["boost", "penalty", "neutral"];
declare const rankingAdjustmentBases: readonly ["trust_tier", "last_modified", "volatile_content"];
declare const freshnessProfiles: readonly ["standard", "volatile"];
declare const evidencePackStatuses: readonly ["ready", "insufficient_evidence"];
declare const evidencePackReasons: readonly ["below_minimum_evidence"];
declare const supportQueryIntents: readonly ["install", "cli", "scripting", "auth", "pricing", "troubleshooting", "version_release", "unknown"];
declare const classifierOverrideMatchModes: readonly ["all", "any"];
type IndexedChunkSourceType = (typeof indexedChunkSourceTypes)[number];
type IndexedChunkTrustTier = (typeof indexedChunkTrustTiers)[number];
type SearchMode = 'vector' | 'keyword' | 'hybrid';
type RankingAdjustmentSignal = (typeof rankingAdjustmentSignals)[number];
type RankingAdjustmentDirection = (typeof rankingAdjustmentDirections)[number];
type RankingAdjustmentBasis = (typeof rankingAdjustmentBases)[number];
type FreshnessProfile = (typeof freshnessProfiles)[number];
type EvidencePackStatus = (typeof evidencePackStatuses)[number];
type EvidencePackReason = (typeof evidencePackReasons)[number];
type SupportQueryIntent = (typeof supportQueryIntents)[number];
type ClassifierOverrideMatchMode = (typeof classifierOverrideMatchModes)[number];
type TrustTierScoreOverrides = Partial<Record<IndexedChunkTrustTier, number>>;
interface IndexedChunk {
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
interface SearchResult {
    chunk: IndexedChunk;
    score: number;
    vectorScore?: number;
    keywordScore?: number;
    ranking?: RankingRationale;
}
interface FilterOptions {
    sourceTypes?: IndexedChunkSourceType[];
    trustTiers?: IndexedChunkTrustTier[];
    minDate?: Date;
}
interface RankingAdjustment {
    signal: RankingAdjustmentSignal;
    basis: RankingAdjustmentBasis;
    score: number;
    weight: number;
    baseline: number;
    contribution: number;
    direction: RankingAdjustmentDirection;
}
interface RankingRationale {
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
interface RankingOptions {
    enabled?: boolean;
    trustWeight?: number;
    freshnessWeight?: number;
    trustTierScores?: TrustTierScoreOverrides;
    freshnessHalfLifeDays?: number;
    volatileFreshnessHalfLifeDays?: number;
    volatilityIndicators?: string[];
    now?: Date;
}
interface SearchOptions {
    mode: SearchMode;
    topK?: number;
    vectorWeight?: number;
    keywordWeight?: number;
    filter?: FilterOptions;
    ranking?: RankingOptions;
}
interface EvidenceDocumentReference {
    title?: string;
    url?: string;
    sourcePath?: string;
}
interface EvidenceBundleBase {
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
type EvidenceBundle = (EvidenceBundleBase & {
    url: string;
    sourcePath?: never;
}) | (EvidenceBundleBase & {
    sourcePath: string;
    url?: never;
});
interface EvidencePackOptions {
    minEvidence?: number;
    maxEvidence?: number;
    documentsById?: Record<string, EvidenceDocumentReference>;
}
interface SupportQueryIntentScores {
    install: number;
    cli: number;
    scripting: number;
    auth: number;
    pricing: number;
    troubleshooting: number;
    version_release: number;
    unknown: number;
}
interface SupportQueryClassification {
    intent: SupportQueryIntent;
    score: number;
    matchedSignals: string[];
    scores: SupportQueryIntentScores;
    isFallback: boolean;
}
interface SupportQueryIntentTermOverrides {
    install?: string[];
    cli?: string[];
    scripting?: string[];
    auth?: string[];
    pricing?: string[];
    troubleshooting?: string[];
    version_release?: string[];
}
interface SupportQueryClassifierOverride {
    intent: SupportQueryIntent;
    terms: string[];
    matchMode?: ClassifierOverrideMatchMode;
}
interface SupportQueryClassifierConfig {
    minimumScore?: number;
    minimumMargin?: number;
    overrides?: SupportQueryClassifierOverride[];
    extraTermsByIntent?: SupportQueryIntentTermOverrides;
}
interface RoutedEvidenceOptions {
    minEvidence?: number;
    maxEvidence?: number;
}
interface SupportQueryRoutingRule {
    search: SearchOptions;
    evidence?: RoutedEvidenceOptions;
}
interface SupportQueryRoutingRuleOverride {
    search?: Partial<SearchOptions>;
    evidence?: RoutedEvidenceOptions;
}
interface SupportQueryRouteOverrides {
    install?: SupportQueryRoutingRuleOverride;
    cli?: SupportQueryRoutingRuleOverride;
    scripting?: SupportQueryRoutingRuleOverride;
    auth?: SupportQueryRoutingRuleOverride;
    pricing?: SupportQueryRoutingRuleOverride;
    troubleshooting?: SupportQueryRoutingRuleOverride;
    version_release?: SupportQueryRoutingRuleOverride;
    unknown?: SupportQueryRoutingRuleOverride;
}
interface SupportQueryRoutingConfig {
    classifier?: SupportQueryClassifierConfig;
    routeOverrides?: SupportQueryRouteOverrides;
}
interface SupportQueryRoutePlan {
    query: string;
    intent: SupportQueryIntent;
    classification: SupportQueryClassification;
    search: SearchOptions;
    evidence?: RoutedEvidenceOptions;
}
interface ReadyEvidencePackResult {
    status: 'ready';
    evidence: EvidenceBundle[];
    totalHits: number;
    packedEvidenceCount: number;
    minEvidence: number;
}
interface InsufficientEvidencePackResult {
    status: 'insufficient_evidence';
    reason: 'below_minimum_evidence';
    evidence: [];
    totalHits: number;
    packedEvidenceCount: number;
    minEvidence: number;
}
type EvidencePackResult = ReadyEvidencePackResult | InsufficientEvidencePackResult;
declare const indexedChunkSourceTypeSchema: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>;
declare const indexedChunkTrustTierSchema: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"official_docs">, z.ZodLiteral<"repo">]>, z.ZodLiteral<"community">]>, z.ZodLiteral<"external">]>;
declare const rankingAdjustmentSignalSchema: z.ZodEnum<["trust", "freshness"]>;
declare const rankingAdjustmentDirectionSchema: z.ZodEnum<["boost", "penalty", "neutral"]>;
declare const rankingAdjustmentBasisSchema: z.ZodEnum<["trust_tier", "last_modified", "volatile_content"]>;
declare const freshnessProfileSchema: z.ZodEnum<["standard", "volatile"]>;
declare const evidencePackStatusSchema: z.ZodEnum<["ready", "insufficient_evidence"]>;
declare const evidencePackReasonSchema: z.ZodEnum<["below_minimum_evidence"]>;
declare const supportQueryIntentSchema: z.ZodEnum<["install", "cli", "scripting", "auth", "pricing", "troubleshooting", "version_release", "unknown"]>;
declare const classifierOverrideMatchModeSchema: z.ZodEnum<["all", "any"]>;
declare const searchModeSchema: z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"vector">, z.ZodLiteral<"keyword">]>, z.ZodLiteral<"hybrid">]>;
declare const filterOptionsSchema: z.ZodObject<{
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
declare const indexedChunkSchema: z.ZodObject<{
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
declare const trustTierScoreOverridesSchema: z.ZodObject<{
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
declare const rankingAdjustmentSchema: z.ZodObject<{
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
declare const rankingRationaleSchema: z.ZodObject<{
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
declare const rankingOptionsSchema: z.ZodObject<{
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
declare const searchResultSchema: z.ZodObject<{
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
declare const searchOptionsSchema: z.ZodObject<{
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
declare const evidenceDocumentReferenceSchema: z.ZodObject<{
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
declare const evidenceBundleSchema: z.ZodEffects<z.ZodObject<{
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
declare const evidencePackOptionsSchema: z.ZodObject<{
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
declare const supportQueryIntentScoresSchema: z.ZodObject<{
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
declare const supportQueryClassificationSchema: z.ZodObject<{
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
declare const supportQueryIntentTermOverridesSchema: z.ZodObject<{
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
declare const supportQueryClassifierOverrideSchema: z.ZodObject<{
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
declare const supportQueryClassifierConfigSchema: z.ZodObject<{
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
declare const routedEvidenceOptionsSchema: z.ZodObject<{
    minEvidence: z.ZodOptional<z.ZodNumber>;
    maxEvidence: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    minEvidence?: number | undefined;
    maxEvidence?: number | undefined;
}, {
    minEvidence?: number | undefined;
    maxEvidence?: number | undefined;
}>;
declare const supportQueryRoutingRuleSchema: z.ZodObject<{
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
declare const supportQueryRoutingRuleOverrideSchema: z.ZodObject<{
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
declare const supportQueryRouteOverridesSchema: z.ZodObject<{
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
declare const supportQueryRoutingConfigSchema: z.ZodObject<{
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
declare const supportQueryRoutePlanSchema: z.ZodObject<{
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
declare const readyEvidencePackResultSchema: z.ZodObject<{
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
declare const insufficientEvidencePackResultSchema: z.ZodObject<{
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
declare const evidencePackResultSchema: z.ZodDiscriminatedUnion<"status", [z.ZodObject<{
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

declare function getDefaultSupportQueryRoutingRules(): Record<SupportQueryIntent, SupportQueryRoutingRule>;
declare function classifySupportQuery(query: string, config?: SupportQueryClassifierConfig): SupportQueryClassification;
declare function planSupportQueryRoute(query: string, config?: SupportQueryRoutingConfig): SupportQueryRoutePlan;

declare const DEFAULT_TRUST_TIER_SCORES: Record<IndexedChunkTrustTier, number>;
declare const DEFAULT_VOLATILITY_INDICATORS: string[];
declare function rerankSearchResults(results: SearchResult[], options?: RankingOptions): SearchResult[];
declare function getTrustTierScores(overrides?: TrustTierScoreOverrides): Record<IndexedChunkTrustTier, number>;

declare function packEvidence(results: SearchResult[], options?: EvidencePackOptions): EvidencePackResult;

declare class VectorStore {
    private readonly chunks;
    add(chunks: IndexedChunk[]): void;
    search(queryEmbedding: number[], options?: {
        topK?: number;
        filter?: FilterOptions;
    }): SearchResult[];
}

declare class KeywordStore {
    private readonly chunks;
    private readonly documentTermFrequencies;
    private readonly documentLengths;
    private readonly invertedIndex;
    private averageDocumentLength;
    add(chunks: IndexedChunk[]): void;
    search(query: string, options?: {
        topK?: number;
        filter?: FilterOptions;
    }): SearchResult[];
    private rebuildIndex;
    private calculateBm25Score;
}

declare class HybridIndex {
    private readonly chunks;
    private readonly vectorStore;
    private readonly keywordStore;
    add(chunks: IndexedChunk[]): void;
    search(query: string, queryEmbedding: number[], options?: SearchOptions): SearchResult[];
}

export { ClassifierOverrideMatchMode, DEFAULT_FRESHNESS_HALF_LIFE_DAYS, DEFAULT_FRESHNESS_WEIGHT, DEFAULT_KEYWORD_WEIGHT, DEFAULT_MIN_EVIDENCE, DEFAULT_TOP_K, DEFAULT_TRUST_TIER_SCORES, DEFAULT_TRUST_WEIGHT, DEFAULT_VECTOR_WEIGHT, DEFAULT_VOLATILE_FRESHNESS_HALF_LIFE_DAYS, DEFAULT_VOLATILITY_INDICATORS, EvidenceBundle, EvidenceBundleBase, EvidenceDocumentReference, EvidencePackOptions, EvidencePackReason, EvidencePackResult, EvidencePackStatus, FilterOptions, FreshnessProfile, HybridIndex, IndexedChunk, IndexedChunkSourceType, IndexedChunkTrustTier, InsufficientEvidencePackResult, KeywordStore, RankingAdjustment, RankingAdjustmentBasis, RankingAdjustmentDirection, RankingAdjustmentSignal, RankingOptions, RankingRationale, ReadyEvidencePackResult, RoutedEvidenceOptions, SearchMode, SearchOptions, SearchResult, SupportQueryClassification, SupportQueryClassifierConfig, SupportQueryClassifierOverride, SupportQueryIntent, SupportQueryIntentScores, SupportQueryIntentTermOverrides, SupportQueryRouteOverrides, SupportQueryRoutePlan, SupportQueryRoutingConfig, SupportQueryRoutingRule, SupportQueryRoutingRuleOverride, TrustTierScoreOverrides, VectorStore, classifierOverrideMatchModeSchema, classifierOverrideMatchModes, classifySupportQuery, evidenceBundleSchema, evidenceDocumentReferenceSchema, evidencePackOptionsSchema, evidencePackReasonSchema, evidencePackReasons, evidencePackResultSchema, evidencePackStatusSchema, evidencePackStatuses, filterOptionsSchema, freshnessProfileSchema, freshnessProfiles, getDefaultSupportQueryRoutingRules, getTrustTierScores, indexedChunkSchema, indexedChunkSourceTypeSchema, indexedChunkSourceTypes, indexedChunkTrustTierSchema, indexedChunkTrustTiers, insufficientEvidencePackResultSchema, packEvidence, planSupportQueryRoute, rankingAdjustmentBases, rankingAdjustmentBasisSchema, rankingAdjustmentDirectionSchema, rankingAdjustmentDirections, rankingAdjustmentSchema, rankingAdjustmentSignalSchema, rankingAdjustmentSignals, rankingOptionsSchema, rankingRationaleSchema, readyEvidencePackResultSchema, rerankSearchResults, routedEvidenceOptionsSchema, searchModeSchema, searchOptionsSchema, searchResultSchema, supportQueryClassificationSchema, supportQueryClassifierConfigSchema, supportQueryClassifierOverrideSchema, supportQueryIntentSchema, supportQueryIntentScoresSchema, supportQueryIntentTermOverridesSchema, supportQueryIntents, supportQueryRouteOverridesSchema, supportQueryRoutePlanSchema, supportQueryRoutingConfigSchema, supportQueryRoutingRuleOverrideSchema, supportQueryRoutingRuleSchema, trustTierScoreOverridesSchema };
