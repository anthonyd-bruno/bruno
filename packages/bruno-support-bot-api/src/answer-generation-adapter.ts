import type { IndexedChunkSourceType, IndexedChunkTrustTier } from '../../bruno-support-retrieval/src/index/types';

import type { GroundedEvidenceAssessment } from './grounded-prompt-policy';
import type { SupportAnswerEscalation, SupportAnswerSafety } from './safety-escalation';

export type AnswerGenerationMode = 'grounded' | 'fallback';
export type CitationRequirement = 'required' | 'optional';
export type UncertaintyRequirement = 'required' | 'optional';

export interface PromptMessage {
  role: 'system' | 'user';
  content: string;
}

export interface PromptEvidenceItem {
  index: number;
  documentId: string;
  sourceType: IndexedChunkSourceType;
  title: string;
  headingAnchor?: string;
  trustTier: IndexedChunkTrustTier;
  retrievalScore: number;
  supportCount: number;
  url?: string;
  sourcePath?: string;
}

export interface AnswerGenerationResponseShape {
  shortAnswer: 'required';
  steps: 'optional';
  commands: 'optional';
  citations: CitationRequirement;
  confidence: 'required';
  uncertainty: UncertaintyRequirement;
}

export interface AnswerGenerationRequest {
  policyVersion: string;
  mode: AnswerGenerationMode;
  query: string;
  assessment: GroundedEvidenceAssessment;
  safety: SupportAnswerSafety;
  escalation: SupportAnswerEscalation;
  messages: PromptMessage[];
  evidence: PromptEvidenceItem[];
  fallbackMessage?: string;
  responseShape: AnswerGenerationResponseShape;
}

export interface AnswerGenerationDraft {
  shortAnswer: string;
  steps?: string[];
  commands?: string[];
  citedEvidenceIndexes?: number[];
  confidence?: number;
  uncertainty?: string;
}

export interface AnswerGenerationAdapter {
  generate(request: AnswerGenerationRequest): Promise<AnswerGenerationDraft>;
}