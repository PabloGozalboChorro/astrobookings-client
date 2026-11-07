import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { EmptyState } from '../../components/EmptyState';
import { ErrorMessage } from '../../components/ErrorMessage';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { toUserMessage } from '../../domain/api-errors';
import { BookingCard } from './BookingCard';
import { BookingFilter } from './BookingFilter';
import {
  filterBookingsByLaunch,
  launchFilterOptions,
  selectedLaunchId,
  withLaunchFilter,
} from './booking-filter';
import { useMyBookings } from './use-my-bookings';

const LOADING_TEXT = 'Cargando tus reservas…';
const EMPTY_TEXT = 'Todavía no tienes reservas.';

function MyBookingsContent() {
  const { state, reload } = useMyBookings();
  const [searchParams, setSearchParams] = useSearchParams();

  const handleFilterChange = useCallback(
    (launchId: string | null) => {
      setSearchParams((current) => withLaunchFilter(current, launchId), { replace: true });
    },
    [setSearchParams],
  );

  if (state.status === 'loading') {
    return <LoadingIndicator label={LOADING_TEXT} />;
  }
  if (state.status === 'error') {
    return <ErrorMessage message={toUserMessage(state.error)} onRetry={reload} />;
  }
  if (state.data.length === 0) {
    return (
      <>
        <EmptyState message={EMPTY_TEXT} />
        <p>
          <Link to="/lanzamientos">Ver lanzamientos</Link>
        </p>
      </>
    );
  }
  const options = launchFilterOptions(state.data);
  const selected = selectedLaunchId(searchParams, options);
  const visibleBookings = filterBookingsByLaunch(state.data, selected);
  return (
    <>
      <BookingFilter options={options} selectedLaunchId={selected} onChange={handleFilterChange} />
      <ul className="launch-list">
        {visibleBookings.map((booking) => (
          <li key={booking.id}>
            <BookingCard booking={booking} />
          </li>
        ))}
      </ul>
    </>
  );
}

export function MyBookingsPage() {
  return (
    <>
      <h1>Mis reservas</h1>
      <MyBookingsContent />
    </>
  );
}
