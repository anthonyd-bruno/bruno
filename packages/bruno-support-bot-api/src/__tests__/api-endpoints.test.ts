import type { IncomingMessage } from 'http';
import { Readable } from 'stream';

import { describe, expect, it, jest } from '@jest/globals';

import type { EvidenceBundle, EvidencePackResult } from '../../../bruno-support-retrieval/src/index/types';
import type { AnswerGenerationDraft } from '../answer-generation-adapter';
import {
  apiErrorResponseSchema,
  chatResponseSchema,
  healthResponseSchema,
  sourcesResponseSchema,
} from '../api-contracts';
import { OFFICIAL_BRUNO_DESTINATIONS } from '../index';
import {
  handleSupportBotApiRequest,
  type SupportBotApiDependencies,
  type SupportBotApiRetrievalResult
} from '../api-handlers';
import { handleNodeHttpRequest } from '../server';

function createEvidence(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  const { sourcePath, url, ...rest } = overrides as Partial<EvidenceBundle> & {
    sourcePath?: string;
    url?: string;
  };

  const defaults = {
    documentId: 'doc-1',
    sourceType: 'docs_site' as const,
    title: 'Install Bruno',
    headingAnchor: 'install',
    trustTier: 'official_docs' as const,
    retrievalScore: 0.91,
    supportCount: 2,
    supportingChunkIds: ['chunk-1', 'chunk-2']
  };

  if (sourcePath) {
    return {
      ...defaults,
      ...rest,
      sourcePath
    };
  }

  return {
    ...defaults,
    ...rest,
    url: url ?? 'https://docs.usebruno.com/install'
  };
}

function createReadyEvidence(evidence: EvidenceBundle[], minEvidence = 1): EvidencePackResult {
  return {
    status: 'ready',
    evidence,
    totalHits: evidence.length,
    packedEvidenceCount: evidence.length,
    minEvidence
  };
}

function createDependencies(
  retrievalResult: SupportBotApiRetrievalResult,
  draft: AnswerGenerationDraft = { shortAnswer: 'Use the official install guide.' }
) {
  const retriever = {
    retrieve: jest.fn<() => Promise<SupportBotApiRetrievalResult>>().mockResolvedValue(retrievalResult)
  };
  const answerGenerator = {
    generate: jest.fn<() => Promise<AnswerGenerationDraft>>().mockResolvedValue(draft)
  };

  const dependencies: SupportBotApiDependencies = {
    retriever,
    answerGenerator,
    now: () => new Date('2026-03-09T12:00:00.000Z'),
    createAnswerId: () => 'answer-123',
    serviceName: 'support-bot-api-test',
    modelVersion: 'fake-model-v1'
  };

  return { dependencies, retriever, answerGenerator };
}

function createNodeHttpRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: string;
}): IncomingMessage {
  const request = Readable.from(options.body === undefined ? [] : [options.body]) as IncomingMessage;

  Object.assign(request, {
    method: options.method ?? 'GET',
    url: options.url ?? '/',
    headers: {
      host: 'localhost',
      ...(options.headers ?? {})
    }
  });

  return request;
}

describe('chat API endpoints', () => {
  it('returns a healthy status payload for GET /health', async () => {
    const { dependencies } = createDependencies({
      evidence: createReadyEvidence([createEvidence()]),
      sources: [createEvidence()]
    });

    const response = await handleSupportBotApiRequest({ method: 'GET', path: '/health' }, dependencies);

    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(response.body)).toMatchObject({
      ok: true,
      service: 'support-bot-api-test',
      status: 'ok'
    });
  });

  it('returns query-driven evidence inspection for GET /sources', async () => {
    const evidence = [
      createEvidence(),
      createEvidence({
        documentId: 'repo-doc',
        sourceType: 'repo',
        trustTier: 'repo',
        retrievalScore: 0.86,
        sourcePath: 'packages/bruno-cli/README.md',
        url: undefined
      })
    ];
    const { dependencies, retriever } = createDependencies({
      evidence: createReadyEvidence(evidence, 2),
      sources: evidence
    });

    const response = await handleSupportBotApiRequest(
      {
        method: 'GET',
        path: '/sources',
        query: { query: 'How do I install Bruno on macOS with brew?' }
      },
      dependencies
    );

    expect(response.statusCode).toBe(200);
    const body = sourcesResponseSchema.parse(response.body);

    expect(body.query).toBe('How do I install Bruno on macOS with brew?');
    expect(body.route.intent).toBe('install');
    expect(body.sources).toHaveLength(2);
    expect(body.sources[1]).toMatchObject({ sourcePath: 'packages/bruno-cli/README.md' });
    expect(retriever.retrieve).toHaveBeenCalledTimes(1);
    expect(retriever.retrieve.mock.calls[0][0]).toMatchObject({ query: 'How do I install Bruno on macOS with brew?' });
  });

  it('returns a grounded answer payload for POST /chat', async () => {
    const evidence = [
      createEvidence(),
      createEvidence({
        documentId: 'repo-doc',
        sourceType: 'repo',
        title: 'CLI README',
        trustTier: 'repo',
        retrievalScore: 0.84,
        sourcePath: 'packages/bruno-cli/README.md',
        url: undefined
      })
    ];
    const { dependencies, answerGenerator } = createDependencies(
      {
        evidence: createReadyEvidence(evidence, 2),
        sources: evidence
      },
      {
        shortAnswer: 'Install Bruno using the documented package-manager steps.',
        steps: ['Open the install guide.', 'Run the documented package-manager command.'],
        commands: ['brew install bruno'],
        citedEvidenceIndexes: [1, 2],
        confidence: 0.93
      }
    );

    const response = await handleSupportBotApiRequest(
      {
        method: 'POST',
        path: '/chat',
        body: { query: 'How do I install Bruno?' }
      },
      dependencies
    );

    expect(response.statusCode).toBe(200);
    const body = chatResponseSchema.parse(response.body);

    expect(body.result).toBe('answer');
    expect(body.answer.id).toBe('answer-123');
    expect(body.answer.confidence).toBe(0.93);
    expect(body.answer.citations).toHaveLength(2);
    expect(body.answer.citations[1]).toMatchObject({ sourcePath: 'packages/bruno-cli/README.md' });
    expect(answerGenerator.generate).toHaveBeenCalledTimes(1);
  });

  it('returns explicit validation errors for invalid request input', async () => {
    const { dependencies } = createDependencies({
      evidence: createReadyEvidence([createEvidence()]),
      sources: [createEvidence()]
    });

    const response = await handleSupportBotApiRequest(
      {
        method: 'POST',
        path: '/chat',
        body: { query: '   ' }
      },
      dependencies
    );

    expect(response.statusCode).toBe(400);
    const body = apiErrorResponseSchema.parse(response.body);

    expect(body.error.code).toBe('validation_error');
    expect(body.error.details).toContainEqual(
      expect.objectContaining({ path: 'query', message: 'Query is required.' })
    );
  });

  it('preserves the validation error contract for invalid JSON in the Node HTTP wrapper', async () => {
    const { dependencies } = createDependencies({
      evidence: createReadyEvidence([createEvidence()]),
      sources: [createEvidence()]
    });

    const response = await handleNodeHttpRequest(
      createNodeHttpRequest({
        method: 'POST',
        url: '/chat',
        headers: { 'content-type': 'application/json' },
        body: '{"query":'
      }),
      dependencies
    );

    expect(response.statusCode).toBe(400);
    const body = apiErrorResponseSchema.parse(response.body);

    expect(body.error.code).toBe('validation_error');
    expect(body.error.message).toBe('Request body must be valid JSON.');
    expect(body.error.details).toContainEqual({
      path: 'body',
      message: 'Request body must be valid JSON.',
      code: 'invalid_json'
    });
  });

  it('skips answer generation and returns deterministic fallback output for weak evidence', async () => {
    const weakEvidence = [
      createEvidence({
        documentId: 'community-doc',
        sourceType: 'stackoverflow',
        trustTier: 'external',
        retrievalScore: 0.52,
        supportCount: 1,
        url: 'https://stackoverflow.com/a/123'
      })
    ];
    const { dependencies, answerGenerator } = createDependencies({
      evidence: createReadyEvidence(weakEvidence, 1),
      sources: weakEvidence
    });

    const response = await handleSupportBotApiRequest(
      {
        method: 'POST',
        path: '/chat',
        body: { query: 'Why is my Bruno script failing?' }
      },
      dependencies
    );

    expect(response.statusCode).toBe(200);
    const body = chatResponseSchema.parse(response.body);

    expect(body.result).toBe('fallback');
    if (body.result !== 'fallback') {
      throw new Error('Expected a fallback response.');
    }

    expect(body.reason).toBe('weak_evidence');
    expect(body.skippedGeneration).toBe(true);
    expect(body.answer.mode).toBe('fallback');
    expect(body.answer.fallbackReason).toBe('weak_evidence');
    expect(body.answer.safety).toMatchObject({
      classification: 'low_confidence',
      requiresFallback: true,
      fallbackReason: 'weak_evidence'
    });
    expect(body.answer.escalation).toMatchObject({
      channel: 'github_issues',
      shouldEscalate: true,
      destination: OFFICIAL_BRUNO_DESTINATIONS.issues
    });
    expect(body.answer.shortAnswer).toBe('I do not have enough reliable Bruno support evidence to answer that confidently.');
    expect(answerGenerator.generate).not.toHaveBeenCalled();
  });

  it('returns pricing escalation for insufficient-evidence pricing questions', async () => {
    const { dependencies, answerGenerator } = createDependencies({
      evidence: {
        status: 'insufficient_evidence',
        reason: 'below_minimum_evidence',
        evidence: [],
        totalHits: 0,
        packedEvidenceCount: 0,
        minEvidence: 1
      },
      sources: []
    });

    const response = await handleSupportBotApiRequest(
      {
        method: 'POST',
        path: '/chat',
        body: { query: 'How much does Bruno cost for teams?' }
      },
      dependencies
    );

    expect(response.statusCode).toBe(200);
    const body = chatResponseSchema.parse(response.body);

    expect(body.result).toBe('fallback');
    if (body.result !== 'fallback') {
      throw new Error('Expected a fallback response.');
    }

    expect(body.reason).toBe('insufficient_evidence');
    expect(body.answer.safety.classification).toBe('insufficient_evidence');
    expect(body.answer.escalation).toMatchObject({
      channel: 'pricing',
      destination: OFFICIAL_BRUNO_DESTINATIONS.pricing
    });
    expect(answerGenerator.generate).not.toHaveBeenCalled();
  });

  it('routes security-sensitive queries to security@usebruno.com instead of public issue guidance', async () => {
    const strongEvidence = [
      createEvidence(),
      createEvidence({
        documentId: 'doc-2',
        title: 'Auth docs',
        retrievalScore: 0.89,
        url: 'https://docs.usebruno.com/auth/bearer'
      })
    ];
    const { dependencies, answerGenerator } = createDependencies({
      evidence: createReadyEvidence(strongEvidence, 2),
      sources: strongEvidence
    });

    const response = await handleSupportBotApiRequest(
      {
        method: 'POST',
        path: '/chat',
        body: { query: 'I found an XSS vulnerability in Bruno. How should I report it?' }
      },
      dependencies
    );

    expect(response.statusCode).toBe(200);
    const body = chatResponseSchema.parse(response.body);

    expect(body.result).toBe('fallback');
    if (body.result !== 'fallback') {
      throw new Error('Expected a fallback response.');
    }

    expect(body.reason).toBe('security_sensitive');
    expect(body.answer.safety.classification).toBe('security_sensitive');
    expect(body.answer.escalation).toMatchObject({
      channel: 'security_email',
      destination: OFFICIAL_BRUNO_DESTINATIONS.securityEmail
    });
    expect(body.answer.shortAnswer).toContain('security@usebruno.com');
    expect(answerGenerator.generate).not.toHaveBeenCalled();
  });

  it('keeps ambiguous auth questions out of the security escalation path', async () => {
    const evidence = [
      createEvidence(),
      createEvidence({
        documentId: 'doc-2',
        title: 'Bearer auth',
        retrievalScore: 0.88,
        url: 'https://docs.usebruno.com/auth/bearer'
      })
    ];
    const { dependencies, answerGenerator } = createDependencies(
      {
        evidence: createReadyEvidence(evidence, 2),
        sources: evidence
      },
      {
        shortAnswer: 'Use the documented bearer token configuration in Bruno.',
        citedEvidenceIndexes: [1, 2],
        confidence: 0.9
      }
    );

    const response = await handleSupportBotApiRequest(
      {
        method: 'POST',
        path: '/chat',
        body: { query: 'How do I set a bearer token in Bruno?' }
      },
      dependencies
    );

    expect(response.statusCode).toBe(200);
    const body = chatResponseSchema.parse(response.body);

    expect(body.result).toBe('answer');
    if (body.result !== 'answer') {
      throw new Error('Expected a grounded answer response.');
    }

    expect(body.answer.safety).toMatchObject({
      classification: 'normal',
      requiresFallback: false
    });
    expect(body.answer.escalation).toMatchObject({
      channel: 'none',
      shouldEscalate: false
    });
    expect(answerGenerator.generate).toHaveBeenCalledTimes(1);
  });
});