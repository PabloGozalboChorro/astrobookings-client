import { useId } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { isNotFoundError, isUnauthorizedError } from '../../api/errors';
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
import { isJustCreatedState } from './use-create-booking';

const LOADING_TEXT = 'Cargando reserva…';

function createdBookingLoadErrorText(id: string): string {
  return (
    `Tu reserva se ha creado correctamente (referencia ${id}), ` +
    'pero no hemos podido cargar sus datos.'
  );
}

function MyBookingsLink() {
  return (
    <p>
      <Link to="/reservas">Ver mis reservas</Link>
    </p>
  );
}

type BookingSummaryProps = {
  booking: Booking;
  justCreated: boolean;
};

function BookingSummary({ booking, justCreated }: BookingSummaryProps) {
  const titleId = useId();

  return (
    <section
      aria-labelledby={titleId}
      className={justCreated ? 'booking-confirmation' : undefined}
    >
      <h2 id={titleId}>{justCreated ? 'Reserva confirmada' : 'Tu reserva'}</h2>
      {justCreated && <p>{booking.launch.fullName}</p>}
      <p>{formatSeatCount(booking.participants)}</p>
      <p>Importe total: {formatPrice(booking.totalAmount)}</p>
      <p>
        Reservada el{' '}
        <time dateTime={booking.createdAt.toISOString()}>{formatDate(booking.createdAt)}</time>
      </p>
      <p>
        <PaymentStatusBadge status={booking.paymentStatus} />
      </p>
      {justCreated && <MyBookingsLink />}
    </section>
  );
}

type BookingDetailProps = {
  booking: Booking;
  justCreated: boolean;
};

function BookingDetail({ booking, justCreated }: BookingDetailProps) {
  const { launch } = booking;

  return (
    <article className="booking-detail">
      <h1>{launch.mission}</h1>
      {justCreated && <BookingSummary booking={booking} justCreated />}
      {launch.rocket !== null && <p>Cohete: {launch.rocket}</p>}
      <p>{launch.location}</p>
      <p>
        <time dateTime={launch.date.toISOString()}>{formatDateTime(launch.date)}</time>
      </p>
      <p>{formatDuration(launch.durationMinutes)}</p>
      <p>{formatPrice(launch.pricePerSeat)} por plaza</p>
      <p>Estado del lanzamiento: {launchStatusLabel(launch.status)}</p>
      {!justCreated && <BookingSummary booking={booking} justCreated={false} />}
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
  justCreated: boolean;
};

function BookingDetailContent({ id, justCreated }: BookingDetailContentProps) {
  const { state, reload } = useBooking(id);

  if (state.status === 'loading') {
    return <LoadingIndicator label={LOADING_TEXT} />;
  }
  if (state.status === 'error') {
    if (justCreated && !isUnauthorizedError(state.error)) {
      return (
        <>
          <ErrorMessage message={createdBookingLoadErrorText(id)} onRetry={reload} />
          <MyBookingsLink />
        </>
      );
    }
    if (isNotFoundError(state.error)) {
      return <BookingNotFound />;
    }
    return <ErrorMessage message={toUserMessage(state.error)} onRetry={reload} />;
  }
  return <BookingDetail booking={state.data} justCreated={justCreated} />;
}

export function BookingDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const justCreated = isJustCreatedState(location.state);

  if (id === undefined) {
    return <BookingNotFound />;
  }
  return <BookingDetailContent id={id} justCreated={justCreated} />;
}
