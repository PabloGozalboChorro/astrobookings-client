import { useId } from 'react';
import { Link } from 'react-router';
import {
  formatDateTime,
  formatDuration,
  formatPrice,
  formatTotalSeats,
} from '../../domain/format';
import { launchStatusLabel, type Bookability, type Launch } from '../../domain/launch';
import { BookabilityNotice } from './BookabilityNotice';

type LaunchCardProps = {
  launch: Launch;
  bookability: Bookability;
};

export function LaunchCard({ launch, bookability }: LaunchCardProps) {
  const titleId = useId();

  return (
    <article className="launch-card" aria-labelledby={titleId}>
      <h2 id={titleId} className="launch-card__title">
        <Link to={`/lanzamientos/${encodeURIComponent(launch.id)}`}>{launch.mission}</Link>
      </h2>
      {launch.rocket !== null && <p>Cohete: {launch.rocket}</p>}
      <p>{launch.location}</p>
      <p>
        <time dateTime={launch.date.toISOString()}>{formatDateTime(launch.date)}</time>
      </p>
      <p>{formatDuration(launch.durationMinutes)}</p>
      <p>{formatPrice(launch.pricePerSeat)} por plaza</p>
      <p>{formatTotalSeats(launch.totalSeats)}</p>
      <p className="launch-card__status">{launchStatusLabel(launch.status)}</p>
      {!bookability.bookable && <BookabilityNotice reason={bookability.reason} />}
    </article>
  );
}
