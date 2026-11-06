import { afterEach, describe, expect, it, vi } from 'vitest';
import { getActivities } from '../../../src/api/activities';
import { ContractError } from '../../../src/api/errors';
import { activityDtoSchema } from '../../../src/api/schemas';
import { activityDto, draftActivityDto } from '../support/activities';
import { captureError, jsonResponse, mockFetch, sentRequest } from '../support/http';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getActivities', () => {
  it('R1: getActivities requests GET /activities without query and parses the list', async () => {
    const fetchSpy = mockFetch(jsonResponse(200, [activityDto(), draftActivityDto]));

    const activities = await getActivities();

    const { url, init } = sentRequest(fetchSpy);
    expect(url).toBe('http://localhost:3999/activities');
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
    expect(activities.map((activity) => activity.id)).toEqual(['activity-1', 'activity-7']);
    expect(activities[1]?.status).toBe('draft');
  });

  it('R1: getActivities forwards the abort signal', async () => {
    const fetchSpy = mockFetch(jsonResponse(200, []));
    const controller = new AbortController();

    await getActivities(controller.signal);

    expect(sentRequest(fetchSpy).init.signal).toBe(controller.signal);
  });

  it('R9: getActivities throws ContractError for [{ "id": 1 }]', async () => {
    mockFetch(jsonResponse(200, [{ id: 1 }]));

    const error = await captureError(getActivities());

    expect(error).toBeInstanceOf(ContractError);
  });
});

describe('activityDtoSchema', () => {
  it('R1: activityDtoSchema accepts a date without time and rejects an invalid date', () => {
    expect(activityDtoSchema.safeParse(activityDto({ date: '2027-10-26' })).success).toBe(true);
    expect(activityDtoSchema.safeParse(activityDto({ date: 'mañana' })).success).toBe(false);
  });

  it('R1: activityDtoSchema ignores extra fields and accepts an optional updatedAt', () => {
    const parsed = activityDtoSchema.parse({
      ...activityDto({ updatedAt: '2026-11-02T10:00:00.000Z' }),
      extra: true,
    });

    expect(parsed.updatedAt).toBe('2026-11-02T10:00:00.000Z');
    expect('extra' in parsed).toBe(false);
  });
});
