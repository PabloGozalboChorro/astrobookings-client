import { z } from 'zod';
import { http } from './http';
import { bookingWithActivityDtoSchema, type BookingWithActivityDto } from './schemas';

const bookingListSchema = z.array(bookingWithActivityDtoSchema);

export function getMyBookings(signal?: AbortSignal): Promise<BookingWithActivityDto[]> {
  return http('/bookings', bookingListSchema, { auth: true, signal });
}

export function getBooking(id: string, signal?: AbortSignal): Promise<BookingWithActivityDto> {
  return http(`/bookings/${encodeURIComponent(id)}`, bookingWithActivityDtoSchema, {
    auth: true,
    signal,
  });
}
