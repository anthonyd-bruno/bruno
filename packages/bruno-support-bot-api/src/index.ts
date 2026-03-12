export * from './grounded-prompt-policy';
export * from './answer-generation-adapter';
export * from './answer-generation-json';
export * from './openai-answer-generation-adapter';
export * from './ollama-answer-generation-adapter';
export * from './prompt-builder';
export * from './answer-assembly';
export * from './api-contracts';
export * from './api-validation';
export * from './api-handlers';
export * from './server';
export * from './safety-escalation';
export * from './telemetry';

import {
  DEFAULT_GROUNDED_PROMPT_POLICY,
  GROUNDED_PROMPT_POLICY_VERSION,
  assessEvidenceStrength
} from './grounded-prompt-policy';
import { OpenAIAnswerGenerationAdapter } from './openai-answer-generation-adapter';
import { OllamaAnswerGenerationAdapter } from './ollama-answer-generation-adapter';
import { buildAnswerGenerationRequest } from './prompt-builder';
import { assembleSupportAnswer, toSharedAnswer, toSharedCitation } from './answer-assembly';
import { buildFallbackMessage, classifySafetyAndEscalation, OFFICIAL_BRUNO_DESTINATIONS } from './safety-escalation';
import { determineSupportBotCitationSignal, redactSupportBotText, summarizeSupportBotText } from './telemetry';
import {
  handleChatRequest,
  handleHealthRequest,
  handleSourcesRequest,
  handleSupportBotApiRequest
} from './api-handlers';
import { createSupportBotApiServer } from './server';

export const supportBotApi = {
  DEFAULT_GROUNDED_PROMPT_POLICY,
  GROUNDED_PROMPT_POLICY_VERSION,
  assessEvidenceStrength,
  OpenAIAnswerGenerationAdapter,
  OllamaAnswerGenerationAdapter,
  buildAnswerGenerationRequest,
  assembleSupportAnswer,
  classifySafetyAndEscalation,
  buildFallbackMessage,
  OFFICIAL_BRUNO_DESTINATIONS,
  toSharedAnswer,
  toSharedCitation,
  redactSupportBotText,
  summarizeSupportBotText,
  determineSupportBotCitationSignal,
  handleHealthRequest,
  handleSourcesRequest,
  handleChatRequest,
  handleSupportBotApiRequest,
  createSupportBotApiServer
};