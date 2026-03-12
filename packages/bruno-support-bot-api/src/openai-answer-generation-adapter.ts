import type { AnswerGenerationAdapter, AnswerGenerationDraft, AnswerGenerationRequest, PromptMessage } from './answer-generation-adapter';

import { buildJsonInstructionMessage, parseAnswerGenerationDraft } from './answer-generation-json';

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

    return parseAnswerGenerationDraft(extractMessageContent((await response.json()) as OpenAIChatCompletionResponse), 'OpenAI');
  }
}