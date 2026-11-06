import { ApiError } from '../../api/errors';
import { fieldErrorMessage, toUserMessage } from '../../domain/api-errors';
import { validateEmail } from './login-form';

export type RegisterFormValues = {
  username: string;
  email: string;
  password: string;
  termsAccepted: boolean;
};

export type RegisterField = 'username' | 'email' | 'password' | 'terms';

export type RegisterFormErrors = Partial<Record<RegisterField, string>>;

export type RegisterErrorFeedback = { fieldErrors: RegisterFormErrors; alert: string };

const MIN_PASSWORD_LENGTH = 6;

const REGISTER_FIELDS: readonly RegisterField[] = ['username', 'email', 'password', 'terms'];

const REVIEW_FIELDS_TEXT = 'Revisa los datos marcados.';

function isRegisterField(field: string): field is RegisterField {
  return REGISTER_FIELDS.some((registerField) => registerField === field);
}

export function validateRegisterForm({
  username,
  email,
  password,
  termsAccepted,
}: RegisterFormValues): RegisterFormErrors {
  const errors: RegisterFormErrors = {};
  if (username.trim() === '') {
    errors.username = 'Introduce un nombre de usuario.';
  }
  const emailError = validateEmail(email);
  if (emailError !== undefined) {
    errors.email = emailError;
  }
  // Same rule as the API: the length is measured without trimming.
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.password = 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (!termsAccepted) {
    errors.terms = 'Debes aceptar los términos y condiciones.';
  }
  return errors;
}

export function registerErrorFeedback(error: unknown): RegisterErrorFeedback {
  if (!(error instanceof ApiError) || Object.keys(error.fieldErrors).length === 0) {
    return { fieldErrors: {}, alert: toUserMessage(error) };
  }
  const fieldErrors: RegisterFormErrors = {};
  const unknownFieldTexts: string[] = [];
  for (const [field, apiMessage] of Object.entries(error.fieldErrors)) {
    const text = fieldErrorMessage(field, apiMessage);
    if (isRegisterField(field)) {
      fieldErrors[field] = text;
    } else {
      unknownFieldTexts.push(text);
    }
  }
  const alertParts =
    Object.keys(fieldErrors).length > 0
      ? [REVIEW_FIELDS_TEXT, ...unknownFieldTexts]
      : unknownFieldTexts;
  return { fieldErrors, alert: alertParts.join(' ') };
}
