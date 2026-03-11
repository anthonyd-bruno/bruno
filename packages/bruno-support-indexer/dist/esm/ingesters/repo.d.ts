import { type SourceDocument } from '../types/source-document';
export interface RepoIngesterConfig {
    repoRoot: string;
    maxFileSizeBytes?: number;
}
export declare class RepoIngester {
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
