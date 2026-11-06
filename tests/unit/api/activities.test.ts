import { afterEach, describe, expect, it, vi } from 'vitest';
import { getActivities, getActivity } from '../../../src/api/activities';
import { ApiError, ContractError, isNotFoundError } from '../../../src/api/errors';
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

    await getActivities({}, controller.signal);

    expect(sentRequest(fetchSpy).init.signal).toBe(controller.signal);
  });

  it('R2: getActivities sends q, _sort and _order in this order', async () => {
    const fetchSpy = mockFetch(jsonResponse(200, []));

    await getActivities({ order: 'asc', sort: 'date', q: 'falcon' });

    const { url, init } = sentRequest(fetchSpy);
    expect(url).toBe('http://localhost:3999/activities?q=falcon&_sort=date&_order=asc');
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
  });

  it('R3: getActivities omits empty q', async () => {
    const fetchSpy = mockFetch(jsonResponse(200, []));

    await getActivities({ q: '', sort: 'price', order: 'desc' });

    expect(sentRequest(fetchSpy).url).toBe(
      'http://localhost:3999/activities?_sort=price&_order=desc',
    );
  });

  it.each([
    ['Órbita Marciana', 'q=%C3%93rbita+Marciana'],
    ['a&b#c', 'q=a%26b%23c'],
  ])('R2: getActivities encodes the search text %s as %s', async (text, encoded) => {
    const fetchSpy = mockFetch(jsonResponse(200, []));

    await getActivities({ q: text });

    expect(sentRequest(fetchSpy).url).toBe(`http://localhost:3999/activities?${encoded}`);
  });

  it('R9: getActivities throws ContractError for [{ "id": 1 }]', async () => {
    mockFetch(jsonResponse(200, [{ id: 1 }]));

    const error = await captureError(getActivities());

    expect(error).toBeInstanceOf(ContractError);
  });
});

describe('getActivity', () => {
  it('R1: getActivity requests GET /activities/:id without Authorization and parses the launch', async () => {
    const fetchSpy = mockFetch(jsonResponse(200, activityDto()));

    const activity = await getActivity('activity-1');

    const { url, init } = sentRequest(fetchSpy);
    expect(url).toBe('http://localhost:3999/activities/activity-1');
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).has('Authorization')).toBe(false);
    expect(activity.id).toBe('activity-1');
    expect(activity.name).toBe('Falcon 9 · Misión Luna');
  });

  it('R1: getActivity encodes the id in the path', async () => {
    const fetchSpy = mockFetch(jsonResponse(200, activityDto()));

    await getActivity('xyz/1');

    expect(sentRequest(fetchSpy).url).toBe('http://localhost:3999/activities/xyz%2F1');
  });

  it('R1: getActivity forwards the abort signal', async () => {
    const fetchSpy = mockFetch(jsonResponse(200, activityDto()));
    const controller = new AbortController();

    await getActivity('activity-1', controller.signal);

    expect(sentRequest(fetchSpy).init.signal).toBe(controller.signal);
  });

  it('R3: getActivity throws a not-found ApiError on 404 Activity not found', async () => {
    mockFetch(jsonResponse(404, { message: 'Activity not found', errors: [] }));

    const error = await captureError(getActivity('activity-99'));

    expect(error).toBeInstanceOf(ApiError);
    expect(isNotFoundError(error)).toBe(true);
  });

  it('R5: getActivity throws ContractError for { "id": 1 }', async () => {
    mockFetch(jsonResponse(200, { id: 1 }));

    const error = await captureError(getActivity('activity-1'));

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
