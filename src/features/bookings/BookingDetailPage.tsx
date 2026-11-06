import { useId } from 'react';
import { Link, useParams } from 'react-router';
import { isNotFoundError } from '../../api/errors';
import { ErrorMessage } from '../../components/ErrorMessage';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { toUserMessage } from '../../domain/api-errors';
import type { Booking } from '../../domain/booking';
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatPrice,
  formatSeatCount,
} from '../../domain/format';
import { launchStatusLabel } from '../../domain/launch';
import { BookingNotFound } from './BookingNotFound';
import { PaymentStatusBadge } from './PaymentStatusBadge';
import { useBooking } from './use-booking';

const LOADING_TEXT = 'Cargando reserva…';

type BookingDetailProps = {
  booking: Booking;
};

function BookingDetail({ booking }: BookingDetailProps) {
  const bookingTitleId = useId();
  const { launch } = booking;

  return (
    <article className="booking-detail">
      <h1>{launch.mission}</h1>
      {launch.rocket !== null && <p>Cohete: {launch.rocket}</p>}
      <p>{launch.location}</p>
      <p>
        <time dateTime={launch.date.toISOString()}>{formatDateTime(launch.date)}</time>
      </p>
      <p>{formatDuration(launch.durationMinutes)}</p>
      <p>{formatPrice(launch.pricePerSeat)} por plaza</p>
      <p>Estado del lanzamiento: {launchStatusLabel(launch.status)}</p>
      <section aria-labelledby={bookingTitleId}>
        <h2 id={bookingTitleId}>Tu reserva</h2>
        <p>{formatSeatCount(booking.participants)}</p>
        <p>Importe total: {formatPrice(booking.totalAmount)}</p>
        <p>
          Reservada el{' '}
          <time dateTime={booking.createdAt.toISOString()}>{formatDate(booking.createdAt)}</time>
        </p>
        <p>
          <PaymentStatusBadge status={booking.paymentStatus} />
        </p>
      </section>
      <p>
        <Link to={`/lanzamientos/${encodeURIComponent(launch.id)}`}>Ver lanzamiento</Link>
      </p>
      <p>
        <Link to="/reservas">Volver a mis reservas</Link>
      </p>
    </article>
  );
}

type BookingDetailContentProps = {
  id: string;
};

function BookingDetailContent({ id }: BookingDetailContentProps) {
  const { state, reload } = useBooking(id);

  if (state.status === 'loading') {
    return <LoadingIndicator label={LOADING_TEXT} />;
  }
  if (state.status === 'error') {
    if (isNotFoundError(state.error)) {
      return <BookingNotFound />;
    }
    return <ErrorMessage message={toUserMessage(state.error)} onRetry={reload} />;
  }
  return <BookingDetail booking={state.data} />;
}

export function BookingDetailPage() {
  const { id } = useParams();

  if (id === undefined) {
    return <BookingNotFound />;
  }
  return <BookingDetailContent id={id} />;
}
