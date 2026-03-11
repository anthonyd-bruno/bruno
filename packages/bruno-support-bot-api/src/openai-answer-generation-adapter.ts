import type { AnswerGenerationAdapter, AnswerGenerationDraft, AnswerGenerationRequest, PromptMessage } from './answer-generation-adapter';

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_COMPLETION_TOKENS = 400;

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
      refusal?: string;
    };
  }>;
}

export interface OpenAIAnswerGenerationAdapterConfig {
  apiKey?: string;
  model?: string;
  endpoint?: string;
  temperature?: number;
  maxCompletionTokens?: number;
  fetchImpl?: typeof fetch;
}

function buildJsonInstructionMessage(): PromptMessage {
  return {
    role: 'system',
    content: [
      'Return only valid JSON.',
      'Do not include markdown fences or explanatory text.',
      'Allowed keys: shortAnswer (string, required), steps (string[]), commands (string[]), citedEvidenceIndexes (integer[]), confidence (number 0-1), uncertainty (string).',
      'Only cite evidence indexes that appear in the provided evidence list.'
    ].join(' ')
  };
}

function extractMessageContent(payload: OpenAIChatCompletionResponse): string {
  const message = payload.choices?.[0]?.message;

  if (!message) {
    throw new Error('OpenAI answer generation returned no choices.');
  }

  if (message.refusal) {
    throw new Error(`OpenAI answer generation refused the request: ${message.refusal}`);
  }

  if (typeof message.content === 'string') {
    return message.content;
  }

  if (Array.isArray(message.content)) {
    const text = message.content
      .map((part) => (part && part.type === 'text' && typeof part.text === 'string' ? part.text : ''))
      .join('')
      .trim();

    if (text) {
      return text;
    }
  }

  throw new Error('OpenAI answer generation returned an empty response body.');
}

function toStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean);

  return items.length > 0 ? items : undefined;
}

function toPositiveIntegerList(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .map((item) => (Number.isInteger(item) && (item as number) > 0 ? (item as number) : undefined))
    .filter((item): item is number => item !== undefined);

  return items.length > 0 ? items : undefined;
}

function parseDraft(content: string): AnswerGenerationDraft {
  let value: unknown;

  try {
    value = JSON.parse(content) as unknown;
  } catch (error) {
    throw new Error(
      `OpenAI answer generation returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!value || typeof value !== 'object') {
    throw new Error('OpenAI answer generation returned a non-object JSON payload.');
  }

  const draft = value as Record<string, unknown>;

  if (typeof draft.shortAnswer !== 'string' || draft.shortAnswer.trim().length === 0) {
    throw new Error('OpenAI answer generation payload must include a non-empty shortAnswer string.');
  }

  return {
    shortAnswer: draft.shortAnswer.trim(),
    steps: toStringList(draft.steps),
    commands: toStringList(draft.commands),
    citedEvidenceIndexes: toPositiveIntegerList(draft.citedEvidenceIndexes),
    confidence:
      typeof draft.confidence === 'number' && draft.confidence >= 0 && draft.confidence <= 1
        ? draft.confidence
        : undefined,
    uncertainty: typeof draft.uncertainty === 'string' && draft.uncertainty.trim().length > 0 ? draft.uncertainty.trim() : undefined
  };
}

export class OpenAIAnswerGenerationAdapter implements AnswerGenerationAdapter {
  readonly modelName: string;

  private readonly apiKey?: string;
  private readonly endpoint: string;
  private readonly temperature: number;
  private readonly maxCompletionTokens: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OpenAIAnswerGenerationAdapterConfig = {}) {
    this.apiKey = config.apiKey ?? process.env.OPENAI_API_KEY;
    this.modelName = config.model ?? process.env.SUPPORT_BOT_OPENAI_MODEL ?? DEFAULT_MODEL;
    this.endpoint = config.endpoint ?? OPENAI_CHAT_COMPLETIONS_URL;
    this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
    this.maxCompletionTokens = config.maxCompletionTokens ?? DEFAULT_MAX_COMPLETION_TOKENS;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async generate(request: AnswerGenerationRequest): Promise<AnswerGenerationDraft> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required for support-bot answer generation.');
    }

    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.modelName,
        temperature: this.temperature,
        max_completion_tokens: this.maxCompletionTokens,
        response_format: { type: 'json_object' },
        messages: [buildJsonInstructionMessage(), ...request.messages]
      })
    });

    if (!response.ok) {
      const detail = (await response.text()).trim();
      throw new Error(
        `OpenAI answer generation request failed with status ${response.status}${detail ? `: ${detail}` : ''}`
      );
    }

    return parseDraft(extractMessageContent((await response.json()) as OpenAIChatCompletionResponse));
  }
}