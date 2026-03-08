import { describe, expect, it } from '@jest/globals';
import { createHash } from 'crypto';

import { DocumentChunker } from '../chunker';
import { chunkSchema } from '../../types/chunk';
import { type SourceDocument } from '../../types/source-document';
import { TrustTier } from '../../types/trust-tier';

function createDocument(
  content: string,
  overrides: Partial<SourceDocument> = {}
): SourceDocument {
  return {
    id: overrides.id ?? 'doc-1',
    sourceType: overrides.sourceType ?? 'repo',
    title: overrides.title ?? 'Test Document',
    content,
    contentHash: createHash('sha256').update(content).digest('hex'),
    trustTier: overrides.trustTier ?? TrustTier.Repo,
    lastModified: overrides.lastModified ?? new Date('2026-03-08T00:00:00.000Z'),
    lastSeen: overrides.lastSeen ?? new Date('2026-03-08T00:00:00.000Z'),
    metadata: overrides.metadata ?? {},
    url: overrides.url,
    sourcePath: overrides.sourcePath
  };
}

describe('DocumentChunker', () => {
  it('splits markdown content at heading boundaries', () => {
    const document = createDocument('## Installation\nInstall Bruno.\n\n## Usage\nRun Bruno.');
    const chunker = new DocumentChunker({ maxChunkSize: 500, chunkOverlap: 0, minChunkSize: 1 });

    const chunks = chunker.chunk(document);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toContain('## Installation');
    expect(chunks[1].content).toContain('## Usage');
    expect(chunks[0].headingAnchor).toBe('## Installation');
    expect(chunks[1].headingAnchor).toBe('## Usage');
  });

  it('sub-splits long sections by paragraph when they exceed the max size', () => {
    const firstParagraph = 'Alpha '.repeat(15).trim() + '.';
    const secondParagraph = 'Beta '.repeat(15).trim() + '.';
    const document = createDocument(`## Guide\n\n${firstParagraph}\n\n${secondParagraph}`);
    const chunker = new DocumentChunker({ maxChunkSize: 110, chunkOverlap: 0, minChunkSize: 1 });

    const chunks = chunker.chunk(document);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toContain('Alpha');
    expect(chunks[1].content).toContain('Beta');
  });

  it('prepends overlap from the previous chunk to the next chunk', () => {
    const document = createDocument(
      `${'First sentence '.repeat(4).trim()}.\n\n${'Second sentence '.repeat(4).trim()}.`,
      { sourceType: 'github', trustTier: TrustTier.Community }
    );
    const chunker = new DocumentChunker({ maxChunkSize: 70, chunkOverlap: 12, minChunkSize: 1 });

    const chunks = chunker.chunk(document);

    expect(chunks).toHaveLength(2);
    expect(chunks[1].content.startsWith(chunks[0].content.slice(-12))).toBe(true);
  });

  it('merges chunks smaller than the minimum size into adjacent chunks', () => {
    const largeParagraph = 'Large paragraph '.repeat(10).trim() + '.';
    const document = createDocument(`tiny\n\n${largeParagraph}`, {
      sourceType: 'github',
      trustTier: TrustTier.Community
    });
    const chunker = new DocumentChunker({ maxChunkSize: 90, chunkOverlap: 0, minChunkSize: 20 });

    const chunks = chunker.chunk(document);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].content).toContain('tiny');
    expect(chunks[0].content).toContain('Large paragraph');
    expect(chunks.some((chunk) => chunk.content === 'tiny')).toBe(false);
  });

  it('strips HTML tags before chunking html-based sources', () => {
    const document = createDocument(
      '<header>Ignore me</header><h2>Install</h2><p>Use <strong>Bruno</strong>.</p><script>alert(1)</script>',
      {
        sourceType: 'docs_site',
        trustTier: TrustTier.OfficialDocs,
        url: 'https://docs.usebruno.com/install'
      }
    );
    const chunker = new DocumentChunker({ maxChunkSize: 500, chunkOverlap: 0, minChunkSize: 1 });

    const [chunk] = chunker.chunk(document);

    expect(chunk.content).toContain('Install');
    expect(chunk.content).toContain('Use Bruno.');
    expect(chunk.content).not.toContain('Ignore me');
    expect(chunk.content).not.toContain('alert(1)');
    expect(chunk.content).not.toMatch(/[<>]/);
  });

  it('tracks the nearest heading anchor and heading path for nested markdown headings', () => {
    const document = createDocument('## Install\nSetup steps.\n\n### Linux\nLinux steps.');
    const chunker = new DocumentChunker({ maxChunkSize: 500, chunkOverlap: 0, minChunkSize: 1 });

    const chunks = chunker.chunk(document);

    expect(chunks[0].headingAnchor).toBe('## Install');
    expect(chunks[0].metadata).toMatchObject({ heading_path: '## Install' });
    expect(chunks[1].headingAnchor).toBe('### Linux');
    expect(chunks[1].metadata).toMatchObject({ heading_path: '## Install > ### Linux' });
  });

  it('assigns chunk ids, metadata, and content hashes from the final content', () => {
    const document = createDocument('## Install\nInstall Bruno.\n\n## Usage\nRun Bruno.', { id: 'doc-7' });
    const chunker = new DocumentChunker({ maxChunkSize: 500, chunkOverlap: 0, minChunkSize: 1 });

    const chunks = chunker.chunk(document);

    expect(chunks[0].id).toBe('doc-7-chunk-0');
    expect(chunks[1].id).toBe('doc-7-chunk-1');
    expect(chunks[0].metadata).toEqual({
      source_type: 'repo',
      heading_path: '## Install',
      char_count: chunks[0].content.length
    });
    expect(chunks[0].contentHash).toBe(createHash('sha256').update(chunks[0].content).digest('hex'));
  });

  it('produces chunks that validate against the chunk schema', () => {
    const document = createDocument('## Install\nInstall Bruno.\n\n## Usage\nRun Bruno.');
    const chunker = new DocumentChunker({ maxChunkSize: 500, chunkOverlap: 0, minChunkSize: 1 });

    const chunks = chunker.chunk(document);

    expect(() => chunks.forEach((chunk) => chunkSchema.parse(chunk))).not.toThrow();
  });

  it('chunks many documents and concatenates the results', () => {
    const chunker = new DocumentChunker({ maxChunkSize: 500, chunkOverlap: 0, minChunkSize: 1 });
    const documents = [
      createDocument('## One\nFirst document.', { id: 'doc-a' }),
      createDocument('Plain text document.', {
        id: 'doc-b',
        sourceType: 'github',
        trustTier: TrustTier.Community
      })
    ];

    const chunks = chunker.chunkMany(documents);

    expect(chunks).toHaveLength(2);
    expect(chunks.map((chunk) => chunk.id)).toEqual(['doc-a-chunk-0', 'doc-b-chunk-0']);
  });
});