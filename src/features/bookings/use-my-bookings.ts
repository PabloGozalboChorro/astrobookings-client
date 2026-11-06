import { useCallback } from 'react';
import { getMyBookings } from '../../api/bookings';
import { sortByMostRecent, toBooking, type Booking } from '../../domain/booking';
import { useAsyncData, type AsyncData } from '../../hooks/use-async-data';

export function useMyBookings(): AsyncData<Booking[]> {
  const loader = useCallback(async (signal: AbortSignal) => {
    const bookings = await getMyBookings(signal);
    return sortByMostRecent(bookings.map(toBooking));
  }, []);
  return useAsyncData(loader);
}
