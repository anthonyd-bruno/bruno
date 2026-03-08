import { createHash } from 'crypto';

import { type Chunk } from '../types/chunk';
import { type SourceDocument, type SourceType } from '../types/source-document';

const DEFAULT_MAX_CHUNK_SIZE = 1500;
const DEFAULT_CHUNK_OVERLAP = 200;
const DEFAULT_MIN_CHUNK_SIZE = 100;
const HTML_SOURCE_TYPES: ReadonlySet<SourceType> = new Set(['docs_site', 'website', 'stackoverflow']);
const MARKDOWN_SOURCE_TYPES: ReadonlySet<SourceType> = new Set(['repo']);
const HEADING_PATTERN = /^(#{1,6})\s+(.*\S)\s*$/;

interface DocumentChunkerConfig {
  maxChunkSize?: number;
  chunkOverlap?: number;
  minChunkSize?: number;
}

interface ChunkDraft {
  content: string;
  headingAnchor?: string;
  headingPath: string;
}

export class DocumentChunker {
  private readonly maxChunkSize: number;
  private readonly chunkOverlap: number;
  private readonly minChunkSize: number;

  constructor(config: DocumentChunkerConfig = {}) {
    this.maxChunkSize = config.maxChunkSize ?? DEFAULT_MAX_CHUNK_SIZE;
    this.chunkOverlap = config.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;
    this.minChunkSize = config.minChunkSize ?? DEFAULT_MIN_CHUNK_SIZE;
  }

  chunk(document: SourceDocument): Chunk[] {
    const normalizedContent = this.prepareContent(document);

    if (!normalizedContent) {
      return [];
    }

    const initialChunks = this.splitDocument(normalizedContent, document.sourceType);
    const mergedChunks = this.mergeSmallChunks(initialChunks);

    return this.applyOverlap(mergedChunks).map((draft, chunkIndex) => ({
      id: `${document.id}-chunk-${chunkIndex}`,
      documentId: document.id,
      content: draft.content,
      headingAnchor: draft.headingAnchor,
      chunkIndex,
      metadata: {
        source_type: document.sourceType,
        heading_path: draft.headingPath,
        char_count: draft.content.length
      },
      contentHash: createHash('sha256').update(draft.content).digest('hex')
    }));
  }

  chunkMany(documents: SourceDocument[]): Chunk[] {
    return documents.flatMap((document) => this.chunk(document));
  }

  private prepareContent(document: SourceDocument): string {
    const content = this.normalizeWhitespace(
      HTML_SOURCE_TYPES.has(document.sourceType) ? this.stripHtml(document.content) : document.content
    );

    return content.trim();
  }

  private splitDocument(content: string, sourceType: SourceType): ChunkDraft[] {
    if (MARKDOWN_SOURCE_TYPES.has(sourceType)) {
      return this.splitMarkdownContent(content);
    }

    return this.splitPlainTextContent(content);
  }

  private splitMarkdownContent(content: string): ChunkDraft[] {
    const sections = this.parseMarkdownSections(content);

    if (sections.length === 0) {
      return [];
    }

    return sections.flatMap((section) =>
      this.splitOversizedText(section.content).map((chunkContent) => ({
        content: chunkContent,
        headingAnchor: section.headingAnchor,
        headingPath: section.headingPath
      }))
    );
  }

  private splitPlainTextContent(content: string): ChunkDraft[] {
    return this.splitOversizedText(content).map((chunkContent) => ({
      content: chunkContent,
      headingPath: ''
    }));
  }

  private parseMarkdownSections(content: string): ChunkDraft[] {
    const sections: ChunkDraft[] = [];
    const lines = content.split('\n');
    const headingPath: string[] = [];
    let currentLines: string[] = [];
    let currentHeadingAnchor: string | undefined;
    let currentHeadingPath = '';

    const pushSection = () => {
      const sectionContent = currentLines.join('\n').trim();

      if (!sectionContent) {
        return;
      }

      sections.push({
        content: sectionContent,
        headingAnchor: currentHeadingAnchor,
        headingPath: currentHeadingPath
      });
    };

    lines.forEach((line) => {
      const headingMatch = line.match(HEADING_PATTERN);

      if (!headingMatch) {
        currentLines.push(line);
        return;
      }

      pushSection();

      const level = headingMatch[1].length;
      const normalizedHeading = `${headingMatch[1]} ${headingMatch[2].trim()}`;
      const pathIndex = level - 1;

      headingPath.splice(pathIndex);
      headingPath[pathIndex] = normalizedHeading;

      currentHeadingAnchor = normalizedHeading;
      currentHeadingPath = headingPath.filter(Boolean).join(' > ');
      currentLines = [normalizedHeading];
    });

    pushSection();

    return sections;
  }

  private splitOversizedText(content: string): string[] {
    if (content.length <= this.maxChunkSize) {
      return [content];
    }

    const paragraphs = content.split(/\n\s*\n+/).map((paragraph) => paragraph.trim()).filter(Boolean);

    if (paragraphs.length <= 1) {
      return this.splitParagraph(content.trim());
    }

    return this.accumulateUnits(paragraphs, '\n\n');
  }

  private splitParagraph(paragraph: string): string[] {
    if (paragraph.length <= this.maxChunkSize) {
      return [paragraph];
    }

    const sentences = this.splitSentences(paragraph);

    if (sentences.length <= 1) {
      return this.hardSplit(paragraph);
    }

    return this.accumulateUnits(sentences, ' ');
  }

  private accumulateUnits(units: string[], separator: string): string[] {
    const chunks: string[] = [];
    let currentChunk = '';

    units.forEach((unit) => {
      if (unit.length > this.maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk);
          currentChunk = '';
        }

        const nestedChunks = separator === '\n\n' ? this.splitParagraph(unit) : this.hardSplit(unit);
        nestedChunks.forEach((nestedChunk) => {
          chunks.push(nestedChunk);
        });
        return;
      }

      const nextChunk = currentChunk ? `${currentChunk}${separator}${unit}` : unit;

      if (nextChunk.length <= this.maxChunkSize) {
        currentChunk = nextChunk;
        return;
      }

      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = unit;
    });

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  private splitSentences(content: string): string[] {
    const sentences = content.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);

    return (sentences ?? [content]).map((sentence) => sentence.trim()).filter(Boolean);
  }

  private hardSplit(content: string): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < content.length) {
      chunks.push(content.slice(start, start + this.maxChunkSize).trim());
      start += this.maxChunkSize;
    }

    return chunks.filter(Boolean);
  }

  private mergeSmallChunks(chunks: ChunkDraft[]): ChunkDraft[] {
    const mergedChunks = chunks.map((chunk) => ({ ...chunk }));
    let index = 0;

    while (index < mergedChunks.length) {
      if (mergedChunks[index].content.length >= this.minChunkSize || mergedChunks.length === 1) {
        index += 1;
        continue;
      }

      if (index === 0) {
        mergedChunks[1] = {
          ...mergedChunks[1],
          content: this.joinContent(mergedChunks[0].content, mergedChunks[1].content)
        };
        mergedChunks.splice(0, 1);
        continue;
      }

      mergedChunks[index - 1] = {
        ...mergedChunks[index - 1],
        content: this.joinContent(mergedChunks[index - 1].content, mergedChunks[index].content)
      };
      mergedChunks.splice(index, 1);
    }

    return mergedChunks;
  }

  private applyOverlap(chunks: ChunkDraft[]): ChunkDraft[] {
    if (this.chunkOverlap <= 0) {
      return chunks;
    }

    return chunks.map((chunk, index) => {
      if (index === 0) {
        return chunk;
      }

      const previousChunk = chunks[index - 1].content;
      const overlap = previousChunk.slice(-this.chunkOverlap);

      if (!overlap) {
        return chunk;
      }

      return {
        ...chunk,
        content: `${overlap}${chunk.content}`
      };
    });
  }

  private stripHtml(content: string): string {
    let text = content.replace(/<!--[\s\S]*?-->/g, ' ');

    ['script', 'style', 'nav', 'header', 'footer'].forEach((tagName) => {
      text = text.replace(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'gi'), ' ');
    });

    text = text.replace(/<\/?(?:main|section|article|aside|div|p|ul|ol|li|h[1-6]|blockquote|pre|table|tr|td|th|br)[^>]*>/gi, '\n');

    return text.replace(/<[^>]+>/g, ' ');
  }

  private normalizeWhitespace(content: string): string {
    return content
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/\n{3,}/g, '\n\n');
  }

  private joinContent(left: string, right: string): string {
    if (!left) {
      return right;
    }

    if (!right) {
      return left;
    }

    return `${left}\n\n${right}`;
  }
}

export type { DocumentChunkerConfig };