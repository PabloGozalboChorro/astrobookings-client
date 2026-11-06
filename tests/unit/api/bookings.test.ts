import { afterEach, describe, expect, it, vi } from 'vitest';
import { getBooking, getMyBookings } from '../../../src/api/bookings';
import { ApiError, ContractError, isNotFoundError } from '../../../src/api/errors';
import { onSessionRejected, setAccessTokenGetter } from '../../../src/api/http';
import { bookingDtoSchema, bookingWithActivityDtoSchema } from '../../../src/api/schemas';
import { bookingDto, suborbitalBookingDto, type BookingDtoFixture } from '../support/bookings';
import { captureError, jsonResponse, mockFetch, sentRequest } from '../support/http';

const TOKEN = 'abc.def.ghi';
const INVALID_TOKEN_BODY = { message: 'Invalid or expired token. Please login again.', errors: [] };

function signIn() {
  setAccessTokenGetter(() => TOKEN);
}

afterEach(() => {
  setAccessTokenGetter(() => null);
  vi.restoreAllMocks();
});

describe('getMyBookings', () => {
  it('R3: requests GET /bookings with the token and without activityId', async () => {
    signIn();
    const fetchSpy = mockFetch(jsonResponse(200, [bookingDto(), suborbitalBookingDto()]));

    const bookings = await getMyBookings();

    const { url, init } = sentRequest(fetchSpy);
    expect(url).toBe('http://localhost:3999/bookings');
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(bookings.map((booking) => booking.id)).toEqual(['booking-1', 'booking-2']);
    expect(bookings[0]?.activity.name).toBe('Falcon 9 · Misión Luna');
  });

  it('R3: forwards the abort signal', async () => {
    signIn();
    const fetchSpy = mockFetch(jsonResponse(200, []));
    const controller = new AbortController();

    await getMyBookings(controller.signal);

    expect(sentRequest(fetchSpy).init.signal).toBe(controller.signal);
  });

  it('R7: rejects with a server ApiError on 500 Failed to retrieve bookings', async () => {
    signIn();
    mockFetch(jsonResponse(500, { message: 'Failed to retrieve bookings', errors: [] }));

    const error = await captureError(getMyBookings());

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 500, kind: 'server' });
  });

  it.each([
    ['without activity', { ...bookingDto(), activity: undefined }],
    ['with an unknown paymentStatus', bookingDto({ paymentStatus: 'cancelled' })],
    ['with an invalid createdAt', bookingDto({ createdAt: 'ayer' })],
    ['without paymentStatus', { ...bookingDto(), paymentStatus: undefined }],
  ])('R7: rejects with ContractError for a booking %s', async (_case, dto) => {
    signIn();
    mockFetch(jsonResponse(200, [dto]));

    const error = await captureError(getMyBookings());

    expect(error).toBeInstanceOf(ContractError);
  });

  it('R11: notifies the session rejection on 401', async () => {
    signIn();
    const listener = vi.fn();
    const unsubscribe = onSessionRejected(listener);
    mockFetch(jsonResponse(401, INVALID_TOKEN_BODY));

    const error = await captureError(getMyBookings());
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ status: 401, kind: 'unauthorized' });
  });

  it('R11: does not call fetch without a token', async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionRejected(listener);
    const fetchSpy = mockFetch(jsonResponse(200, []));

    const error = await captureError(getMyBookings());
    unsubscribe();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ status: 401, kind: 'unauthorized' });
  });
});

describe('getBooking', () => {
  it('R8: requests GET /bookings/<id> with the token', async () => {
    signIn();
    const fetchSpy = mockFetch(jsonResponse(200, bookingDto()));

    const booking = await getBooking('booking-1');

    const { url, init } = sentRequest(fetchSpy);
    expect(url).toBe('http://localhost:3999/bookings/booking-1');
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${TOKEN}`);
    expect(booking.id).toBe('booking-1');
    expect(booking.paymentStatus).toBe('paid');
  });

  it('R8: encodes the id in the path', async () => {
    signIn();
    const fetchSpy = mockFetch(jsonResponse(200, bookingDto()));

    await getBooking('xyz/1?a');

    expect(sentRequest(fetchSpy).url).toBe('http://localhost:3999/bookings/xyz%2F1%3Fa');
  });

  it('R8: forwards the abort signal', async () => {
    signIn();
    const fetchSpy = mockFetch(jsonResponse(200, bookingDto()));
    const controller = new AbortController();

    await getBooking('booking-1', controller.signal);

    expect(sentRequest(fetchSpy).init.signal).toBe(controller.signal);
  });

  it('R10: rejects with a not-found ApiError on 404 Booking not found', async () => {
    signIn();
    mockFetch(jsonResponse(404, { message: 'Booking not found', errors: [] }));

    const error = await captureError(getBooking('booking-99'));

    expect(error).toBeInstanceOf(ApiError);
    expect(isNotFoundError(error)).toBe(true);
  });

  it('R7: rejects with ContractError for { "id": 1 }', async () => {
    signIn();
    mockFetch(jsonResponse(200, { id: 1 }));

    const error = await captureError(getBooking('booking-1'));

    expect(error).toBeInstanceOf(ContractError);
  });

  it('R11: notifies the session rejection on 401', async () => {
    signIn();
    const listener = vi.fn();
    const unsubscribe = onSessionRejected(listener);
    mockFetch(jsonResponse(401, INVALID_TOKEN_BODY));

    const error = await captureError(getBooking('booking-1'));
    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(error).toMatchObject({ status: 401, kind: 'unauthorized' });
  });
});

describe('booking schemas', () => {
  it('R4: bookingWithActivityDtoSchema ignores extra fields and accepts a missing paymentId', () => {
    const withoutPaymentId: Partial<BookingDtoFixture> = bookingDto();
    delete withoutPaymentId.paymentId;
    const parsed = bookingWithActivityDtoSchema.parse({ ...withoutPaymentId, extra: true });

    expect(parsed.paymentId).toBeUndefined();
    expect('extra' in parsed).toBe(false);
    expect(parsed.activity).toEqual({
      name: 'Falcon 9 · Misión Luna',
      slug: 'falcon-9-mision-luna',
      price: 249999,
      date: '2027-03-15T14:30:00.000Z',
      duration: 4320,
      location: 'Cabo Cañaveral, Florida (EE. UU.)',
      status: 'published',
    });
  });

  it('R7: bookingWithActivityDtoSchema rejects an unknown launch status', () => {
    const dto = bookingDto({ activity: { status: 'postponed' } });

    expect(bookingWithActivityDtoSchema.safeParse(dto).success).toBe(false);
  });

  it('bookingDtoSchema accepts a booking without activity nor paymentStatus', () => {
    const plain: Partial<BookingDtoFixture> = bookingDto();
    delete plain.activity;
    delete plain.paymentStatus;

    expect(bookingDtoSchema.safeParse(plain).success).toBe(true);
  });
});
