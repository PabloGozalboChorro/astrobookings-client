import { describe, expect, it, vi } from 'vitest';
import { ConfigError, loadConfig, parseApiUrl } from '../../src/config';

describe('config', () => {
  it('R7: removes the trailing slash from the API URL', () => {
    expect(parseApiUrl('http://localhost:3000/')).toBe('http://localhost:3000');
  });

  it('R7: keeps an API URL without trailing slash unchanged', () => {
    expect(parseApiUrl('http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('R7: reads VITE_API_URL from the environment', () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000/');

    expect(loadConfig()).toEqual({ ok: true, apiUrl: 'http://localhost:3000' });
  });

  it('R8: fails when VITE_API_URL is missing or empty', () => {
    expect(() => parseApiUrl(undefined)).toThrow(ConfigError);
    expect(() => parseApiUrl('')).toThrow(ConfigError);
    expect(() => parseApiUrl('   ')).toThrow(ConfigError);

    vi.stubEnv('VITE_API_URL', '');

    expect(loadConfig()).toEqual({
      ok: false,
      message: 'Error de configuración: falta la variable VITE_API_URL.',
    });
  });

  it('R7: removes several trailing slashes and surrounding whitespace', () => {
    expect(parseApiUrl('  http://localhost:3000///  ')).toBe('http://localhost:3000');
  });

  it('R7: keeps a path prefix while removing the trailing slash', () => {
    expect(parseApiUrl('http://localhost:3000/api/')).toBe('http://localhost:3000/api');
  });
});
