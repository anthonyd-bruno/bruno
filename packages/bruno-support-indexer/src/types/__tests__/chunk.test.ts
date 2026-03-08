import { describe, expect, it } from '@jest/globals';

import { Chunk, chunkSchema } from '../chunk';

const validChunk: Chunk = {
  id: 'chunk-1',
  documentId: 'doc-1',
  content: 'Chunk content',
  headingAnchor: 'overview',
  chunkIndex: 0,
  metadata: { tokens: 42 },
  contentHash: 'chunk-hash-1'
};

describe('chunkSchema', () => {
  it('accepts a valid chunk', () => {
    expect(chunkSchema.parse(validChunk)).toEqual(validChunk);
  });

  it('rejects missing required fields', () => {
    const result = chunkSchema.safeParse({ ...validChunk, documentId: undefined });

    expect(result.success).toBe(false);
  });

  it('rejects invalid chunkIndex values', () => {
    const result = chunkSchema.safeParse({ ...validChunk, chunkIndex: -1 });

    expect(result.success).toBe(false);
  });
});