import { useCallback } from 'react';
import { getBooking } from '../../api/bookings';
import { toBooking, type Booking } from '../../domain/booking';
import { useAsyncData, type AsyncData } from '../../hooks/use-async-data';

export function useBooking(id: string): AsyncData<Booking> {
  const loader = useCallback(
    async (signal: AbortSignal) => toBooking(await getBooking(id, signal)),
    [id],
  );
  return useAsyncData(loader);
}
