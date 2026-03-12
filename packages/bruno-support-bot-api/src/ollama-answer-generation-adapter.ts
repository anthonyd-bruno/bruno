import type { AnswerGenerationAdapter, AnswerGenerationDraft, AnswerGenerationRequest } from './answer-generation-adapter';

import { buildJsonInstructionMessage, parseAnswerGenerationDraft } from './answer-generation-json';

const DEFAULT_ENDPOINT = 'http://127.0.0.1:11434/api/chat';
const DEFAULT_MODEL = 'llama3.2';
const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_TOKENS = 400;

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
}

export interface OllamaAnswerGenerationAdapterConfig {
  endpoint?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  fetchImpl?: typeof fetch;
}

export class OllamaAnswerGenerationAdapter implements AnswerGenerationAdapter {
  readonly modelName: string;

  private readonly endpoint: string;
  private readonly temperature: number;
  private readonly maxTokens: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OllamaAnswerGenerationAdapterConfig = {}) {
    this.endpoint = config.endpoint ?? DEFAULT_ENDPOINT;
    this.modelName = config.model ?? DEFAULT_MODEL;
    this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async generate(request: AnswerGenerationRequest): Promise<AnswerGenerationDraft> {
    const response = await this.fetchImpl(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.modelName,
        stream: false,
        format: 'json',
        options: {
          temperature: this.temperature,
          num_predict: this.maxTokens
        },
        messages: [buildJsonInstructionMessage(), ...request.messages]
      })
    });

    if (!response.ok) {
      const detail = (await response.text()).trim();
      throw new Error(`Ollama answer generation request failed with status ${response.status}${detail ? `: ${detail}` : ''}`);
    }

    const content = ((await response.json()) as OllamaChatResponse).message?.content;

    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('Ollama answer generation returned an empty response body.');
    }

    return parseAnswerGenerationDraft(content, 'Ollama');
  }
}