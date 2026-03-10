import type { EvidenceBundle, EvidencePackResult, SupportQueryIntent } from '../../bruno-support-retrieval/src/index/types';

import type { AnswerGenerationRequest, PromptEvidenceItem } from './answer-generation-adapter';
import {
  DEFAULT_GROUNDED_PROMPT_POLICY,
  assessEvidenceStrength,
  type GroundedPromptPolicy
} from './grounded-prompt-policy';
import { buildFallbackMessage, classifySafetyAndEscalation } from './safety-escalation';

export interface BuildAnswerGenerationRequestInput {
  query: string;
  routeIntent: SupportQueryIntent;
  evidence: EvidencePackResult;
  policy?: GroundedPromptPolicy;
  fallbackMessage?: string;
}

function toPromptEvidenceItem(item: EvidenceBundle, index: number): PromptEvidenceItem {
  return {
    index: index + 1,
    documentId: item.documentId,
    sourceType: item.sourceType,
    title: item.title,
    headingAnchor: item.headingAnchor,
    trustTier: item.trustTier,
    retrievalScore: item.retrievalScore,
    supportCount: item.supportCount,
    url: 'url' in item ? item.url : undefined,
    sourcePath: 'sourcePath' in item ? item.sourcePath : undefined
  };
}

function formatEvidenceLocation(item: PromptEvidenceItem): string {
  const location = item.url ?? item.sourcePath ?? 'unknown';

  return item.headingAnchor ? `${location}#${item.headingAnchor}` : location;
}

function formatEvidenceLine(item: PromptEvidenceItem): string {
  return [
    `[E${item.index}] ${item.title}`,
    `source=${item.sourceType}`,
    `trust=${item.trustTier}`,
    `score=${item.retrievalScore.toFixed(2)}`,
    `support=${item.supportCount}`,
    `location=${formatEvidenceLocation(item)}`
  ].join(' | ');
}

function buildSystemMessage(
  policy: GroundedPromptPolicy,
  mode: AnswerGenerationRequest['mode'],
  promptEvidence: PromptEvidenceItem[],
  fallbackMessage: string | undefined,
  assessment: AnswerGenerationRequest['assessment'],
  request: Pick<AnswerGenerationRequest, 'safety' | 'escalation'>
): string {
  const rules = [...policy.systemRules, ...(mode === 'fallback' ? policy.fallbackRules : [])];
  const lines = [
    `Policy version: ${policy.version}`,
    `Mode: ${mode}`,
    `Evidence strength: ${assessment.strength}`,
    `Safety classification: ${request.safety.classification}`,
    'Rules:',
    ...rules.map((rule, index) => `${index + 1}. ${rule}`),
    'Output requirements:',
    '- Provide shortAnswer.',
    '- Provide steps only when directly supported by the evidence.',
    '- Provide commands only when directly supported by the evidence.',
    mode === 'grounded'
      ? '- Cite evidence indexes for each substantive claim.'
      : '- State uncertainty explicitly and avoid unsupported claims.',
    promptEvidence.length > 0 ? `- You may cite evidence indexes E1-${promptEvidence.length}.` : '- No evidence indexes are available.'
  ];

  if (fallbackMessage) {
    lines.push(`- Fallback guidance: ${fallbackMessage}`);
  }

  if (request.escalation.shouldEscalate) {
    lines.push(`- Escalate to ${request.escalation.label}: ${request.escalation.destination}`);
  }

  return lines.join('\n');
}

function buildUserMessage(
  query: string,
  promptEvidence: PromptEvidenceItem[],
  fallbackMessage: string | undefined
): string {
  const evidenceSection =
    promptEvidence.length > 0
      ? promptEvidence.map((item) => formatEvidenceLine(item)).join('\n')
      : 'No evidence passed grounding checks.';
  const lines = ['User query:', query, '', 'Available evidence:', evidenceSection];

  if (fallbackMessage) {
    lines.push('', 'Fallback guidance:', fallbackMessage);
  }

  return lines.join('\n');
}

export function buildAnswerGenerationRequest(input: BuildAnswerGenerationRequestInput): AnswerGenerationRequest {
  const policy = input.policy ?? DEFAULT_GROUNDED_PROMPT_POLICY;
  const assessment = assessEvidenceStrength(input.evidence, policy);
  const promptEvidence = input.evidence.status === 'ready' ? input.evidence.evidence.map(toPromptEvidenceItem) : [];
  const safetyDecision = classifySafetyAndEscalation({
    query: input.query,
    routeIntent: input.routeIntent,
    assessment
  });
  const mode: AnswerGenerationRequest['mode'] = safetyDecision.safety.requiresFallback ? 'fallback' : 'grounded';
  const fallbackMessage = buildFallbackMessage(safetyDecision, input.fallbackMessage);

  return {
    policyVersion: policy.version,
    mode,
    query: input.query,
    assessment,
    safety: safetyDecision.safety,
    escalation: safetyDecision.escalation,
    evidence: promptEvidence,
    fallbackMessage,
    responseShape: {
      shortAnswer: 'required',
      steps: 'optional',
      commands: 'optional',
      citations: mode === 'grounded' && promptEvidence.length > 0 ? 'required' : 'optional',
      confidence: 'required',
      uncertainty: mode === 'grounded' ? 'optional' : 'required'
    },
    messages: [
      {
        role: 'system',
        content: buildSystemMessage(policy, mode, promptEvidence, fallbackMessage, assessment, safetyDecision)
      },
      {
        role: 'user',
        content: buildUserMessage(input.query, promptEvidence, fallbackMessage)
      }
    ]
  };
}