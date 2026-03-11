import { afterEach, describe, expect, it, jest } from '@jest/globals';

import type { AnswerGenerationRequest } from '../answer-generation-adapter';
import { OpenAIAnswerGenerationAdapter } from '../openai-answer-generation-adapter';

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
  delete process.env.OPENAI_API_KEY;
});

describe('OpenAIAnswerGenerationAdapter', () => {
  it('parses a JSON answer draft from OpenAI chat completions', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                shortAnswer: 'Use the documented install steps.',
                steps: ['Open the install guide.', 'Run brew install bruno.'],
                commands: ['brew install bruno'],
                citedEvidenceIndexes: [1],
                confidence: 0.91
              })
            }
          }
        ]
      })
    } as Response);
    const adapter = new OpenAIAnswerGenerationAdapter({ fetchImpl: fetchMock, model: 'gpt-test-mini' });

    await expect(adapter.generate(createRequest())).resolves.toEqual({
      shortAnswer: 'Use the documented install steps.',
      steps: ['Open the install guide.', 'Run brew install bruno.'],
      commands: ['brew install bruno'],
      citedEvidenceIndexes: [1],
      confidence: 0.91,
      uncertainty: undefined
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('fails fast when the API key is missing', async () => {
    const adapter = new OpenAIAnswerGenerationAdapter({ fetchImpl: jest.fn<typeof fetch>() });

    await expect(adapter.generate(createRequest())).rejects.toThrow(
      'OpenAI API key is required for support-bot answer generation.'
    );
  });

  it('surfaces invalid JSON payloads from the provider', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const adapter = new OpenAIAnswerGenerationAdapter({
      fetchImpl: jest.fn<typeof fetch>().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: 'not json'
              }
            }
          ]
        })
      } as Response)
    });

    await expect(adapter.generate(createRequest())).rejects.toThrow('OpenAI answer generation returned invalid JSON');
  });
});