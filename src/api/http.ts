import type { z } from 'zod';
import { parseApiUrl } from '../config';
import { parseAvailableSeats } from '../domain/api-errors';
import { ApiError, classifyApiError, ContractError, NetworkError } from './errors';
import { errorResponseDtoSchema, type ErrorResponseDto } from './schemas';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type HttpOptions = {
  method?: HttpMethod;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
};

type AccessTokenGetter = () => string | null;

let getAccessToken: AccessTokenGetter = () => null;

export function setAccessTokenGetter(getter: AccessTokenGetter): void {
  getAccessToken = getter;
}

type SessionRejectedListener = () => void;

const sessionRejectedListeners = new Set<SessionRejectedListener>();

export function onSessionRejected(listener: SessionRejectedListener): () => void {
  sessionRejectedListeners.add(listener);
  return () => {
    sessionRejectedListeners.delete(listener);
  };
}

function notifySessionRejected(): void {
  for (const listener of [...sessionRejectedListeners]) {
    listener();
  }
}

function buildHeaders(token: string | null): Headers {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token !== null) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

function missingSessionError(): ApiError {
  return new ApiError({
    status: 401,
    kind: 'unauthorized',
    message: '',
    fieldErrors: {},
    availableSeats: null,
  });
}

function isAbortError(error: unknown, signal: AbortSignal | undefined): boolean {
  return (
    signal?.aborted === true || (error instanceof DOMException && error.name === 'AbortError')
  );
}

async function readJson(
  response: Response,
  signal: AbortSignal | undefined,
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    const value: unknown = await response.json();
    return { ok: true, value };
  } catch (error: unknown) {
    if (isAbortError(error, signal)) {
      throw error;
    }
    return { ok: false };
  }
}

function firstErrorPerField(errors: ErrorResponseDto['errors']): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const { field, message } of errors) {
    if (!(field in fieldErrors)) {
      fieldErrors[field] = message;
    }
  }
  return fieldErrors;
}

async function toApiError(response: Response, signal: AbortSignal | undefined): Promise<ApiError> {
  const json = await readJson(response, signal);
  const parsed = json.ok ? errorResponseDtoSchema.safeParse(json.value) : null;
  const body = parsed?.success === true ? parsed.data : null;
  const kind = classifyApiError(response.status, body);
  const message = body?.message ?? '';

  return new ApiError({
    status: response.status,
    kind,
    message,
    fieldErrors: body === null ? {} : firstErrorPerField(body.errors),
    availableSeats: kind === 'capacity' ? parseAvailableSeats(message) : null,
  });
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error: unknown) {
    if (isAbortError(error, init.signal ?? undefined)) {
      throw error;
    }
    throw new NetworkError({ cause: error });
  }
}

export async function http<T>(
  path: string,
  schema: z.ZodType<T>,
  options: HttpOptions = {},
): Promise<T> {
  const { method = 'GET', body, auth = false, signal } = options;
  const baseUrl = parseApiUrl(import.meta.env.VITE_API_URL);
  const token = auth ? getAccessToken() : null;
  if (auth && token === null) {
    notifySessionRejected();
    throw missingSessionError();
  }

  const response = await send(`${baseUrl}${path}`, {
    method,
    headers: buildHeaders(token),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const error = await toApiError(response, signal);
    if (auth && response.status === 401) {
      notifySessionRejected();
    }
    throw error;
  }

  const json = await readJson(response, signal);
  if (!json.ok) {
    throw new ContractError();
  }
  const parsed = schema.safeParse(json.value);
  if (!parsed.success) {
    throw new ContractError({ cause: parsed.error });
  }
  return parsed.data;
}
