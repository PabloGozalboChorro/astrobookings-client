import { ApiError } from '../../api/errors';
import { INVALID_CREDENTIALS_TEXT, toUserMessage } from '../../domain/api-errors';

export type LoginFormValues = { email: string; password: string };

export type LoginFormErrors = Partial<Record<keyof LoginFormValues, string>>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  const trimmedEmail = email.trim();
  if (trimmedEmail === '') {
    return 'Introduce tu email.';
  }
  if (!EMAIL_PATTERN.test(trimmedEmail)) {
    return 'Introduce un email válido.';
  }
  return undefined;
}

export function validateLoginForm({ email, password }: LoginFormValues): LoginFormErrors {
  const errors: LoginFormErrors = {};
  const emailError = validateEmail(email);
  if (emailError !== undefined) {
    errors.email = emailError;
  }
  if (password.trim() === '') {
    errors.password = 'Introduce tu contraseña.';
  }
  return errors;
}

export function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status === 401) {
    return INVALID_CREDENTIALS_TEXT;
  }
  return toUserMessage(error);
}
