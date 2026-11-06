import { EmptyState } from '../../components/EmptyState';
import { ErrorMessage } from '../../components/ErrorMessage';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { toUserMessage } from '../../domain/api-errors';
import type { Launch } from '../../domain/launch';
import type { AsyncDataState } from '../../hooks/use-async-data';
import { LaunchCard } from './LaunchCard';
import { useLaunches } from './use-launches';

const LOADING_TEXT = 'Cargando lanzamientos…';
const EMPTY_TEXT = 'No hay lanzamientos disponibles en este momento.';

type LaunchListContentProps = {
  state: AsyncDataState<Launch[]>;
  onRetry: () => void;
};

function LaunchListContent({ state, onRetry }: LaunchListContentProps) {
  if (state.status === 'loading') {
    return <LoadingIndicator label={LOADING_TEXT} />;
  }
  if (state.status === 'error') {
    return <ErrorMessage message={toUserMessage(state.error)} onRetry={onRetry} />;
  }
  if (state.data.length === 0) {
    return <EmptyState message={EMPTY_TEXT} />;
  }
  return (
    <ul className="launch-list">
      {state.data.map((launch) => (
        <li key={launch.id}>
          <LaunchCard launch={launch} />
        </li>
      ))}
    </ul>
  );
}

export function LaunchListPage() {
  const { state, reload } = useLaunches();

  return (
    <>
      <h1>Lanzamientos</h1>
      <LaunchListContent state={state} onRetry={reload} />
    </>
  );
}
