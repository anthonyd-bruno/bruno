import { type SourceDocument } from '../types/source-document';
export interface DocsSiteIngesterConfig {
    baseUrl?: string;
    maxPages?: number;
    maxDepth?: number;
}
export declare class DocsSiteIngester {
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
