import { ApiError } from '../../api/errors';
import {
  fieldErrorMessage,
  INVALID_PARTICIPANTS_TEXT,
  toUserMessage,
} from '../../domain/api-errors';

export type ParticipantsValidation =
  | { ok: true; participants: number }
  | { ok: false; error: string };

export type BookingErrorFeedback = {
  fieldError?: string;
  alert?: string;
  availableSeats?: number;
};

const PARTICIPANTS_FIELD = 'participants';

export function parseParticipants(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }
  const participants = Number(trimmed);
  if (!Number.isSafeInteger(participants) || participants < 1) {
    return null;
  }
  return participants;
}

function maxSeatsText(maxSeats: number): string {
  return maxSeats === 1
    ? 'Puedes reservar como máximo 1 plaza.'
    : `Puedes reservar como máximo ${maxSeats} plazas.`;
}

export function validateParticipants(raw: string, maxSeats: number): ParticipantsValidation {
  const participants = parseParticipants(raw);
  if (participants === null) {
    return { ok: false, error: INVALID_PARTICIPANTS_TEXT };
  }
  if (participants > maxSeats) {
    return { ok: false, error: maxSeatsText(maxSeats) };
  }
  return { ok: true, participants };
}

function validationFeedback(error: ApiError): BookingErrorFeedback {
  const feedback: BookingErrorFeedback = {};
  const otherFieldTexts: string[] = [];
  for (const [field, apiMessage] of Object.entries(error.fieldErrors)) {
    const text = fieldErrorMessage(field, apiMessage);
    if (field === PARTICIPANTS_FIELD) {
      feedback.fieldError = text;
    } else {
      otherFieldTexts.push(text);
    }
  }
  if (otherFieldTexts.length > 0) {
    feedback.alert = otherFieldTexts.join(' ');
  }
  return feedback;
}

export function bookingErrorFeedback(error: unknown): BookingErrorFeedback {
  if (!(error instanceof ApiError)) {
    return { alert: toUserMessage(error) };
  }
  if (error.kind === 'unauthorized') {
    return {};
  }
  if (error.kind === 'validation') {
    return validationFeedback(error);
  }
  if (error.kind === 'capacity' && error.availableSeats !== null) {
    return { alert: toUserMessage(error), availableSeats: error.availableSeats };
  }
  return { alert: toUserMessage(error) };
}
