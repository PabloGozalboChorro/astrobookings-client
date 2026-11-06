import { Link, useParams } from 'react-router';
import { isNotFoundError } from '../../api/errors';
import { ErrorMessage } from '../../components/ErrorMessage';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { toUserMessage } from '../../domain/api-errors';
import {
  formatDateTime,
  formatDuration,
  formatPrice,
  formatTotalSeats,
} from '../../domain/format';
import { getBookability, isVisible, launchStatusLabel, type Launch } from '../../domain/launch';
import { useNow } from '../../hooks/use-now';
import { BookabilityNotice } from './BookabilityNotice';
import { LaunchNotFound } from './LaunchNotFound';
import { useLaunch } from './use-launch';

const LOADING_TEXT = 'Cargando lanzamiento…';

type LaunchDetailProps = {
  launch: Launch;
  now: Date;
};

function LaunchDetail({ launch, now }: LaunchDetailProps) {
  const bookability = getBookability(launch, now);

  return (
    <article className="launch-detail">
      <h1>{launch.mission}</h1>
      {launch.rocket !== null && <p>Cohete: {launch.rocket}</p>}
      <p>Identificador: {launch.slug}</p>
      <p>{launch.location}</p>
      <p>
        <time dateTime={launch.date.toISOString()}>{formatDateTime(launch.date)}</time>
      </p>
      <p>{formatDuration(launch.durationMinutes)}</p>
      <p>{formatPrice(launch.pricePerSeat)} por plaza</p>
      <p>{formatTotalSeats(launch.totalSeats)}</p>
      <p>Mínimo de viajeros para confirmar el lanzamiento: {launch.minParticipants}</p>
      <p>{launchStatusLabel(launch.status)}</p>
      {!bookability.bookable && <BookabilityNotice reason={bookability.reason} />}
      <p>
        <Link to="/lanzamientos">Volver a los lanzamientos</Link>
      </p>
    </article>
  );
}

type LaunchDetailContentProps = {
  id: string;
};

function LaunchDetailContent({ id }: LaunchDetailContentProps) {
  const { state, reload } = useLaunch(id);
  const now = useNow();

  if (state.status === 'loading') {
    return <LoadingIndicator label={LOADING_TEXT} />;
  }
  if (state.status === 'error') {
    if (isNotFoundError(state.error)) {
      return <LaunchNotFound />;
    }
    return <ErrorMessage message={toUserMessage(state.error)} onRetry={reload} />;
  }
  if (!isVisible(state.data)) {
    return <LaunchNotFound />;
  }
  return <LaunchDetail launch={state.data} now={now} />;
}

export function LaunchDetailPage() {
  const { id } = useParams();

  if (id === undefined) {
    return <LaunchNotFound />;
  }
  return <LaunchDetailContent id={id} />;
}
