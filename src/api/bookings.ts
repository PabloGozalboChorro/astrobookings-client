import { z } from 'zod';
import { http } from './http';
import {
  bookingDtoSchema,
  bookingWithActivityDtoSchema,
  type BookingDto,
  type BookingWithActivityDto,
} from './schemas';

const bookingListSchema = z.array(bookingWithActivityDtoSchema);

export type CreateBookingRequest = {
  activityId: string;
  participants: number;
};

export function getMyBookings(signal?: AbortSignal): Promise<BookingWithActivityDto[]> {
  return http('/bookings', bookingListSchema, { auth: true, signal });
}

export function getBooking(id: string, signal?: AbortSignal): Promise<BookingWithActivityDto> {
  return http(`/bookings/${encodeURIComponent(id)}`, bookingWithActivityDtoSchema, {
    auth: true,
    signal,
  });
}

// Without signal: a booking already sent is not aborted on unmount (it could be created
// without the person knowing it).
export function createBooking(request: CreateBookingRequest): Promise<BookingDto> {
  return http('/bookings', bookingDtoSchema, { method: 'POST', body: request, auth: true });
}
