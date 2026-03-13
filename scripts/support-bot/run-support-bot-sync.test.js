const { getLocalIndexEmbeddingBatchSize } = require('./run-support-bot-sync')

describe('run-support-bot-sync Ollama batching', () => {
  it('uses a smaller embedding batch size for local Ollama index builds', () => {
    expect(getLocalIndexEmbeddingBatchSize('ollama')).toBe(8)
    expect(getLocalIndexEmbeddingBatchSize('openai')).toBeUndefined()
  })
})