import { type SourceDocument } from '../types/source-document';
export interface StackOverflowIngesterConfig {
    tag?: string;
    minScore?: number;
    maxAgeDays?: number;
    apiKey?: string;
    pageSize?: number;
}
export declare class StackOverflowIngester {
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
