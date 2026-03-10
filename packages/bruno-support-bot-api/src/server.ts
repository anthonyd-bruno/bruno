import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import { URL } from 'url';

import { apiErrorResponseSchema } from './api-contracts';
import { ApiValidationError, createValidationError } from './api-validation';
import {
  handleSupportBotApiRequest,
  type SupportBotApiDependencies,
  type SupportBotApiHttpRequest,
  type SupportBotApiHttpResponse
} from './api-handlers';

function toQueryRecord(url: URL): Record<string, string | string[]> {
  const entries = new Map<string, string[]>();

  for (const [key, value] of url.searchParams.entries()) {
    const existing = entries.get(key) ?? [];
    existing.push(value);
    entries.set(key, existing);
  }

  return Object.fromEntries(
    Array.from(entries.entries()).map(([key, values]) => [key, values.length > 1 ? values : values[0] ?? ''])
  );
}

async function readRawBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
}

async function parseRequestBody(request: IncomingMessage): Promise<unknown> {
  if (request.method !== 'POST' && request.method !== 'PUT' && request.method !== 'PATCH') {
    return undefined;
  }

  const rawBody = await readRawBody(request);

  if (rawBody.trim().length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    throw createValidationError('body', 'Request body must be valid JSON.', 'invalid_json');
  }
}

async function toApiRequest(request: IncomingMessage): Promise<SupportBotApiHttpRequest> {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

  return {
    method: request.method ?? 'GET',
    path: url.pathname,
    query: toQueryRecord(url),
    body: await parseRequestBody(request)
  };
}

function createJsonErrorResponse(
  statusCode: number,
  code: 'validation_error' | 'internal_error',
  message: string,
  details?: Array<{ path: string; message: string; code: string }>
) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    },
    body: apiErrorResponseSchema.parse({
      ok: false,
      error: {
        code,
        message,
        details
      }
    })
  };
}

function writeResponse(response: ServerResponse, apiResponse: SupportBotApiHttpResponse): void {
  response.statusCode = apiResponse.statusCode;

  for (const [name, value] of Object.entries(apiResponse.headers)) {
    response.setHeader(name, value);
  }

  response.end(JSON.stringify(apiResponse.body));
}

export async function handleNodeHttpRequest(
  request: IncomingMessage,
  dependencies: SupportBotApiDependencies
): Promise<SupportBotApiHttpResponse> {
  try {
    return await handleSupportBotApiRequest(await toApiRequest(request), dependencies);
  } catch (error) {
    if (error instanceof ApiValidationError) {
      return createJsonErrorResponse(400, 'validation_error', error.message, error.issues);
    }

    const message = error instanceof Error ? error.message : 'Unexpected internal error.';
    return createJsonErrorResponse(500, 'internal_error', message);
  }
}

export function createSupportBotApiServer(dependencies: SupportBotApiDependencies): Server {
  return createServer(async (request, response) => {
    const apiResponse = await handleNodeHttpRequest(request, dependencies);
    writeResponse(response, apiResponse);
  });
}