import { useEffect, useId, useState, type ChangeEvent, type RefObject } from 'react';
import type { SortOrder } from '../../api/activities';
import { isLaunchSortParam, isSortOrder, type LaunchSortParam } from './launch-list-params';

export const SEARCH_DEBOUNCE_MS = 300;

const SORT_OPTIONS: readonly { value: LaunchSortParam; label: string }[] = [
  { value: 'nombre', label: 'Nombre (cohete y misión)' },
  { value: 'fecha', label: 'Fecha' },
  { value: 'precio', label: 'Precio' },
];

const ORDER_OPTIONS: readonly { value: SortOrder; label: string }[] = [
  { value: 'asc', label: 'Ascendente' },
  { value: 'desc', label: 'Descendente' },
];

type LaunchFiltersProps = {
  query: string;
  sort: LaunchSortParam;
  order: SortOrder;
  onQueryChange: (text: string) => void;
  onSortChange: (sort: LaunchSortParam, order: SortOrder) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
};

export function LaunchFilters({
  query,
  sort,
  order,
  onQueryChange,
  onSortChange,
  searchInputRef,
}: LaunchFiltersProps) {
  const searchId = useId();
  const sortId = useId();
  const orderId = useId();
  const [inputText, setInputText] = useState(query);
  const [syncedQuery, setSyncedQuery] = useState(query);
  const [pendingAppliedQuery, setPendingAppliedQuery] = useState<string | null>(null);

  if (query !== syncedQuery) {
    setSyncedQuery(query);
    setPendingAppliedQuery(null);
    // When the URL catches up with the search this field applied, keep any text typed since then.
    if (query !== pendingAppliedQuery && query !== inputText.trim()) {
      setInputText(query);
    }
  }

  useEffect(() => {
    if (inputText.trim() === query) {
      return undefined;
    }
    const timeoutId = setTimeout(() => {
      setPendingAppliedQuery(inputText.trim());
      onQueryChange(inputText);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [inputText, query, onQueryChange]);

  function handleSortChange(event: ChangeEvent<HTMLSelectElement>) {
    if (isLaunchSortParam(event.target.value)) {
      onSortChange(event.target.value, order);
    }
  }

  function handleOrderChange(event: ChangeEvent<HTMLSelectElement>) {
    if (isSortOrder(event.target.value)) {
      onSortChange(sort, event.target.value);
    }
  }

  return (
    <div className="launch-filters" role="search">
      <div className="launch-filters__field">
        <label htmlFor={searchId}>Buscar lanzamientos</label>
        <input
          ref={searchInputRef}
          id={searchId}
          type="search"
          value={inputText}
          onChange={(event) => setInputText(event.target.value)}
        />
      </div>
      <div className="launch-filters__field">
        <label htmlFor={sortId}>Ordenar por</label>
        <select id={sortId} value={sort} onChange={handleSortChange}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="launch-filters__field">
        <label htmlFor={orderId}>Dirección</label>
        <select id={orderId} value={order} onChange={handleOrderChange}>
          {ORDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
