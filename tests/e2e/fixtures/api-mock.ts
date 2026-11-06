import type { Page, Request } from '@playwright/test';
import { queryLaunchDtos } from './activities-query.ts';
import { errorResponses, launchDtos } from './data.ts';

export const API_URL = 'http://localhost:3999';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export type MockApiResponse = { status?: number; body: unknown } | 'abort';

export type ActivitiesHandler = (
  request: Request,
  attempt: number,
) => MockApiResponse | Promise<MockApiResponse>;

export type ActivitiesMock = {
  requestedUrls: URL[];
};

const ACTIVITY_PATH_PATTERN = /^\/activities\/([^/]+)$/;

export function activityIdOf(request: Request): string | null {
  const match = ACTIVITY_PATH_PATTERN.exec(new URL(request.url()).pathname);
  return match?.[1] === undefined ? null : decodeURIComponent(match[1]);
}

function activityResponse(id: string): MockApiResponse {
  const launch = launchDtos.find((dto) => dto.id === id);
  if (launch === undefined) {
    return { status: 404, body: errorResponses.activityNotFound };
  }
  return { body: launch };
}

// Returns the seed as is for the list, ignoring q, _sort and _order.
const defaultHandler: ActivitiesHandler = (request) => {
  const id = activityIdOf(request);
  return id === null ? { body: launchDtos } : activityResponse(id);
};

// Applies q, _sort and _order to the seed like the real API (see activities-query.ts).
export const apiLikeHandler: ActivitiesHandler = (request) => {
  const id = activityIdOf(request);
  return id === null
    ? { body: queryLaunchDtos(launchDtos, new URL(request.url())) }
    : activityResponse(id);
};

export type JsonPostHandler = (
  request: Request,
  attempt: number,
) => MockApiResponse | Promise<MockApiResponse>;

export type JsonPostMock = {
  requestBodies: unknown[];
};

export function mockLogin(page: Page, handler: JsonPostHandler): Promise<JsonPostMock> {
  return mockJsonPost(page, '/login', handler);
}

export function mockRegister(page: Page, handler: JsonPostHandler): Promise<JsonPostMock> {
  return mockJsonPost(page, '/users', handler);
}

// Answers the CORS preflight and records the JSON body of every POST to the path.
async function mockJsonPost(
  page: Page,
  path: string,
  handler: JsonPostHandler,
): Promise<JsonPostMock> {
  const mock: JsonPostMock = { requestBodies: [] };

  await page.route(`${API_URL}${path}`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    mock.requestBodies.push(request.postDataJSON());
    const response = await handler(request, mock.requestBodies.length);
    if (response === 'abort') {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: response.status ?? 200,
      headers: CORS_HEADERS,
      json: response.body,
    });
  });

  return mock;
}

export async function mockActivities(
  page: Page,
  handler: ActivitiesHandler = defaultHandler,
): Promise<ActivitiesMock> {
  const mock: ActivitiesMock = { requestedUrls: [] };

  await page.route(`${API_URL}/activities**`, async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    mock.requestedUrls.push(new URL(request.url()));
    const response = await handler(request, mock.requestedUrls.length);
    if (response === 'abort') {
      await route.abort('failed');
      return;
    }
    await route.fulfill({
      status: response.status ?? 200,
      headers: CORS_HEADERS,
      json: response.body,
    });
  });

  return mock;
}
