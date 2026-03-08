import { createHash } from 'crypto';

import { type SourceDocument } from '../types/source-document';
import { TrustTier } from '../types/trust-tier';

const STACK_EXCHANGE_API_BASE = 'https://api.stackexchange.com/2.3';
const DEFAULT_TAG = 'bruno';
const DEFAULT_MIN_SCORE = 3;
const DEFAULT_MAX_AGE_DAYS = 3650;
const DEFAULT_PAGE_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 50;
const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503]);
const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface StackOverflowQuestion {
  question_id: number;
  title: string;
  tags: string[];
}

interface StackOverflowAnswer {
  answer_id: number;
  question_id: number;
  body: string;
  score: number;
  is_accepted: boolean;
  creation_date: number;
  last_activity_date: number;
}

interface StackExchangeResponse<T> {
  items: T[];
}

export interface StackOverflowIngesterConfig {
  tag?: string;
  minScore?: number;
  maxAgeDays?: number;
  apiKey?: string;
  pageSize?: number;
}

export class StackOverflowIngester {
  private readonly tag: string;
  private readonly minScore: number;
  private readonly maxAgeDays: number;
  private readonly apiKey?: string;
  private readonly pageSize: number;

  constructor(config: StackOverflowIngesterConfig = {}) {
    this.tag = config.tag ?? DEFAULT_TAG;
    this.minScore = config.minScore ?? DEFAULT_MIN_SCORE;
    this.maxAgeDays = config.maxAgeDays ?? DEFAULT_MAX_AGE_DAYS;
    this.apiKey = config.apiKey ?? process.env.STACKEXCHANGE_API_KEY;
    this.pageSize = config.pageSize ?? DEFAULT_PAGE_SIZE;
  }

  async ingest(): Promise<SourceDocument[]> {
    const questions = await this.fetchQuestions();

    if (questions.length === 0) {
      return [];
    }

    const questionMap = new Map<number, StackOverflowQuestion>();

    questions.forEach((question) => {
      questionMap.set(question.question_id, question);
    });

    const answers = await this.fetchAnswers(
      questions.map((question) => question.question_id)
    );
    const cutoff = Date.now() - this.maxAgeDays * DAY_IN_MS;
    const lastSeen = new Date();
    const documentsByAnswerId = new Map<number, SourceDocument>();

    answers.forEach((answer) => {
      if (answer.score < this.minScore || answer.creation_date * 1000 < cutoff) {
        return;
      }

      const question = questionMap.get(answer.question_id);

      if (!question) {
        return;
      }

      const document = this.toSourceDocument(answer, question, lastSeen);
      const existingDocument = documentsByAnswerId.get(answer.answer_id);

      if (!existingDocument || document.lastModified > existingDocument.lastModified) {
        documentsByAnswerId.set(answer.answer_id, document);
      }
    });

    return Array.from(documentsByAnswerId.values());
  }

  private async fetchQuestions(): Promise<StackOverflowQuestion[]> {
    const url = new URL(`${STACK_EXCHANGE_API_BASE}/questions`);

    url.searchParams.set('tagged', this.tag);
    url.searchParams.set('site', 'stackoverflow');
    url.searchParams.set('filter', 'withbody');
    url.searchParams.set('sort', 'votes');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('pagesize', String(this.pageSize));
    this.appendApiKey(url);

    const response = await this.fetchJson<StackExchangeResponse<StackOverflowQuestion>>(url.toString());

    return response.items ?? [];
  }

  private async fetchAnswers(questionIds: number[]): Promise<StackOverflowAnswer[]> {
    if (questionIds.length === 0) {
      return [];
    }

    const url = new URL(`${STACK_EXCHANGE_API_BASE}/questions/${questionIds.join(';')}/answers`);

    url.searchParams.set('site', 'stackoverflow');
    url.searchParams.set('filter', 'withbody');
    url.searchParams.set('sort', 'votes');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('pagesize', String(this.pageSize));
    this.appendApiKey(url);

    const response = await this.fetchJson<StackExchangeResponse<StackOverflowAnswer>>(url.toString());

    return response.items ?? [];
  }

  private appendApiKey(url: URL): void {
    if (this.apiKey) {
      url.searchParams.set('key', this.apiKey);
    }
  }

  private async fetchJson<T>(url: string): Promise<T> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      const response = await fetch(url);

      if (response.ok) {
        return (await response.json()) as T;
      }

      if (TRANSIENT_STATUS_CODES.has(response.status) && attempt < MAX_RETRIES) {
        await this.delay(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        continue;
      }

      throw new Error(`Stack Exchange API request failed with status ${response.status} for ${url}`);
    }

    throw new Error(`Stack Exchange API request failed after ${MAX_RETRIES} attempts for ${url}`);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private toSourceDocument(
    answer: StackOverflowAnswer,
    question: StackOverflowQuestion,
    lastSeen: Date
  ): SourceDocument {
    return {
      id: `so-answer-${answer.answer_id}`,
      sourceType: 'stackoverflow',
      url: `https://stackoverflow.com/a/${answer.answer_id}`,
      title: question.title,
      content: answer.body,
      contentHash: createHash('sha256').update(answer.body).digest('hex'),
      trustTier: TrustTier.External,
      lastModified: new Date(answer.last_activity_date * 1000),
      lastSeen,
      metadata: {
        score: answer.score,
        is_accepted: answer.is_accepted,
        creation_date: answer.creation_date,
        last_activity_date: answer.last_activity_date,
        question_id: answer.question_id,
        answer_id: answer.answer_id,
        question_tags: question.tags
      }
    };
  }
}