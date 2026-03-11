import { type SourceDocument } from '../types/source-document';
export interface WebsiteIngesterConfig {
    baseUrl?: string;
    targetPaths?: string[];
    maxPages?: number;
}
export declare class WebsiteIngester {
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
