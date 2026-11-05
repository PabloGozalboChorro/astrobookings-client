const MISSING_API_URL_MESSAGE = 'Error de configuración: falta la variable VITE_API_URL.';

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export type ConfigResult = { ok: true; apiUrl: string } | { ok: false; message: string };

export function parseApiUrl(value: string | undefined): string {
  const trimmedValue = value?.trim() ?? '';
  if (trimmedValue === '') {
    throw new ConfigError(MISSING_API_URL_MESSAGE);
  }
  return trimmedValue.replace(/\/+$/, '');
}

export function loadConfig(): ConfigResult {
  try {
    return { ok: true, apiUrl: parseApiUrl(import.meta.env.VITE_API_URL) };
  } catch (error: unknown) {
    if (error instanceof ConfigError) {
      return { ok: false, message: error.message };
    }
    throw error;
  }
}
