import { describe, expect, it } from 'vitest';
import {
  paymentStatusLabel,
  sortByMostRecent,
  totalAmount,
  type Booking,
} from '../../../src/domain/booking';
import { bookingFromDto } from '../support/bookings';

describe('totalAmount', () => {
  it.each([
    [249999, 2, 499998],
    [12500, 3, 37500],
    [99.99, 3, 299.97],
    [0.1, 3, 0.3],
    [19.99, 7, 139.93],
    [33.333, 3, 100],
    [249999, 0, 0],
  ])('R4: totalAmount(%d, %i) is %d', (price, participants, expected) => {
    expect(totalAmount(price, participants)).toBe(expected);
  });
});

describe('toBooking', () => {
  it('R4: maps a booking with its launch', () => {
    const booking = bookingFromDto();

    expect(booking).toEqual({
      id: 'booking-1',
      launchId: 'activity-1',
      participants: 2,
      createdAt: new Date('2026-11-03T09:00:00.000Z'),
      paymentStatus: 'paid',
      totalAmount: 499998,
      launch: {
        id: 'activity-1',
        slug: 'falcon-9-mision-luna',
        fullName: 'Falcon 9 · Misión Luna',
        mission: 'Misión Luna',
        rocket: 'Falcon 9',
        location: 'Cabo Cañaveral, Florida (EE. UU.)',
        date: new Date('2027-03-15T14:30:00.000Z'),
        durationMinutes: 4320,
        pricePerSeat: 249999,
        status: 'published',
      },
    });
  });

  it('R4: uses the full name as mission when the name has no rocket', () => {
    const booking = bookingFromDto({
      activityId: 'activity-8',
      activity: { name: 'Paseo Lunar Express' },
    });

    expect(booking.launch.rocket).toBeNull();
    expect(booking.launch.mission).toBe('Paseo Lunar Express');
  });

  it('R9: reads a date without time as local midnight', () => {
    const booking = bookingFromDto({ activity: { date: '2027-10-26' } });

    expect(booking.launch.date).toEqual(new Date(2027, 9, 26));
  });

  it('R9: keeps the current launch status', () => {
    const booking = bookingFromDto({ activity: { status: 'cancelled' } });

    expect(booking.launch.status).toBe('cancelled');
  });
});

describe('sortByMostRecent', () => {
  function bookingCreatedAt(id: string, createdAt: string): Booking {
    return bookingFromDto({ id, createdAt });
  }

  it('R4: sorts from the most recent booking without mutating the input', () => {
    const bookings = [
      bookingCreatedAt('booking-1', '2026-11-03T09:00:00.000Z'),
      bookingCreatedAt('booking-2', '2026-11-04T18:00:00.000Z'),
      bookingCreatedAt('booking-3', '2026-11-05T12:00:00.000Z'),
      bookingCreatedAt('booking-4', '2026-11-01T08:00:00.000Z'),
    ];

    const sorted = sortByMostRecent(bookings);

    expect(sorted.map((booking) => booking.id)).toEqual([
      'booking-3',
      'booking-2',
      'booking-1',
      'booking-4',
    ]);
    expect(bookings.map((booking) => booking.id)).toEqual([
      'booking-1',
      'booking-2',
      'booking-3',
      'booking-4',
    ]);
  });

  it('R4: keeps the API order for bookings created at the same time', () => {
    const bookings = [
      bookingCreatedAt('booking-1', '2026-11-03T09:00:00.000Z'),
      bookingCreatedAt('booking-2', '2026-11-04T18:00:00.000Z'),
      bookingCreatedAt('booking-3', '2026-11-03T09:00:00.000Z'),
    ];

    expect(sortByMostRecent(bookings).map((booking) => booking.id)).toEqual([
      'booking-2',
      'booking-1',
      'booking-3',
    ]);
  });
});

describe('paymentStatusLabel', () => {
  it.each([
    ['pending', 'Pendiente de pago'],
    ['paid', 'Pagada'],
    ['refunded', 'Reembolsada'],
  ] as const)('R5: paymentStatusLabel(%s) is "%s"', (status, expected) => {
    expect(paymentStatusLabel(status)).toBe(expected);
  });
});
