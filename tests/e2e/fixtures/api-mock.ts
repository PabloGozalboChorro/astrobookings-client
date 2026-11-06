import type { Page, Request } from '@playwright/test';
import { launchDtos } from './data.ts';

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

const defaultHandler: ActivitiesHandler = () => ({ body: launchDtos });

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
