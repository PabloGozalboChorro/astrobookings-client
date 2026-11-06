import { Link } from 'react-router';
import { EmptyState } from '../../components/EmptyState';
import { ErrorMessage } from '../../components/ErrorMessage';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { toUserMessage } from '../../domain/api-errors';
import { BookingCard } from './BookingCard';
import { useMyBookings } from './use-my-bookings';

const LOADING_TEXT = 'Cargando tus reservas…';
const EMPTY_TEXT = 'Todavía no tienes reservas.';

function MyBookingsContent() {
  const { state, reload } = useMyBookings();

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
  return (
    <ul className="launch-list">
      {state.data.map((booking) => (
        <li key={booking.id}>
          <BookingCard booking={booking} />
        </li>
      ))}
    </ul>
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
