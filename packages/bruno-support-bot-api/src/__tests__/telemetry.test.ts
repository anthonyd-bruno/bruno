import { describe, expect, it, jest } from '@jest/globals';

import type { EvidenceBundle, EvidencePackResult } from '../../../bruno-support-retrieval/src/index/types';
import type { AnswerGenerationDraft } from '../answer-generation-adapter';
import { apiErrorResponseSchema, chatResponseSchema } from '../api-contracts';
import {
  handleSupportBotApiRequest,
  type SupportBotApiDependencies,
  type SupportBotApiRetrievalResult
} from '../api-handlers';
import { redactSupportBotText, type SupportBotTelemetryEvent } from '../index';

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
  events: SupportBotTelemetryEvent[],
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
    telemetry: {
      emit: jest.fn(async (event: SupportBotTelemetryEvent) => {
        events.push(event);
      })
    },
    now: () => new Date('2026-03-09T12:00:00.000Z'),
    createAnswerId: () => 'answer-telemetry',
    serviceName: 'support-bot-api-test',
    modelVersion: 'fake-model-v1'
  };

  return { dependencies, retriever, answerGenerator };
}

describe('support bot telemetry', () => {
  it('redacts sensitive values for safe logging', () => {
    const result = redactSupportBotText(
      'Contact jane@example.com, open https://docs.usebruno.com/install, inspect /Users/jane/private.txt, token abcdefghijklmnopqrstuvwxyz'
    );

    expect(result.text).toContain('[redacted:email]');
    expect(result.text).toContain('[redacted:url]');
    expect(result.text).toContain('[redacted:path]');
    expect(result.text).toContain('[redacted:token]');
    expect(result.text).not.toContain('jane@example.com');
    expect(result.text).not.toContain('https://docs.usebruno.com/install');
    expect(result.text).not.toContain('/Users/jane/private.txt');
    expect(result.redactionKinds).toEqual(expect.arrayContaining(['email', 'url', 'path', 'token']));
  });

  it('emits PII-safe request, retrieval, generation, and completion telemetry for grounded answers', async () => {
    const events: SupportBotTelemetryEvent[] = [];
    const evidence = [
      createEvidence(),
      createEvidence({
        documentId: 'repo-doc',
        sourceType: 'repo',
        trustTier: 'repo',
        retrievalScore: 0.84,
        sourcePath: 'packages/bruno-cli/README.md',
        url: undefined
      })
    ];
    const { dependencies } = createDependencies(
      {
        evidence: createReadyEvidence(evidence, 2),
        sources: evidence
      },
      events,
      {
        shortAnswer: 'Install Bruno using the official docs.',
        citedEvidenceIndexes: [99],
        confidence: 0.91
      }
    );

    const response = await handleSupportBotApiRequest(
      {
        method: 'POST',
        path: '/chat',
        body: { query: 'How do I install Bruno with brew? Contact jane@example.com if needed.' }
      },
      dependencies
    );

    const body = chatResponseSchema.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.result).toBe('answer');
    expect(body.answer.citations).toHaveLength(0);
    expect(events.map((event) => event.type)).toEqual([
      'support_bot.request.started',
      'support_bot.retrieval.completed',
      'support_bot.generation.completed',
      'support_bot.request.completed'
    ]);

    const retrievalEvent = events[1];
    if (retrievalEvent.type !== 'support_bot.retrieval.completed') {
      throw new Error('Expected retrieval telemetry event.');
    }

    expect(retrievalEvent.query.redactionApplied).toBe(true);
    expect(retrievalEvent.query.redactionKinds).toContain('email');
    expect(retrievalEvent.route.intent).toBe('install');

    const generationEvent = events[2];
    if (generationEvent.type !== 'support_bot.generation.completed') {
      throw new Error('Expected generation telemetry event.');
    }

    expect(generationEvent.generation.citationSignal).toBe('citation_miss');
    expect(generationEvent.generation.citationCount).toBe(0);

    const completionEvent = events[3];
    if (completionEvent.type !== 'support_bot.request.completed') {
      throw new Error('Expected completion telemetry event.');
    }

    expect(completionEvent.completion.outcome).toBe('answer');
    expect(completionEvent.completion.citationSignal).toBe('citation_miss');

    const serialized = JSON.stringify(events);
    expect(serialized).not.toContain('How do I install Bruno with brew? Contact jane@example.com if needed.');
    expect(serialized).not.toContain('jane@example.com');
  });

  it('emits fallback telemetry for unanswered requests and skips generation telemetry', async () => {
    const events: SupportBotTelemetryEvent[] = [];
    const { dependencies, answerGenerator } = createDependencies(
      {
        evidence: {
          status: 'insufficient_evidence',
          reason: 'below_minimum_evidence',
          evidence: [],
          totalHits: 0,
          packedEvidenceCount: 0,
          minEvidence: 2
        },
        sources: []
      },
      events
    );

    const response = await handleSupportBotApiRequest(
      {
        method: 'POST',
        path: '/chat',
        body: { query: 'How much does Bruno cost for teams?' }
      },
      dependencies
    );

    const body = chatResponseSchema.parse(response.body);
    expect(response.statusCode).toBe(200);
    expect(body.result).toBe('fallback');
    expect(answerGenerator.generate).not.toHaveBeenCalled();
    expect(events.map((event) => event.type)).toEqual([
      'support_bot.request.started',
      'support_bot.retrieval.completed',
      'support_bot.request.completed'
    ]);

    const completionEvent = events[2];
    if (completionEvent.type !== 'support_bot.request.completed') {
      throw new Error('Expected completion telemetry event.');
    }

    expect(completionEvent.completion.outcome).toBe('fallback');
    expect(completionEvent.completion.unanswered).toBe(true);
    expect(completionEvent.completion.fallbackReason).toBe('insufficient_evidence');
    expect(completionEvent.completion.citationSignal).toBe('not_applicable');
  });

  it('emits redacted failure telemetry when retrieval throws', async () => {
    const events: SupportBotTelemetryEvent[] = [];
    const { dependencies, retriever } = createDependencies(
      {
        evidence: createReadyEvidence([createEvidence()]),
        sources: [createEvidence()]
      },
      events
    );

    retriever.retrieve.mockRejectedValue(
      new Error('Inspect /Users/jane/private.txt, email jane@example.com, token abcdefghijklmnopqrstuvwxyz')
    );

    const response = await handleSupportBotApiRequest(
      {
        method: 'POST',
        path: '/chat',
        body: { query: 'Why is my Bruno script failing?' }
      },
      dependencies
    );

    expect(response.statusCode).toBe(500);
    expect(apiErrorResponseSchema.parse(response.body).error.code).toBe('internal_error');
    expect(events.map((event) => event.type)).toEqual([
      'support_bot.request.started',
      'support_bot.request.failed'
    ]);

    const failureEvent = events[1];
    if (failureEvent.type !== 'support_bot.request.failed') {
      throw new Error('Expected failure telemetry event.');
    }

    expect(failureEvent.failure.stage).toBe('retrieval');
    expect(failureEvent.failure.error.message).toContain('[redacted:path]');
    expect(failureEvent.failure.error.message).toContain('[redacted:email]');
    expect(failureEvent.failure.error.message).toContain('[redacted:token]');
    expect(failureEvent.failure.error.message).not.toContain('/Users/jane/private.txt');
    expect(failureEvent.failure.error.message).not.toContain('jane@example.com');
  });
});