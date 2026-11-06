import { vi } from 'vitest';

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function mockFetch(response: Response) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
}

export function mockFetchByUrl(
  respond: (url: URL, init: RequestInit) => Response | Promise<Response>,
) {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (input, init) => respond(new URL(String(input)), init ?? {}));
}

export function requestedUrls(fetchSpy: ReturnType<typeof mockFetch>): string[] {
  return fetchSpy.mock.calls.map(([input]) => String(input));
}

export function sentRequest(fetchSpy: ReturnType<typeof mockFetch>): {
  url: string;
  init: RequestInit;
} {
  const call = fetchSpy.mock.calls[0];
  if (call === undefined) {
    throw new Error('fetch was not called');
  }
  const [input, init] = call;
  return { url: String(input), init: init ?? {} };
}

export async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error: unknown) {
    return error;
  }
  throw new Error('Expected the promise to reject');
}
