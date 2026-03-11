import { type Chunk } from '../types/chunk';
import { type SourceDocument } from '../types/source-document';
interface DocumentChunkerConfig {
    maxChunkSize?: number;
    chunkOverlap?: number;
    minChunkSize?: number;
}
export declare class DocumentChunker {
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
export type { DocumentChunkerConfig };
