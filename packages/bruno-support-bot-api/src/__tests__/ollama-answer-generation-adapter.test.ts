import { afterEach, describe, expect, it, jest } from '@jest/globals';

import type { AnswerGenerationRequest } from '../answer-generation-adapter';
import { OllamaAnswerGenerationAdapter } from '../ollama-answer-generation-adapter';

const originalFetch = global.fetch;

function createRequest(): AnswerGenerationRequest {
  return {
    policyVersion: 'grounded-v1',
    mode: 'grounded' as const,
    query: 'How do I install Bruno?',
    assessment: {
      strength: 'strong' as const,
      reason: 'meets_grounding_threshold' as const,
      evidenceCount: 2,
      qualifyingEvidenceCount: 2,
      strongestEvidenceScore: 0.92
    },
    safety: {
      classification: 'normal' as const,
      requiresFallback: false
    },
    escalation: {
      channel: 'none' as const,
      shouldEscalate: false
    },
    messages: [
      { role: 'system' as const, content: 'Use only the evidence.' },
      { role: 'user' as const, content: 'How do I install Bruno?' }
    ],
    evidence: [
      {
        index: 1,
        documentId: 'doc-1',
        sourceType: 'docs_site' as const,
        title: 'Install Bruno',
        trustTier: 'official_docs' as const,
        retrievalScore: 0.92,
        supportCount: 2,
        url: 'https://docs.usebruno.com/install'
      }
    ],
    responseShape: {
      shortAnswer: 'required' as const,
      steps: 'optional' as const,
      commands: 'optional' as const,
      citations: 'required' as const,
      confidence: 'required' as const,
      uncertainty: 'optional' as const
    }
  };
}

afterEach(() => {
  global.fetch = originalFetch;
});

describe('OllamaAnswerGenerationAdapter', () => {
  it('parses a JSON answer draft from Ollama chat responses', async () => {
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: {
          content: JSON.stringify({
            shortAnswer: 'Use the documented install steps.',
            steps: ['Open the install guide.', 'Run brew install bruno.'],
            commands: ['brew install bruno'],
            citedEvidenceIndexes: [1],
            confidence: 0.91
          })
        }
      })
    } as Response);
    const adapter = new OllamaAnswerGenerationAdapter({ fetchImpl: fetchMock, model: 'llama3.2:test' });

    await expect(adapter.generate(createRequest())).resolves.toEqual({
      shortAnswer: 'Use the documented install steps.',
      steps: ['Open the install guide.', 'Run brew install bruno.'],
      commands: ['brew install bruno'],
      citedEvidenceIndexes: [1],
      confidence: 0.91,
      uncertainty: undefined
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:11434/api/chat',
      expect.objectContaining({ method: 'POST' })
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toMatchObject({
      model: 'llama3.2:test',
      stream: false,
      format: 'json',
      options: {
        temperature: 0.2,
        num_predict: 400
      }
    });
  });

  it('surfaces invalid JSON payloads from Ollama', async () => {
    const adapter = new OllamaAnswerGenerationAdapter({
      fetchImpl: jest.fn<typeof fetch>().mockResolvedValue({
        ok: true,
        json: async () => ({
          message: {
            content: 'not json'
          }
        })
      } as Response)
    });

    await expect(adapter.generate(createRequest())).rejects.toThrow('Ollama answer generation returned invalid JSON');
  });

  it('surfaces HTTP failures from Ollama', async () => {
    const adapter = new OllamaAnswerGenerationAdapter({
      fetchImpl: jest.fn<typeof fetch>().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'model not found'
      } as Response)
    });

    await expect(adapter.generate(createRequest())).rejects.toThrow(
      'Ollama answer generation request failed with status 404: model not found'
    );
  });
});