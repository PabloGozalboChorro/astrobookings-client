import { bookingWithActivityDtoSchema } from '../../../src/api/schemas';
import { toBooking, type Booking } from '../../../src/domain/booking';
import { seedActivityDto, type ActivityDtoFixture } from './activities';

export type BookedActivityFixture = Pick<
  ActivityDtoFixture,
  'name' | 'slug' | 'price' | 'date' | 'duration' | 'location' | 'status'
>;

export type BookingDtoFixture = {
  id: string;
  activityId: string;
  userId: string;
  participants: number;
  createdAt: string;
  paymentId?: string;
  paymentStatus: string;
  activity: BookedActivityFixture;
};

// Only the seven activity fields that GET /bookings of the fork returns.
function bookedActivity(
  activityId: string,
  overrides: Partial<BookedActivityFixture> = {},
): BookedActivityFixture {
  const { name, slug, price, date, duration, location, status } = seedActivityDto(activityId);
  return { name, slug, price, date, duration, location, status, ...overrides };
}

type BookingDtoOverrides = Partial<Omit<BookingDtoFixture, 'activity'>> & {
  activity?: Partial<BookedActivityFixture>;
};

// booking-1 of the acceptance criteria: activity-1, 2 seats, paid on 2026-11-03.
export function bookingDto({ activity, ...overrides }: BookingDtoOverrides = {}): BookingDtoFixture {
  const activityId = overrides.activityId ?? 'activity-1';
  return {
    id: 'booking-1',
    activityId,
    userId: 'user-2',
    participants: 2,
    createdAt: '2026-11-03T09:00:00.000Z',
    paymentId: 'payment-1',
    paymentStatus: 'paid',
    ...overrides,
    activity: bookedActivity(activityId, activity),
  };
}

// booking-2 of the acceptance criteria: activity-3, 3 seats, paid on 2026-11-04.
export function suborbitalBookingDto(overrides: BookingDtoOverrides = {}): BookingDtoFixture {
  return bookingDto({
    id: 'booking-2',
    activityId: 'activity-3',
    participants: 3,
    createdAt: '2026-11-04T18:00:00.000Z',
    paymentId: 'payment-2',
    ...overrides,
  });
}

export function bookingFromDto(overrides: BookingDtoOverrides = {}): Booking {
  return toBooking(bookingWithActivityDtoSchema.parse(bookingDto(overrides)));
}
