import type { ErrorResponseDto } from './schemas';

export type ApiErrorKind =
  | 'validation'
  | 'capacity'
  | 'unauthorized'
  | 'payment'
  | 'not-found'
  | 'server';

export type ApiErrorDetails = {
  status: number;
  kind: ApiErrorKind;
  message: string;
  fieldErrors: Record<string, string>;
  availableSeats: number | null;
};

const CAPACITY_MESSAGE_PREFIX = 'Capacity exceeded';

export class ApiError extends Error {
  readonly status: number;
  readonly kind: ApiErrorKind;
  readonly fieldErrors: Record<string, string>;
  readonly availableSeats: number | null;

  constructor(details: ApiErrorDetails) {
    super(details.message);
    this.name = 'ApiError';
    this.status = details.status;
    this.kind = details.kind;
    this.fieldErrors = details.fieldErrors;
    this.availableSeats = details.availableSeats;
  }
}

export class NetworkError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Network request failed', options);
    this.name = 'NetworkError';
  }
}

export class ContractError extends Error {
  constructor(options?: { cause?: unknown }) {
    super('Unexpected API response', options);
    this.name = 'ContractError';
  }
}

export function classifyApiError(status: number, body: ErrorResponseDto | null): ApiErrorKind {
  if (status === 400 && body !== null && body.errors.length > 0) {
    return 'validation';
  }
  if (status === 400 && body !== null && body.message.startsWith(CAPACITY_MESSAGE_PREFIX)) {
    return 'capacity';
  }
  if (status === 401) {
    return 'unauthorized';
  }
  if (status === 402) {
    return 'payment';
  }
  if (status === 404) {
    return 'not-found';
  }
  return 'server';
}
