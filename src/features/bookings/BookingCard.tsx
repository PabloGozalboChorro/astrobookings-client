import { useId } from 'react';
import { Link } from 'react-router';
import type { Booking } from '../../domain/booking';
import { formatDate, formatDateTime, formatPrice, formatSeatCount } from '../../domain/format';
import { PaymentStatusBadge } from './PaymentStatusBadge';

type BookingCardProps = {
  booking: Booking;
};

export function BookingCard({ booking }: BookingCardProps) {
  const titleId = useId();
  const { launch } = booking;

  return (
    <article className="launch-card" aria-labelledby={titleId}>
      <h2 id={titleId} className="launch-card__title">
        <Link to={`/reservas/${encodeURIComponent(booking.id)}`}>{launch.mission}</Link>
      </h2>
      {launch.rocket !== null && <p>Cohete: {launch.rocket}</p>}
      <p>
        <time dateTime={launch.date.toISOString()}>{formatDateTime(launch.date)}</time>
      </p>
      <p>{formatSeatCount(booking.participants)}</p>
      <p>{formatPrice(booking.totalAmount)}</p>
      <p>
        Reservada el{' '}
        <time dateTime={booking.createdAt.toISOString()}>{formatDate(booking.createdAt)}</time>
      </p>
      <p>
        <PaymentStatusBadge status={booking.paymentStatus} />
      </p>
    </article>
  );
}
