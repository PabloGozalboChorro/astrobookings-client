import { ApiError, ContractError, NetworkError } from '../api/errors';
import { ConfigError } from '../config';

const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';
const SERVER_TEXT = 'Se ha producido un error en el servidor. Inténtalo de nuevo más tarde.';
const CONTRACT_TEXT = 'El servidor ha devuelto una respuesta inesperada.';
const SESSION_TEXT = 'Tu sesión ha caducado o no es válida. Inicia sesión de nuevo.';
const PAYMENT_TEXT = 'El pago no se ha podido procesar. La reserva no se ha realizado.';

export const LAUNCH_NOT_FOUND_TEXT = 'Este lanzamiento no existe o ya no está disponible.';

const NO_SEATS_TEXT = 'No quedan plazas libres en este lanzamiento.';
const UNKNOWN_SEATS_TEXT = 'No hay plazas suficientes para tu solicitud.';

const EMAIL_ALREADY_REGISTERED_MESSAGE = 'Email is already registered';
const EMAIL_ALREADY_REGISTERED_TEXT = 'Ya existe una cuenta con este email.';

const KNOWN_API_MESSAGES: Readonly<Record<string, string>> = {
  'Validation failed': 'Revisa los datos marcados.',
  [EMAIL_ALREADY_REGISTERED_MESSAGE]: EMAIL_ALREADY_REGISTERED_TEXT,
  'Invalid email or password': 'Email o contraseña incorrectos.',
  'Authentication required. Please provide a valid token.': SESSION_TEXT,
  'Invalid or expired token. Please login again.': SESSION_TEXT,
  'Payment could not be processed': PAYMENT_TEXT,
  'Activity not found': LAUNCH_NOT_FOUND_TEXT,
  'Booking not found': 'No encontramos esta reserva.',
  'Failed to retrieve activities': SERVER_TEXT,
  'Failed to retrieve bookings': SERVER_TEXT,
};

const GENERIC_TEXT_BY_STATUS: Readonly<Record<number, string>> = {
  400: 'No se ha podido completar la operación',
  401: 'Tu sesión ha caducado o no es válida. Inicia sesión de nuevo',
  402: 'El pago no se ha podido procesar',
  404: 'No se ha encontrado lo que buscas',
};
const GENERIC_SERVER_TEXT = 'Se ha producido un error en el servidor';

const FIXED_TEXT_BY_STATUS: Readonly<Record<number, string>> = {
  400: 'No se ha podido completar la operación.',
  401: SESSION_TEXT,
  402: PAYMENT_TEXT,
  404: 'No se ha encontrado lo que buscas.',
};

const FIELD_ERROR_TEXTS: Readonly<Record<string, string>> = {
  username: 'Introduce un nombre de usuario válido.',
  email: 'Introduce un email válido.',
  password: 'La contraseña debe tener al menos 6 caracteres.',
  terms: 'Debes aceptar los términos y condiciones.',
  participants: 'Introduce un número entero de plazas mayor o igual que 1.',
  activityId: 'El lanzamiento indicado no es válido.',
};

const AVAILABLE_SEATS_PATTERN = /Available:\s*(\d+)/;

export function parseAvailableSeats(message: string): number | null {
  const match = AVAILABLE_SEATS_PATTERN.exec(message);
  if (match?.[1] === undefined) {
    return null;
  }
  return Number(match[1]);
}

function capacityMessage(availableSeats: number | null): string {
  if (availableSeats === null) {
    return UNKNOWN_SEATS_TEXT;
  }
  if (availableSeats === 0) {
    return NO_SEATS_TEXT;
  }
  if (availableSeats === 1) {
    return 'Solo queda 1 plaza libre.';
  }
  return `Solo quedan ${availableSeats} plazas libres.`;
}

function apiErrorMessage(error: ApiError): string {
  if (error.status >= 500) {
    return SERVER_TEXT;
  }
  if (error.kind === 'capacity') {
    return capacityMessage(error.availableSeats);
  }
  const knownText = KNOWN_API_MESSAGES[error.message];
  if (knownText !== undefined) {
    return knownText;
  }
  if (error.message === '') {
    return FIXED_TEXT_BY_STATUS[error.status] ?? SERVER_TEXT;
  }
  const genericText = GENERIC_TEXT_BY_STATUS[error.status] ?? GENERIC_SERVER_TEXT;
  return `${genericText} (${error.message})`;
}

export function toUserMessage(error: unknown): string {
  if (error instanceof NetworkError) {
    return NETWORK_TEXT;
  }
  if (error instanceof ContractError) {
    return CONTRACT_TEXT;
  }
  if (error instanceof ConfigError) {
    return error.message;
  }
  if (error instanceof ApiError) {
    return apiErrorMessage(error);
  }
  return SERVER_TEXT;
}

export function fieldErrorMessage(field: string, apiMessage: string): string {
  if (field === 'email' && apiMessage === EMAIL_ALREADY_REGISTERED_MESSAGE) {
    return EMAIL_ALREADY_REGISTERED_TEXT;
  }
  return FIELD_ERROR_TEXTS[field] ?? `Dato no válido (${apiMessage})`;
}

export function fieldErrorMessages(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) {
    return {};
  }
  const messages: Record<string, string> = {};
  for (const [field, apiMessage] of Object.entries(error.fieldErrors)) {
    messages[field] = fieldErrorMessage(field, apiMessage);
  }
  return messages;
}
