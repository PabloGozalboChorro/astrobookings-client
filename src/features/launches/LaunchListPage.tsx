import { useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router';
import type { SortOrder } from '../../api/activities';
import { EmptyState } from '../../components/EmptyState';
import { ErrorMessage } from '../../components/ErrorMessage';
import { LoadingIndicator } from '../../components/LoadingIndicator';
import { toUserMessage } from '../../domain/api-errors';
import { getBookability, type Launch } from '../../domain/launch';
import type { AsyncDataState } from '../../hooks/use-async-data';
import { useNow } from '../../hooks/use-now';
import { LaunchCard } from './LaunchCard';
import { LaunchFilters } from './LaunchFilters';
import {
  parseLaunchListParams,
  toActivitiesQuery,
  withQuery,
  withSort,
  type LaunchSortParam,
} from './launch-list-params';
import { NoSearchResults } from './NoSearchResults';
import { useLaunches } from './use-launches';

const LOADING_TEXT = 'Cargando lanzamientos…';
const EMPTY_TEXT = 'No hay lanzamientos disponibles en este momento.';

type LaunchListContentProps = {
  state: AsyncDataState<Launch[]>;
  now: Date;
  query: string;
  onRetry: () => void;
  onClearSearch: () => void;
};

function LaunchListContent({ state, now, query, onRetry, onClearSearch }: LaunchListContentProps) {
  if (state.status === 'loading') {
    return <LoadingIndicator label={LOADING_TEXT} />;
  }
  if (state.status === 'error') {
    return <ErrorMessage message={toUserMessage(state.error)} onRetry={onRetry} />;
  }
  if (state.data.length === 0) {
    return query === '' ? (
      <EmptyState message={EMPTY_TEXT} />
    ) : (
      <NoSearchResults query={query} onClear={onClearSearch} />
    );
  }
  return (
    <ul className="launch-list">
      {state.data.map((launch) => (
        <li key={launch.id}>
          <LaunchCard launch={launch} bookability={getBookability(launch, now)} />
        </li>
      ))}
    </ul>
  );
}

export function LaunchListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const params = parseLaunchListParams(searchParams);
  const { state, reload } = useLaunches(toActivitiesQuery(params));
  const now = useNow();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleQueryChange = useCallback(
    (text: string) => {
      setSearchParams((current) => withQuery(current, text), { replace: true });
    },
    [setSearchParams],
  );

  const handleSortChange = useCallback(
    (sort: LaunchSortParam, order: SortOrder) => {
      setSearchParams((current) => withSort(current, sort, order), { replace: true });
    },
    [setSearchParams],
  );

  const handleClearSearch = useCallback(() => {
    setSearchParams((current) => withQuery(current, ''), { replace: true });
    searchInputRef.current?.focus();
  }, [setSearchParams]);

  return (
    <>
      <h1>Lanzamientos</h1>
      <LaunchFilters
        query={params.query}
        sort={params.sort}
        order={params.order}
        onQueryChange={handleQueryChange}
        onSortChange={handleSortChange}
        searchInputRef={searchInputRef}
      />
      <LaunchListContent
        state={state}
        now={now}
        query={params.query}
        onRetry={reload}
        onClearSearch={handleClearSearch}
      />
    </>
  );
}
