import { type SourceDocument } from '../types/source-document';
export interface GitHubIngesterConfig {
    owner?: string;
    repo?: string;
    apiToken?: string;
    maxReleases?: number;
    maxIssues?: number;
    maxDiscussions?: number;
}
export declare class GitHubIngester {
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
