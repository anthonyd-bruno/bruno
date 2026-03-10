import type { EvidencePackResult, IndexedChunkTrustTier } from '../../bruno-support-retrieval/src/index/types';

export const GROUNDED_PROMPT_POLICY_VERSION = 'bruno-support-grounded-answer/v1';

export type EvidenceStrength = 'strong' | 'weak' | 'insufficient';
export type EvidenceAssessmentReason = 'meets_grounding_threshold' | 'weak_evidence' | 'insufficient_evidence';

export interface GroundedPromptPolicy {
  version: string;
  minimumStrongEvidenceCount: number;
  minimumStrongEvidenceScore: number;
  strongTrustTiers: IndexedChunkTrustTier[];
  systemRules: readonly string[];
  fallbackRules: readonly string[];
}

export interface GroundedEvidenceAssessment {
  strength: EvidenceStrength;
  reason: EvidenceAssessmentReason;
  evidenceCount: number;
  qualifyingEvidenceCount: number;
  strongestEvidenceScore?: number;
}

export const DEFAULT_GROUNDED_PROMPT_POLICY: GroundedPromptPolicy = {
  version: GROUNDED_PROMPT_POLICY_VERSION,
  minimumStrongEvidenceCount: 2,
  minimumStrongEvidenceScore: 0.75,
  strongTrustTiers: ['official_docs', 'repo'],
  systemRules: [
    'Answer only from the supplied Bruno support evidence.',
    'Do not invent product behavior, commands, versions, or troubleshooting steps.',
    'Every substantive claim must be supported by the supplied evidence.',
    'Prefer concise, direct language for the short answer.',
    'Only include steps or commands when the evidence directly supports them.'
  ],
  fallbackRules: [
    'If evidence is weak or insufficient, say that explicitly.',
    'Prefer safe next steps over speculative fixes.',
    'Do not present uncertain guidance as confirmed Bruno behavior.'
  ]
};

function qualifiesForStrongGrounding(
  trustTier: IndexedChunkTrustTier,
  retrievalScore: number,
  policy: GroundedPromptPolicy
): boolean {
  return policy.strongTrustTiers.includes(trustTier) && retrievalScore >= policy.minimumStrongEvidenceScore;
}

export function assessEvidenceStrength(
  result: EvidencePackResult,
  policy: GroundedPromptPolicy = DEFAULT_GROUNDED_PROMPT_POLICY
): GroundedEvidenceAssessment {
  const evidence = result.status === 'ready' ? result.evidence : [];
  const strongestEvidenceScore = evidence.length > 0 ? Math.max(...evidence.map((item) => item.retrievalScore)) : undefined;
  const qualifyingEvidenceCount = evidence.filter((item) =>
    qualifiesForStrongGrounding(item.trustTier, item.retrievalScore, policy)
  ).length;

  if (result.status !== 'ready' || evidence.length === 0) {
    return {
      strength: 'insufficient',
      reason: 'insufficient_evidence',
      evidenceCount: evidence.length,
      qualifyingEvidenceCount,
      strongestEvidenceScore
    };
  }

  if (qualifyingEvidenceCount >= policy.minimumStrongEvidenceCount) {
    return {
      strength: 'strong',
      reason: 'meets_grounding_threshold',
      evidenceCount: evidence.length,
      qualifyingEvidenceCount,
      strongestEvidenceScore
    };
  }

  return {
    strength: 'weak',
    reason: 'weak_evidence',
    evidenceCount: evidence.length,
    qualifyingEvidenceCount,
    strongestEvidenceScore
  };
}