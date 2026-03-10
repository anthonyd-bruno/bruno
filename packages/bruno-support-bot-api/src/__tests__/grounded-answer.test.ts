import { describe, expect, it } from '@jest/globals';

import type { EvidenceBundle, EvidencePackResult } from '../../../bruno-support-retrieval/src/index/types';
import {
  DEFAULT_GROUNDED_PROMPT_POLICY,
  GROUNDED_PROMPT_POLICY_VERSION,
  OFFICIAL_BRUNO_DESTINATIONS,
  assembleSupportAnswer,
  buildAnswerGenerationRequest,
  toSharedAnswer
} from '../index';

function createEvidence(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  const { sourcePath, url, ...rest } = overrides as Partial<EvidenceBundle> & {
    sourcePath?: string;
    url?: string;
  };
  const defaults: {
    documentId: string;
    sourceType: EvidenceBundle['sourceType'];
    title: string;
    headingAnchor: string;
    trustTier: EvidenceBundle['trustTier'];
    retrievalScore: number;
    supportCount: number;
    supportingChunkIds: string[];
  } = {
    documentId: 'doc-1',
    sourceType: 'docs_site',
    title: 'Install Bruno',
    headingAnchor: 'install',
    trustTier: 'official_docs',
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

function createReadyEvidence(evidence: EvidenceBundle[]): EvidencePackResult {
  return {
    status: 'ready',
    evidence,
    totalHits: evidence.length,
    packedEvidenceCount: evidence.length,
    minEvidence: 1
  };
}

function createInsufficientEvidence(): EvidencePackResult {
  return {
    status: 'insufficient_evidence',
    reason: 'below_minimum_evidence',
    evidence: [],
    totalHits: 0,
    packedEvidenceCount: 0,
    minEvidence: 2
  };
}

describe('grounded answer generation policy', () => {
  it('builds a grounded request for strong evidence', () => {
    const request = buildAnswerGenerationRequest({
      query: 'How do I install Bruno?',
      routeIntent: 'install',
      evidence: createReadyEvidence([
        createEvidence(),
        createEvidence({
          documentId: 'doc-2',
          title: 'CLI Install Guide',
          headingAnchor: 'cli-install',
          retrievalScore: 0.88,
          url: 'https://docs.usebruno.com/cli/install'
        })
      ])
    });

    expect(request.policyVersion).toBe(GROUNDED_PROMPT_POLICY_VERSION);
    expect(request.mode).toBe('grounded');
    expect(request.assessment).toMatchObject({
      strength: 'strong',
      reason: 'meets_grounding_threshold',
      qualifyingEvidenceCount: 2
    });
    expect(request.responseShape).toMatchObject({
      citations: 'required',
      uncertainty: 'optional'
    });
    expect(request.messages[0].content).toContain(`Policy version: ${GROUNDED_PROMPT_POLICY_VERSION}`);
    expect(request.messages[1].content).toContain('[E1] Install Bruno');
    expect(request.messages[1].content).toContain('https://docs.usebruno.com/install#install');
  });

  it('switches weak evidence into fallback mode with explicit uncertainty requirements', () => {
    const request = buildAnswerGenerationRequest({
      query: 'Why is my Bruno script failing?',
      routeIntent: 'troubleshooting',
      evidence: createReadyEvidence([
        createEvidence({
          documentId: 'doc-community',
          sourceType: 'stackoverflow',
          trustTier: 'external',
          retrievalScore: 0.52,
          supportCount: 1,
          url: 'https://stackoverflow.com/a/123'
        })
      ]),
      fallbackMessage: 'Ask the user for the exact error output before suggesting a fix.'
    });

    expect(request.mode).toBe('fallback');
    expect(request.assessment).toMatchObject({
      strength: 'weak',
      reason: 'weak_evidence',
      qualifyingEvidenceCount: 0
    });
    expect(request.responseShape).toMatchObject({
      citations: 'optional',
      uncertainty: 'required'
    });
    expect(request.safety).toMatchObject({
      classification: 'low_confidence',
      requiresFallback: true,
      fallbackReason: 'weak_evidence'
    });
    expect(request.escalation).toMatchObject({
      channel: 'github_issues',
      shouldEscalate: true,
      destination: OFFICIAL_BRUNO_DESTINATIONS.issues
    });
    expect(request.messages[0].content).toContain('State uncertainty explicitly and avoid unsupported claims.');
    expect(request.messages[0].content).toContain('Ask the user for the exact error output before suggesting a fix.');
  });

  it('shapes structured answers with steps, commands, and mixed citation types', () => {
    const request = buildAnswerGenerationRequest({
      query: 'How do I install Bruno from the command line?',
      routeIntent: 'cli',
      evidence: createReadyEvidence([
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
      ])
    });

    const answer = assembleSupportAnswer({
      request,
      draft: {
        shortAnswer: 'Install Bruno with the documented package or download steps.',
        steps: ['Open the Bruno install guide.', 'Run the documented package-manager command.'],
        commands: ['brew install bruno'],
        citedEvidenceIndexes: [1, 2],
        confidence: 0.93
      },
      answerId: 'answer-1',
      generatedAt: new Date('2026-03-09T00:00:00.000Z'),
      modelVersion: 'test-model'
    });

    expect(answer).toMatchObject({
      id: 'answer-1',
      shortAnswer: 'Install Bruno with the documented package or download steps.',
      confidence: 0.93,
      confidenceLabel: 'high',
      policyVersion: GROUNDED_PROMPT_POLICY_VERSION,
      mode: 'grounded',
      modelVersion: 'test-model'
    });
    expect(answer.content).toContain('Steps:\n1. Open the Bruno install guide.');
    expect(answer.content).toContain('Commands:\n- brew install bruno');
    expect(answer.citations).toHaveLength(2);
    expect(answer.citations[1]).toMatchObject({
      documentId: 'repo-doc',
      sourcePath: 'packages/bruno-cli/README.md'
    });

    const sharedAnswer = toSharedAnswer(answer);
    expect(sharedAnswer.citations).toHaveLength(1);
    expect(sharedAnswer.citations[0].url).toBe('https://docs.usebruno.com/install');
  });

  it('preserves prompt versioning through the default policy and generated requests', () => {
    const request = buildAnswerGenerationRequest({
      query: 'What is the latest Bruno release?',
      routeIntent: 'version_release',
      evidence: createReadyEvidence([createEvidence({ retrievalScore: 0.9 }), createEvidence({ documentId: 'doc-2', retrievalScore: 0.87 })]),
      policy: DEFAULT_GROUNDED_PROMPT_POLICY
    });

    expect(DEFAULT_GROUNDED_PROMPT_POLICY.version).toBe(GROUNDED_PROMPT_POLICY_VERSION);
    expect(request.policyVersion).toBe(DEFAULT_GROUNDED_PROMPT_POLICY.version);
    expect(request.messages[0].content).toContain(`Policy version: ${DEFAULT_GROUNDED_PROMPT_POLICY.version}`);
  });

  it('handles empty evidence by producing fallback-safe output', () => {
    const request = buildAnswerGenerationRequest({
      query: 'How do I fix this unknown Bruno issue?',
      routeIntent: 'unknown',
      evidence: createInsufficientEvidence()
    });

    expect(request.mode).toBe('fallback');
    expect(request.assessment).toMatchObject({
      strength: 'insufficient',
      reason: 'insufficient_evidence'
    });
    expect(request.safety).toMatchObject({
      classification: 'insufficient_evidence',
      requiresFallback: true,
      fallbackReason: 'insufficient_evidence'
    });
    expect(request.escalation).toMatchObject({
      channel: 'github_discussions',
      shouldEscalate: true,
      destination: OFFICIAL_BRUNO_DESTINATIONS.discussions
    });
    expect(request.messages[1].content).toContain('No evidence passed grounding checks.');

    const answer = assembleSupportAnswer({
      request,
      draft: {
        shortAnswer: 'I cannot confirm a supported fix from the available evidence.',
        confidence: 0.95
      },
      generatedAt: new Date('2026-03-09T01:00:00.000Z')
    });

    expect(answer.confidence).toBe(0.49);
    expect(answer.confidenceLabel).toBe('low');
    expect(answer.uncertainty).toBe('Please continue this question in Bruno GitHub Discussions for official community support.');
    expect(answer.citations).toEqual([]);
    expect(answer.fallbackReason).toBe('insufficient_evidence');
    expect(answer.escalation).toMatchObject({
      channel: 'github_discussions',
      destination: OFFICIAL_BRUNO_DESTINATIONS.discussions
    });
  });

  it('forces security-sensitive queries into security escalation even when evidence is strong', () => {
    const request = buildAnswerGenerationRequest({
      query: 'I found an XSS vulnerability in Bruno. How should I report it?',
      routeIntent: 'auth',
      evidence: createReadyEvidence([createEvidence(), createEvidence({ documentId: 'doc-2', retrievalScore: 0.89 })])
    });

    expect(request.mode).toBe('fallback');
    expect(request.safety).toMatchObject({
      classification: 'security_sensitive',
      requiresFallback: true,
      fallbackReason: 'security_sensitive'
    });
    expect(request.escalation).toMatchObject({
      channel: 'security_email',
      shouldEscalate: true,
      destination: OFFICIAL_BRUNO_DESTINATIONS.securityEmail
    });

    const answer = assembleSupportAnswer({
      request,
      draft: { shortAnswer: '' },
      generatedAt: new Date('2026-03-09T02:00:00.000Z')
    });

    expect(answer.shortAnswer).toContain(OFFICIAL_BRUNO_DESTINATIONS.securityEmailAddress);
    expect(answer.fallbackReason).toBe('security_sensitive');
    expect(answer.escalation).toMatchObject({
      channel: 'security_email',
      destination: OFFICIAL_BRUNO_DESTINATIONS.securityEmail
    });
  });

  it('does not over-classify ordinary auth questions as security incidents', () => {
    const request = buildAnswerGenerationRequest({
      query: 'How do I use a bearer token in Bruno?',
      routeIntent: 'auth',
      evidence: createReadyEvidence([createEvidence(), createEvidence({ documentId: 'doc-2', retrievalScore: 0.87 })])
    });

    expect(request.mode).toBe('grounded');
    expect(request.safety).toMatchObject({
      classification: 'normal',
      requiresFallback: false
    });
    expect(request.escalation).toMatchObject({
      channel: 'none',
      shouldEscalate: false
    });
  });

  it('selects deterministic official escalation destinations for non-security fallback cases', () => {
    expect(
      buildAnswerGenerationRequest({
        query: 'How much does Bruno cost?',
        routeIntent: 'pricing',
        evidence: createInsufficientEvidence()
      }).escalation
    ).toMatchObject({ channel: 'pricing', destination: OFFICIAL_BRUNO_DESTINATIONS.pricing });

    expect(
      buildAnswerGenerationRequest({
        query: 'How do I download Bruno for macOS?',
        routeIntent: 'install',
        evidence: createInsufficientEvidence()
      }).escalation
    ).toMatchObject({ channel: 'downloads', destination: OFFICIAL_BRUNO_DESTINATIONS.downloads });

    expect(
      buildAnswerGenerationRequest({
        query: 'Where should I ask a Bruno question?',
        routeIntent: 'unknown',
        evidence: createInsufficientEvidence()
      }).escalation
    ).toMatchObject({ channel: 'github_discussions', destination: OFFICIAL_BRUNO_DESTINATIONS.discussions });

    expect(
      buildAnswerGenerationRequest({
        query: 'How does bru run work?',
        routeIntent: 'cli',
        evidence: createInsufficientEvidence()
      }).escalation
    ).toMatchObject({ channel: 'docs', destination: OFFICIAL_BRUNO_DESTINATIONS.docs });
  });
});