import {
  evidenceBundleSchema,
  evidencePackResultSchema,
  type EvidenceBundle,
  type EvidencePackResult,
  type SupportQueryRoutePlan
} from '../../bruno-support-retrieval/src/index/types';
import { planSupportQueryRoute } from '../../bruno-support-retrieval/src/index/query-routing';

import type { AnswerGenerationAdapter } from './answer-generation-adapter';
import { assembleSupportAnswer } from './answer-assembly';
import {
  answerGenerationDraftSchema,
  apiErrorResponseSchema,
  chatRequestSchema,
  chatResponseSchema,
  healthResponseSchema,
  sourcesRequestSchema,
  sourcesResponseSchema,
  toApiSupportAnswer,
  toSupportQueryRouteSummary,
  type ApiErrorResponse,
  type ChatResponse,
  type HealthResponse,
  type SourcesResponse
} from './api-contracts';
import { GROUNDED_PROMPT_POLICY_VERSION } from './grounded-prompt-policy';
import { buildAnswerGenerationRequest } from './prompt-builder';
import {
  determineSupportBotCitationSignal,
  emitSupportBotTelemetry,
  summarizeSupportBotAssessment,
  summarizeSupportBotError,
  summarizeSupportBotEvidence,
  summarizeSupportBotRoute,
  summarizeSupportBotText,
  type SupportBotTelemetryEndpoint,
  type SupportBotTelemetryFailureStage,
  type SupportBotTelemetryRouteSummary,
  type SupportBotTelemetrySink,
  type SupportBotTelemetryTextSummary
} from './telemetry';
import { ApiValidationError, parseWithSchema, validateWithSchema } from './api-validation';

export interface SupportBotApiRetrieveInput {
  query: string;
  route: SupportQueryRoutePlan;
}

export interface SupportBotApiRetrievalResult {
  evidence: EvidencePackResult;
  sources: EvidenceBundle[];
}

export interface SupportBotApiRetriever {
  retrieve(input: SupportBotApiRetrieveInput): Promise<SupportBotApiRetrievalResult>;
}

export interface SupportBotApiDependencies {
  retriever: SupportBotApiRetriever;
  answerGenerator: AnswerGenerationAdapter;
  telemetry?: SupportBotTelemetrySink;
  now?: () => Date;
  createAnswerId?: (input: {
    query: string;
    mode: 'grounded' | 'fallback';
    route: SupportQueryRoutePlan;
    evidence: EvidencePackResult;
    generatedAt: Date;
  }) => string;
  serviceName?: string;
  modelVersion?: string | (() => string | undefined);
}

export interface SupportBotApiHttpRequest {
  method: string;
  path: string;
  query?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

export interface SupportBotApiHttpResponse<TBody = HealthResponse | SourcesResponse | ChatResponse | ApiErrorResponse> {
  statusCode: number;
  headers: Record<string, string>;
  body: TBody;
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8'
};

interface RequestTelemetryContext {
  requestId: string;
  endpoint: SupportBotTelemetryEndpoint;
  method: string;
  startedAtMs: number;
  query?: SupportBotTelemetryTextSummary;
  route?: SupportBotTelemetryRouteSummary;
}

interface StageTaggedError extends Error {
  supportBotTelemetryStage?: SupportBotTelemetryFailureStage;
}

let telemetryRequestSequence = 0;

function getNow(dependencies: SupportBotApiDependencies): Date {
  return dependencies.now ? dependencies.now() : new Date();
}

function getModelVersion(dependencies: SupportBotApiDependencies): string | undefined {
  return typeof dependencies.modelVersion === 'function' ? dependencies.modelVersion() : dependencies.modelVersion;
}

function getServiceName(dependencies: SupportBotApiDependencies): string {
  return dependencies.serviceName ?? 'support-bot-api';
}

function getAnswerId(
  dependencies: SupportBotApiDependencies,
  input: Parameters<NonNullable<SupportBotApiDependencies['createAnswerId']>>[0]
): string {
  return dependencies.createAnswerId ? dependencies.createAnswerId(input) : `support-answer-${input.generatedAt.toISOString()}`;
}

function createJsonResponse<TBody>(statusCode: number, body: TBody): SupportBotApiHttpResponse<TBody> {
  return {
    statusCode,
    headers: JSON_HEADERS,
    body
  };
}

function toTelemetryEndpoint(path: string): SupportBotTelemetryEndpoint | undefined {
  if (path === '/chat') {
    return 'chat';
  }

  if (path === '/sources') {
    return 'sources';
  }

  return undefined;
}

function createTelemetryContext(
  request: Pick<SupportBotApiHttpRequest, 'path' | 'method'>
): RequestTelemetryContext | undefined {
  const endpoint = toTelemetryEndpoint(request.path);

  if (!endpoint) {
    return undefined;
  }

  telemetryRequestSequence += 1;

  return {
    requestId: `support-bot-request-${telemetryRequestSequence}`,
    endpoint,
    method: request.method,
    startedAtMs: Date.now()
  };
}

function createTelemetryEventBase(
  dependencies: SupportBotApiDependencies,
  context: RequestTelemetryContext,
  type:
    | 'support_bot.request.started'
    | 'support_bot.retrieval.completed'
    | 'support_bot.generation.completed'
    | 'support_bot.request.completed'
    | 'support_bot.request.failed'
) {
  return {
    type,
    schemaVersion: 1 as const,
    timestamp: getNow(dependencies).toISOString(),
    service: getServiceName(dependencies),
    requestId: context.requestId,
    endpoint: context.endpoint,
    method: context.method
  };
}

function tagErrorStage(error: unknown, stage: SupportBotTelemetryFailureStage): Error {
  if (error instanceof Error) {
    (error as StageTaggedError).supportBotTelemetryStage = stage;
    return error;
  }

  const wrappedError = new Error('Unexpected internal error.');
  (wrappedError as StageTaggedError).supportBotTelemetryStage = stage;
  return wrappedError;
}

function getErrorStage(error: unknown): SupportBotTelemetryFailureStage {
  if (error instanceof Error && (error as StageTaggedError).supportBotTelemetryStage) {
    return (error as StageTaggedError).supportBotTelemetryStage ?? 'unknown';
  }

  return error instanceof ApiValidationError ? 'request_validation' : 'unknown';
}

async function emitRequestStartedTelemetry(
  dependencies: SupportBotApiDependencies,
  context: RequestTelemetryContext
): Promise<void> {
  await emitSupportBotTelemetry(
    dependencies.telemetry,
    createTelemetryEventBase(dependencies, context, 'support_bot.request.started')
  );
}

async function emitRequestCompletedTelemetry(
  dependencies: SupportBotApiDependencies,
  context: RequestTelemetryContext,
  response: SupportBotApiHttpResponse<SourcesResponse | ChatResponse>
): Promise<void> {
  if (response.statusCode >= 400) {
    return;
  }

  const chatBody = context.endpoint === 'chat' ? (response.body as ChatResponse) : undefined;
  const availableEvidenceCount =
    chatBody?.result === 'answer' && chatBody.evidence.status === 'ready' ? chatBody.evidence.evidence.length : 0;
  const outcome = context.endpoint === 'sources' ? 'sources' : chatBody?.result ?? 'fallback';
  const fallbackReason = chatBody?.result === 'fallback' ? chatBody.reason : undefined;
  const citationSignal =
    chatBody?.result === 'answer'
      ? chatBody.answer.citations.length === 0
        ? 'citation_miss'
        : availableEvidenceCount > 1 && chatBody.answer.citations.length < Math.min(2, availableEvidenceCount)
          ? 'low_citation'
          : 'sufficient'
      : 'not_applicable';

  await emitSupportBotTelemetry(dependencies.telemetry, {
    ...createTelemetryEventBase(dependencies, context, 'support_bot.request.completed'),
    query: context.query,
    route: context.route,
    completion: {
      durationMs: Date.now() - context.startedAtMs,
      statusCode: response.statusCode,
      outcome,
      unanswered: outcome === 'fallback',
      fallbackReason,
      citationSignal
    }
  });
}

async function emitRequestFailedTelemetry(
  dependencies: SupportBotApiDependencies,
  context: RequestTelemetryContext,
  error: unknown,
  statusCode: number
): Promise<void> {
  await emitSupportBotTelemetry(dependencies.telemetry, {
    ...createTelemetryEventBase(dependencies, context, 'support_bot.request.failed'),
    query: context.query,
    route: context.route,
    failure: {
      durationMs: Date.now() - context.startedAtMs,
      statusCode,
      stage: getErrorStage(error),
      error: summarizeSupportBotError(error)
    }
  });
}

function createErrorResponse(
  statusCode: number,
  code: ApiErrorResponse['error']['code'],
  message: string,
  details?: ApiErrorResponse['error']['details']
): SupportBotApiHttpResponse<ApiErrorResponse> {
  return createJsonResponse(
    statusCode,
    validateWithSchema(
      apiErrorResponseSchema,
      {
        ok: false,
        error: {
          code,
          message,
          details
        }
      },
      'API error response validation failed'
    )
  );
}

function getQueryValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function validateRetrievalResult(result: SupportBotApiRetrievalResult): SupportBotApiRetrievalResult {
  return {
    evidence: validateWithSchema(evidencePackResultSchema, result.evidence, 'Retrieved evidence validation failed'),
    sources: validateWithSchema(evidenceBundleSchema.array(), result.sources, 'Retrieved sources validation failed')
  };
}

function isFallbackReason(value: string): value is 'weak_evidence' | 'insufficient_evidence' | 'security_sensitive' {
  return value === 'weak_evidence' || value === 'insufficient_evidence' || value === 'security_sensitive';
}

export function handleHealthRequest(dependencies: SupportBotApiDependencies): HealthResponse {
  const response = {
    ok: true as const,
    service: dependencies.serviceName ?? 'support-bot-api',
    status: 'ok' as const,
    policyVersion: GROUNDED_PROMPT_POLICY_VERSION,
    timestamp: getNow(dependencies).toISOString()
  };

  return validateWithSchema(healthResponseSchema, response, 'Health response validation failed');
}

async function handleSourcesRequestInternal(
  payload: unknown,
  dependencies: SupportBotApiDependencies,
  telemetryContext?: RequestTelemetryContext
): Promise<SourcesResponse> {
  let request;

  try {
    request = parseWithSchema(sourcesRequestSchema, payload, 'Sources request validation failed.');
  } catch (error) {
    throw tagErrorStage(error, 'request_validation');
  }

  const route = planSupportQueryRoute(request.query);

  if (telemetryContext) {
    telemetryContext.query = summarizeSupportBotText(request.query);
    telemetryContext.route = summarizeSupportBotRoute(route);
  }

  const retrievalStartedAtMs = Date.now();
  let retrieval;

  try {
    retrieval = validateRetrievalResult(await dependencies.retriever.retrieve({ query: request.query, route }));
  } catch (error) {
    throw tagErrorStage(error, 'retrieval');
  }

  if (telemetryContext?.query && telemetryContext.route) {
    await emitSupportBotTelemetry(dependencies.telemetry, {
      ...createTelemetryEventBase(dependencies, telemetryContext, 'support_bot.retrieval.completed'),
      query: telemetryContext.query,
      route: telemetryContext.route,
      retrieval: {
        durationMs: Date.now() - retrievalStartedAtMs,
        ...summarizeSupportBotEvidence(retrieval.evidence, retrieval.sources)
      }
    });
  }

  const response = {
    ok: true as const,
    query: request.query,
    route: toSupportQueryRouteSummary(route),
    evidence: retrieval.evidence,
    sources: retrieval.sources
  };

  try {
    return validateWithSchema(sourcesResponseSchema, response, 'Sources response validation failed');
  } catch (error) {
    throw tagErrorStage(error, 'response_validation');
  }
}

export async function handleSourcesRequest(
  payload: unknown,
  dependencies: SupportBotApiDependencies
): Promise<SourcesResponse> {
  return handleSourcesRequestInternal(payload, dependencies);
}

async function handleChatRequestInternal(
  payload: unknown,
  dependencies: SupportBotApiDependencies,
  telemetryContext?: RequestTelemetryContext
): Promise<ChatResponse> {
  let request;

  try {
    request = parseWithSchema(chatRequestSchema, payload, 'Chat request validation failed.');
  } catch (error) {
    throw tagErrorStage(error, 'request_validation');
  }

  const route = planSupportQueryRoute(request.query);

  if (telemetryContext) {
    telemetryContext.query = summarizeSupportBotText(request.query);
    telemetryContext.route = summarizeSupportBotRoute(route);
  }

  const retrievalStartedAtMs = Date.now();
  let retrieval;

  try {
    retrieval = validateRetrievalResult(await dependencies.retriever.retrieve({ query: request.query, route }));
  } catch (error) {
    throw tagErrorStage(error, 'retrieval');
  }

  if (telemetryContext?.query && telemetryContext.route) {
    await emitSupportBotTelemetry(dependencies.telemetry, {
      ...createTelemetryEventBase(dependencies, telemetryContext, 'support_bot.retrieval.completed'),
      query: telemetryContext.query,
      route: telemetryContext.route,
      retrieval: {
        durationMs: Date.now() - retrievalStartedAtMs,
        ...summarizeSupportBotEvidence(retrieval.evidence, retrieval.sources)
      }
    });
  }

  const generationRequest = buildAnswerGenerationRequest({
    query: request.query,
    routeIntent: route.intent,
    evidence: retrieval.evidence,
    fallbackMessage: request.fallbackMessage
  });
  const generatedAt = getNow(dependencies);
  const answerId = getAnswerId(dependencies, {
    query: request.query,
    mode: generationRequest.mode,
    route,
    evidence: retrieval.evidence,
    generatedAt
  });

  if (generationRequest.mode === 'fallback') {
    const fallbackReason = generationRequest.safety.fallbackReason;

    if (!fallbackReason || !isFallbackReason(fallbackReason)) {
      throw new Error(`Unexpected fallback reason: ${fallbackReason}`);
    }

    const answer = assembleSupportAnswer({
      request: generationRequest,
      draft: { shortAnswer: '' },
      answerId,
      generatedAt,
      modelVersion: getModelVersion(dependencies)
    });
    const response = {
      ok: true as const,
      result: 'fallback' as const,
      query: request.query,
      route: toSupportQueryRouteSummary(route),
      evidence: retrieval.evidence,
      answer: toApiSupportAnswer(answer),
      skippedGeneration: true as const,
      reason: fallbackReason
    };

    try {
      return validateWithSchema(chatResponseSchema, response, 'Chat response validation failed');
    } catch (error) {
      throw tagErrorStage(error, 'response_validation');
    }
  }

  const generationStartedAtMs = Date.now();
  let draft;

  try {
    draft = validateWithSchema(
      answerGenerationDraftSchema,
      await dependencies.answerGenerator.generate(generationRequest),
      'Answer generation draft validation failed'
    );
  } catch (error) {
    throw tagErrorStage(error, 'generation');
  }

  const answer = assembleSupportAnswer({
    request: generationRequest,
    draft,
    answerId,
    generatedAt,
    modelVersion: getModelVersion(dependencies)
  });
  const citationSignal = determineSupportBotCitationSignal(generationRequest, answer);

  if (telemetryContext?.query && telemetryContext.route) {
    await emitSupportBotTelemetry(dependencies.telemetry, {
      ...createTelemetryEventBase(dependencies, telemetryContext, 'support_bot.generation.completed'),
      query: telemetryContext.query,
      route: telemetryContext.route,
      generation: {
        durationMs: Date.now() - generationStartedAtMs,
        mode: generationRequest.mode,
        assessment: summarizeSupportBotAssessment(generationRequest.assessment),
        citationCount: answer.citations.length,
        citationSignal,
        confidence: answer.confidence,
        confidenceLabel: answer.confidenceLabel
      }
    });
  }

  const response = {
    ok: true as const,
    result: 'answer' as const,
    query: request.query,
    route: toSupportQueryRouteSummary(route),
    evidence: retrieval.evidence,
    answer: toApiSupportAnswer(answer)
  };

  try {
    return validateWithSchema(chatResponseSchema, response, 'Chat response validation failed');
  } catch (error) {
    throw tagErrorStage(error, 'response_validation');
  }
}

export async function handleChatRequest(payload: unknown, dependencies: SupportBotApiDependencies): Promise<ChatResponse> {
  return handleChatRequestInternal(payload, dependencies);
}

export async function handleSupportBotApiRequest(
  request: SupportBotApiHttpRequest,
  dependencies: SupportBotApiDependencies
): Promise<SupportBotApiHttpResponse> {
  let telemetryContext: RequestTelemetryContext | undefined;

  try {
    if (request.path === '/health') {
      if (request.method !== 'GET') {
        return createErrorResponse(405, 'method_not_allowed', 'Method not allowed for /health.');
      }

      return createJsonResponse(200, handleHealthRequest(dependencies));
    }

    if (request.path === '/sources') {
      if (request.method === 'GET') {
        telemetryContext = createTelemetryContext(request);

        if (telemetryContext) {
          await emitRequestStartedTelemetry(dependencies, telemetryContext);
        }

        const response = createJsonResponse(
          200,
          await handleSourcesRequestInternal({ query: getQueryValue(request.query?.query) }, dependencies, telemetryContext)
        );

        if (telemetryContext) {
          await emitRequestCompletedTelemetry(dependencies, telemetryContext, response);
        }

        return response;
      }

      if (request.method === 'POST') {
        telemetryContext = createTelemetryContext(request);

        if (telemetryContext) {
          await emitRequestStartedTelemetry(dependencies, telemetryContext);
        }

        const response = createJsonResponse(200, await handleSourcesRequestInternal(request.body, dependencies, telemetryContext));

        if (telemetryContext) {
          await emitRequestCompletedTelemetry(dependencies, telemetryContext, response);
        }

        return response;
      }

      return createErrorResponse(405, 'method_not_allowed', 'Method not allowed for /sources.');
    }

    if (request.path === '/chat') {
      if (request.method !== 'POST') {
        return createErrorResponse(405, 'method_not_allowed', 'Method not allowed for /chat.');
      }

      telemetryContext = createTelemetryContext(request);

      if (telemetryContext) {
        await emitRequestStartedTelemetry(dependencies, telemetryContext);
      }

      const response = createJsonResponse(200, await handleChatRequestInternal(request.body, dependencies, telemetryContext));

      if (telemetryContext) {
        await emitRequestCompletedTelemetry(dependencies, telemetryContext, response);
      }

      return response;
    }

    return createErrorResponse(404, 'not_found', `No route found for ${request.path}.`);
  } catch (error) {
    if (telemetryContext) {
      await emitRequestFailedTelemetry(
        dependencies,
        telemetryContext,
        error,
        error instanceof ApiValidationError ? 400 : 500
      );
    }

    if (error instanceof ApiValidationError) {
      return createErrorResponse(400, 'validation_error', error.message, error.issues);
    }

    const message = error instanceof Error ? error.message : 'Unexpected internal error.';
    return createErrorResponse(500, 'internal_error', message);
  }
}