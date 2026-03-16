const {
  buildLocalIndexSnapshot,
  getLocalIndexChunkerConfig,
  getLocalIndexEmbeddingBatchSize
} = require('./run-support-bot-sync')

describe('run-support-bot-sync Ollama batching', () => {
  it('uses a smaller embedding batch size for local Ollama index builds', () => {
    expect(getLocalIndexEmbeddingBatchSize('ollama')).toBe(8)
    expect(getLocalIndexEmbeddingBatchSize('openai')).toBeUndefined()
  })

  it('uses a smaller chunk size for local Ollama index builds', async () => {
    expect(getLocalIndexChunkerConfig('ollama')).toEqual({ maxChunkSize: 800 })
    expect(getLocalIndexChunkerConfig('openai')).toBeUndefined()

    const chunkMany = jest.fn().mockReturnValue([
      {
        id: 'doc-1-chunk-0',
        documentId: 'doc-1',
        content: 'Chunk body',
        metadata: { heading_path: '', source_type: 'repo', char_count: 10 },
        contentHash: 'hash-1'
      }
    ])
    const DocumentChunker = jest.fn().mockImplementation(() => ({ chunkMany }))
    const embed = jest.fn().mockImplementation(async (chunks) =>
      chunks.map((chunk) => ({
        ...chunk,
        embedding: [0.1, 0.2, 0.3]
      }))
    )
    const EmbeddingPipeline = jest.fn().mockImplementation(() => ({ embed }))

    class OllamaEmbeddingProvider {
      constructor() {
        this.modelName = 'mxbai-embed-large'
        this.dimensions = 3
      }
    }

    const supportIndexer = {
      createDefaultSupportSyncHandlers: () => ({
        repo: async () => [
          {
            id: 'doc-1',
            title: 'Doc 1',
            content: 'ignored by mocked chunker',
            sourceType: 'repo',
            trustTier: 'repo',
            lastModified: new Date('2026-03-16T00:00:00.000Z'),
            url: 'https://example.com/doc-1',
            sourcePath: 'docs/doc-1.md'
          }
        ]
      }),
      DocumentChunker,
      EmbeddingPipeline,
      OllamaEmbeddingProvider,
      OpenAIEmbeddingProvider: class OpenAIEmbeddingProvider {}
    }

    await buildLocalIndexSnapshot(supportIndexer, process.cwd(), 'ollama')

    expect(DocumentChunker).toHaveBeenCalledWith({ maxChunkSize: 800 })
    expect(EmbeddingPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ batchSize: 8 })
    )
  })
})