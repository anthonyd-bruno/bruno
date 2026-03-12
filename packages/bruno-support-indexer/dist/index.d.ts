import { z, ZodError } from 'zod';

declare enum TrustTier {
    OfficialDocs = "official_docs",
    Repo = "repo",
    Community = "community",
    External = "external"
}
declare const trustTierSchema: z.ZodNativeEnum<typeof TrustTier>;

declare const sourceTypes: readonly ["repo", "docs_site", "website", "github", "stackoverflow"];
type SourceType = (typeof sourceTypes)[number];
interface SourceDocument {
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
declare const sourceTypeSchema: z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodUnion<[z.ZodLiteral<"repo">, z.ZodLiteral<"docs_site">]>, z.ZodLiteral<"website">]>, z.ZodLiteral<"github">]>, z.ZodLiteral<"stackoverflow">]>;
declare const sourceDocumentSchema: z.ZodObject<{
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

interface Citation {
    sourceType: SourceType;
    url: string;
    title: string;
    headingAnchor?: string;
    trustTier: TrustTier;
    retrievalScore: number;
}
declare const citationSchema: z.ZodObject<{
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

interface Answer {
    id: string;
    query: string;
    content: string;
    citations: Citation[];
    confidence: number;
    generatedAt: Date;
    modelVersion?: string;
}
declare const answerSchema: z.ZodObject<{
    id: z.ZodString;
    query: z.ZodString;
    content: z.ZodString;
    citations: z.ZodArray<z.ZodObject<{
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
        trustTier: TrustTier;
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
        trustTier: TrustTier;
        retrievalScore: number;
        headingAnchor?: string | undefined;
    }[];
    confidence: number;
    generatedAt: Date;
    modelVersion?: string | undefined;
}>;

interface Chunk {
    id: string;
    documentId: string;
    content: string;
    headingAnchor?: string;
    chunkIndex: number;
    metadata: Record<string, unknown>;
    contentHash: string;
}
declare const chunkSchema: z.ZodObject<{
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

declare const evalCaseDifficulties: readonly ["easy", "medium", "hard"];
type EvalCaseDifficulty = (typeof evalCaseDifficulties)[number];
interface EvalCase {
    id: string;
    query: string;
    expectedAnswer: string;
    expectedCitations: Citation[];
    category: string;
    difficulty: EvalCaseDifficulty;
}
declare const evalCaseSchema: z.ZodObject<{
    id: z.ZodString;
    query: z.ZodString;
    expectedAnswer: z.ZodString;
    expectedCitations: z.ZodArray<z.ZodObject<{
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
        trustTier: TrustTier;
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
        trustTier: TrustTier;
        retrievalScore: number;
        headingAnchor?: string | undefined;
    }[];
    category: string;
    difficulty: "easy" | "medium" | "hard";
}>;

interface StackOverflowIngesterConfig {
    tag?: string;
    minScore?: number;
    maxAgeDays?: number;
    apiKey?: string;
    pageSize?: number;
}
declare class StackOverflowIngester {
    private readonly tag;
    private readonly minScore;
    private readonly maxAgeDays;
    private readonly apiKey?;
    private readonly pageSize;
    constructor(config?: StackOverflowIngesterConfig);
    ingest(): Promise<SourceDocument[]>;
    private fetchQuestions;
    private fetchAnswers;
    private appendApiKey;
    private fetchJson;
    private delay;
    private toSourceDocument;
}

interface GitHubIngesterConfig {
    owner?: string;
    repo?: string;
    apiToken?: string;
    maxReleases?: number;
    maxIssues?: number;
    maxDiscussions?: number;
}
declare class GitHubIngester {
    private readonly owner;
    private readonly repo;
    private readonly apiToken?;
    private readonly maxReleases;
    private readonly maxIssues;
    private readonly maxDiscussions;
    constructor(config?: GitHubIngesterConfig);
    ingest(): Promise<SourceDocument[]>;
    private fetchReleases;
    private fetchIssues;
    private fetchIssueComments;
    private fetchDiscussions;
    private shouldIncludeIssue;
    private getLabelNames;
    private fetchJson;
    private fetchGraphQlJson;
    private buildHeaders;
    private delay;
    private toReleaseDocument;
    private toIssueDocument;
    private toDiscussionDocument;
    private buildReleaseContent;
    private buildIssueContent;
    private buildDiscussionContent;
}

interface RepoIngesterConfig {
    repoRoot: string;
    maxFileSizeBytes?: number;
}
declare class RepoIngester {
    private readonly repoRoot;
    private readonly maxFileSizeBytes;
    constructor(config: RepoIngesterConfig);
    ingest(): Promise<SourceDocument[]>;
    private discoverFiles;
    private addPackageReadmes;
    private addMatchingFiles;
    private walk;
    private addIfFileExists;
    private createDocument;
    private isMarkdownFile;
    private isSupportedDocsMarkdown;
    private extractTitle;
    private createDocumentId;
    private getGitSha;
    private normalizeRelativePath;
}

interface DocsSiteIngesterConfig {
    baseUrl?: string;
    maxPages?: number;
    maxDepth?: number;
}
declare class DocsSiteIngester {
    private readonly baseUrl;
    private readonly maxPages;
    private readonly maxDepth;
    constructor(config?: DocsSiteIngesterConfig);
    ingest(): Promise<SourceDocument[]>;
    private fetchHtml;
    private parsePage;
    private extractCanonicalUrl;
    private extractTitle;
    private extractHeadings;
    private extractContent;
    private extractLinks;
    private toSourceDocument;
    private getAttributeValue;
    private toPlainText;
    private decodeHtmlEntities;
    private isInternalUrl;
    private normalizeUrl;
    private parseLastModified;
    private delay;
}

interface WebsiteIngesterConfig {
    baseUrl?: string;
    targetPaths?: string[];
    maxPages?: number;
}
declare class WebsiteIngester {
    private readonly baseUrl;
    private readonly targetPaths;
    private readonly maxPages;
    private readonly baseHostname;
    constructor(config?: WebsiteIngesterConfig);
    ingest(): Promise<SourceDocument[]>;
    private crawlPage;
    private fetchPage;
    private delay;
    private extractCanonicalUrl;
    private extractTitle;
    private extractTextContent;
    private stripTags;
    private decodeHtmlEntities;
    private extractInternalLinks;
    private extractAttributeValue;
    private extractLastModified;
    private isSameDomain;
    private isCrawlablePath;
    private normalizeHostname;
    private normalizeUrl;
    private normalizePagePath;
    private getFreshnessPriority;
    private createDocumentId;
    private toSourceDocument;
}

interface DocumentChunkerConfig {
    maxChunkSize?: number;
    chunkOverlap?: number;
    minChunkSize?: number;
}
declare class DocumentChunker {
    private readonly maxChunkSize;
    private readonly chunkOverlap;
    private readonly minChunkSize;
    constructor(config?: DocumentChunkerConfig);
    chunk(document: SourceDocument): Chunk[];
    chunkMany(documents: SourceDocument[]): Chunk[];
    private prepareContent;
    private splitDocument;
    private splitMarkdownContent;
    private splitPlainTextContent;
    private parseMarkdownSections;
    private splitOversizedText;
    private splitParagraph;
    private accumulateUnits;
    private splitSentences;
    private hardSplit;
    private mergeSmallChunks;
    private applyOverlap;
    private stripHtml;
    private normalizeWhitespace;
    private joinContent;
}

interface EmbeddingProvider {
    embed(texts: string[]): Promise<number[][]>;
    readonly modelName: string;
    readonly dimensions: number;
}

interface OpenAIEmbeddingProviderConfig {
    apiKey?: string;
    model?: string;
    dimensions?: number;
}
declare class OpenAIEmbeddingProvider implements EmbeddingProvider {
    readonly modelName: string;
    readonly dimensions: number;
    private readonly apiKey?;
    constructor(config?: OpenAIEmbeddingProviderConfig);
    embed(texts: string[]): Promise<number[][]>;
    private fetchEmbeddings;
    private delay;
}

interface OllamaEmbeddingProviderConfig {
    endpoint?: string;
    model?: string;
    dimensions?: number;
    fetchImpl?: typeof fetch;
}
declare class OllamaEmbeddingProvider implements EmbeddingProvider {
    readonly modelName: string;
    private readonly endpoint;
    private readonly configuredDimensions?;
    private readonly fetchImpl;
    private resolvedDimensions?;
    constructor(config?: OllamaEmbeddingProviderConfig);
    get dimensions(): number;
    embed(texts: string[]): Promise<number[][]>;
    private fetchEmbeddings;
    private assertEmbeddingDimensions;
}

type EmbeddedChunk = Chunk & {
    embedding: number[];
};
interface EmbeddingPipelineConfig {
    provider: EmbeddingProvider;
    batchSize?: number;
}
declare class EmbeddingPipeline {
    private readonly provider;
    private readonly batchSize;
    constructor(config: EmbeddingPipelineConfig);
    embed(chunks: Chunk[], processedHashes?: Set<string>): Promise<EmbeddedChunk[]>;
}

type SafeValidationResult<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: ZodError;
};
declare function safeValidate<T>(schema: z.ZodType<T>, data: unknown): SafeValidationResult<T>;
declare function validateSourceDocument(data: unknown): SourceDocument;
declare function validateChunk(data: unknown): Chunk;
declare function validateCitation(data: unknown): Citation;
declare function validateAnswer(data: unknown): Answer;
declare function validateEvalCase(data: unknown): EvalCase;

declare const supportSyncSourceGroupIds: readonly ["repo", "docs", "website_high_churn", "website_daily", "github"];
type SupportSyncSourceGroupId = (typeof supportSyncSourceGroupIds)[number];
interface SupportSyncSourceGroupSchedule {
    id: SupportSyncSourceGroupId;
    label: string;
    cadenceHours: number;
    staleAfterHours: number;
}
interface SupportSyncRetryPolicy {
    maxAttempts: number;
    baseDelayMs: number;
}
interface SupportSyncScheduleConfig {
    sourceGroups: SupportSyncSourceGroupSchedule[];
    retry: SupportSyncRetryPolicy;
}
declare const DEFAULT_SUPPORT_SYNC_RETRY_POLICY: SupportSyncRetryPolicy;
declare const DEFAULT_SUPPORT_SYNC_SCHEDULE_CONFIG: SupportSyncScheduleConfig;
declare function parseSupportSyncScheduleConfig(input?: unknown): SupportSyncScheduleConfig;
declare function getSupportSyncSourceGroupSchedule(config: SupportSyncScheduleConfig, groupId: SupportSyncSourceGroupId): SupportSyncSourceGroupSchedule;
declare function getSupportSyncNextDueAt(group: Pick<SupportSyncSourceGroupSchedule, 'cadenceHours'>, lastSuccessfulAt: Date): Date;
declare function isSupportSyncSourceGroupDue(group: Pick<SupportSyncSourceGroupSchedule, 'cadenceHours'>, lastSuccessfulAt: Date | undefined, now: Date): boolean;

interface SupportSyncState {
    version: 1;
    updatedAt?: string;
    lastSuccessfulRunByGroup: Partial<Record<SupportSyncSourceGroupId, string>>;
}
interface SupportSyncGroupFreshness {
    id: SupportSyncSourceGroupId;
    label: string;
    cadenceHours: number;
    staleAfterHours: number;
    status: 'fresh' | 'stale' | 'never_synced';
    lastSuccessfulAt?: string;
    ageHours?: number;
}
interface SupportSyncStalenessReport {
    checkedAt: string;
    status: 'ok' | 'stale';
    staleGroupIds: SupportSyncSourceGroupId[];
    groups: SupportSyncGroupFreshness[];
}
declare function parseSupportSyncState(input?: unknown): SupportSyncState;
declare function recordSupportSyncSuccess(state: SupportSyncState, groupId: SupportSyncSourceGroupId, completedAt: Date): SupportSyncState;
declare function evaluateSupportSyncStaleness(config: SupportSyncScheduleConfig, state: SupportSyncState, now: Date): SupportSyncStalenessReport;

type SupportSyncHandler = () => Promise<SourceDocument[]>;
type SupportSyncHandlerMap = Record<SupportSyncSourceGroupId, SupportSyncHandler>;
interface SupportSyncAttemptResult {
    attempt: number;
    status: 'succeeded' | 'failed';
    startedAt: string;
    completedAt: string;
    durationMs: number;
    documentCount: number;
    error?: string;
}
interface SupportSyncSourceGroupRunResult {
    id: SupportSyncSourceGroupId;
    label: string;
    cadenceHours: number;
    staleAfterHours: number;
    status: 'succeeded' | 'failed' | 'skipped_not_due';
    attempts: SupportSyncAttemptResult[];
    documentCount: number;
    lastSuccessfulAtBeforeRun?: string;
    lastSuccessfulAtAfterRun?: string;
    nextDueAt?: string;
}
interface SupportSyncRunOutput {
    version: 1;
    status: 'completed' | 'failed';
    startedAt: string;
    completedAt: string;
    schedule: SupportSyncScheduleConfig;
    totals: {
        executedGroupCount: number;
        successfulGroupCount: number;
        failedGroupCount: number;
        skippedGroupCount: number;
        documentCount: number;
    };
    sourceGroups: SupportSyncSourceGroupRunResult[];
    staleReport: SupportSyncStalenessReport;
    state: SupportSyncState;
}
interface RunScheduledSupportSyncInput {
    repoRoot: string;
    scheduleConfig?: unknown;
    previousState?: unknown;
    now?: () => Date;
    sleep?: (ms: number) => Promise<void>;
    handlers?: Partial<SupportSyncHandlerMap>;
}
declare function createDefaultSupportSyncHandlers(repoRoot: string): SupportSyncHandlerMap;
declare function runScheduledSupportSync(input: RunScheduledSupportSyncInput): Promise<SupportSyncRunOutput>;
declare function renderSupportSyncRunMarkdown(output: SupportSyncRunOutput): string;

export { Answer, Chunk, Citation, DEFAULT_SUPPORT_SYNC_RETRY_POLICY, DEFAULT_SUPPORT_SYNC_SCHEDULE_CONFIG, DocsSiteIngester, DocsSiteIngesterConfig, DocumentChunker, DocumentChunkerConfig, EmbeddedChunk, EmbeddingPipeline, EmbeddingPipelineConfig, EmbeddingProvider, EvalCase, EvalCaseDifficulty, GitHubIngester, GitHubIngesterConfig, OllamaEmbeddingProvider, OllamaEmbeddingProviderConfig, OpenAIEmbeddingProvider, OpenAIEmbeddingProviderConfig, RepoIngester, RepoIngesterConfig, RunScheduledSupportSyncInput, SourceDocument, SourceType, StackOverflowIngester, StackOverflowIngesterConfig, SupportSyncAttemptResult, SupportSyncGroupFreshness, SupportSyncHandler, SupportSyncHandlerMap, SupportSyncRetryPolicy, SupportSyncRunOutput, SupportSyncScheduleConfig, SupportSyncSourceGroupId, SupportSyncSourceGroupRunResult, SupportSyncSourceGroupSchedule, SupportSyncStalenessReport, SupportSyncState, TrustTier, WebsiteIngester, WebsiteIngesterConfig, answerSchema, chunkSchema, citationSchema, createDefaultSupportSyncHandlers, evalCaseDifficulties, evalCaseSchema, evaluateSupportSyncStaleness, getSupportSyncNextDueAt, getSupportSyncSourceGroupSchedule, isSupportSyncSourceGroupDue, parseSupportSyncScheduleConfig, parseSupportSyncState, recordSupportSyncSuccess, renderSupportSyncRunMarkdown, runScheduledSupportSync, safeValidate, sourceDocumentSchema, sourceTypeSchema, sourceTypes, supportSyncSourceGroupIds, trustTierSchema, validateAnswer, validateChunk, validateCitation, validateEvalCase, validateSourceDocument };
