import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SortOrder } from '../../../../src/api/activities';
import {
  LaunchFilters,
  SEARCH_DEBOUNCE_MS,
} from '../../../../src/features/launches/LaunchFilters';
import type { LaunchSortParam } from '../../../../src/features/launches/launch-list-params';

// With Vitest fake timers, user-event hangs: Testing Library only advances Jest's fake
// timers in its async wrapper. These tests use the synchronous fireEvent instead, one
// change event per keystroke.

type FiltersProps = {
  query?: string;
  sort?: LaunchSortParam;
  order?: SortOrder;
};

const onQueryChange = vi.fn<(text: string) => void>();
const onSortChange = vi.fn<(sort: LaunchSortParam, order: SortOrder) => void>();

function filters({ query = '', sort = 'fecha', order = 'asc' }: FiltersProps = {}) {
  return (
    <LaunchFilters
      query={query}
      sort={sort}
      order={order}
      onQueryChange={onQueryChange}
      onSortChange={onSortChange}
      searchInputRef={createRef<HTMLInputElement>()}
    />
  );
}

function renderFilters(props: FiltersProps = {}) {
  const view = render(filters(props));
  return { rerender: (next: FiltersProps) => view.rerender(filters(next)) };
}

function advance(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

function searchBox(): HTMLInputElement {
  return screen.getByRole('searchbox', { name: 'Buscar lanzamientos' });
}

function typeText(text: string) {
  for (const character of text) {
    fireEvent.change(searchBox(), { target: { value: `${searchBox().value}${character}` } });
  }
}

function clearSearchBox() {
  fireEvent.change(searchBox(), { target: { value: '' } });
}

function optionTexts(select: HTMLElement): string[] {
  return within(select)
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
  onQueryChange.mockReset();
  onSortChange.mockReset();
});

describe('LaunchFilters', () => {
  it('R1: renders the search box and both selects with their options', () => {
    renderFilters({ query: 'kourou', sort: 'precio', order: 'desc' });

    expect(searchBox()).toHaveValue('kourou');
    const sortSelect = screen.getByRole('combobox', { name: 'Ordenar por' });
    expect(optionTexts(sortSelect)).toEqual(['Nombre (cohete y misión)', 'Fecha', 'Precio']);
    expect(sortSelect).toHaveValue('precio');
    const orderSelect = screen.getByRole('combobox', { name: 'Dirección' });
    expect(optionTexts(orderSelect)).toEqual(['Ascendente', 'Descendente']);
    expect(orderSelect).toHaveValue('desc');
    expect(screen.getByRole('search')).toBeInTheDocument();
  });

  it('R2: debounces for 300 ms', () => {
    expect(SEARCH_DEBOUNCE_MS).toBe(300);
  });

  it('R2: calls onQueryChange once 300 ms after the last keystroke', () => {
    renderFilters();

    typeText('falcon');
    advance(299);

    expect(onQueryChange).not.toHaveBeenCalled();

    advance(1);

    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenCalledWith('falcon');
  });

  it('R2: restarts the delay on every keystroke', () => {
    renderFilters();

    typeText('fal');
    advance(200);
    typeText('con');
    advance(200);

    expect(onQueryChange).not.toHaveBeenCalled();

    advance(100);

    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenCalledWith('falcon');
  });

  it('R2: does not call onQueryChange when the trimmed text equals the applied query', () => {
    renderFilters({ query: 'falcon' });

    typeText(' ');
    advance(SEARCH_DEBOUNCE_MS);

    expect(onQueryChange).not.toHaveBeenCalled();
    expect(searchBox()).toHaveValue('falcon ');
  });

  it('R3: reports an empty text when the field is cleared', () => {
    renderFilters({ query: 'falcon' });

    clearSearchBox();
    advance(SEARCH_DEBOUNCE_MS);

    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenCalledWith('');
  });

  it('R3: reports a whitespace-only text as typed', () => {
    renderFilters({ query: 'falcon' });

    clearSearchBox();
    typeText('   ');
    advance(SEARCH_DEBOUNCE_MS);

    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenCalledWith('   ');
  });

  it('R4: calls onSortChange immediately with the new sort and the current order', () => {
    renderFilters({ sort: 'fecha', order: 'desc' });

    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar por' }), {
      target: { value: 'precio' },
    });

    expect(onSortChange).toHaveBeenCalledTimes(1);
    expect(onSortChange).toHaveBeenCalledWith('precio', 'desc');
    expect(onQueryChange).not.toHaveBeenCalled();
  });

  it('R4: calls onSortChange immediately with the new order and the current sort', () => {
    renderFilters({ sort: 'nombre', order: 'asc' });

    fireEvent.change(screen.getByRole('combobox', { name: 'Dirección' }), {
      target: { value: 'desc' },
    });

    expect(onSortChange).toHaveBeenCalledTimes(1);
    expect(onSortChange).toHaveBeenCalledWith('nombre', 'desc');
  });

  it('R6: updates the field when the query prop changes', () => {
    const { rerender } = renderFilters({ query: 'falcon' });

    rerender({ query: 'kourou' });

    expect(searchBox()).toHaveValue('kourou');

    rerender({ query: '' });

    expect(searchBox()).toHaveValue('');
    advance(SEARCH_DEBOUNCE_MS);
    expect(onQueryChange).not.toHaveBeenCalled();
  });

  it('R2: keeps a trailing space typed while the search is applied', () => {
    const { rerender } = renderFilters();

    typeText('falcon ');
    advance(SEARCH_DEBOUNCE_MS);
    rerender({ query: 'falcon' });

    expect(onQueryChange).toHaveBeenCalledWith('falcon ');
    expect(searchBox()).toHaveValue('falcon ');
  });

  it('R2: does not search when the text is typed and fully deleted within 300 ms', () => {
    renderFilters();

    typeText('falcon');
    advance(100);
    clearSearchBox();
    advance(SEARCH_DEBOUNCE_MS);

    expect(onQueryChange).not.toHaveBeenCalled();
    expect(searchBox()).toHaveValue('');
  });

  it('R2: keeps the pending search when the sort changes before the delay ends', () => {
    const { rerender } = renderFilters();

    typeText('falcon');
    advance(200);
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar por' }), {
      target: { value: 'precio' },
    });
    rerender({ sort: 'precio' });
    advance(SEARCH_DEBOUNCE_MS);

    expect(onSortChange).toHaveBeenCalledWith('precio', 'asc');
    expect(onQueryChange).toHaveBeenCalledTimes(1);
    expect(onQueryChange).toHaveBeenCalledWith('falcon');
    expect(searchBox()).toHaveValue('falcon');
  });

  it('R2: keeps a keystroke typed before the applied search reaches the URL', () => {
    const { rerender } = renderFilters();

    typeText('fal');
    advance(SEARCH_DEBOUNCE_MS);
    expect(onQueryChange).toHaveBeenCalledWith('fal');
    // The person keeps typing before the router renders the new URL (BrowserRouter
    // applies location changes inside startTransition, so a keystroke can be committed
    // first); then the URL with q=fal arrives.
    typeText('c');
    rerender({ query: 'fal' });

    expect(searchBox()).toHaveValue('falc');
    advance(SEARCH_DEBOUNCE_MS);
    expect(onQueryChange).toHaveBeenLastCalledWith('falc');
  });

  it('R9: exposes the search box through searchInputRef', () => {
    const searchInputRef = createRef<HTMLInputElement>();
    render(
      <LaunchFilters
        query=""
        sort="fecha"
        order="asc"
        onQueryChange={onQueryChange}
        onSortChange={onSortChange}
        searchInputRef={searchInputRef}
      />,
    );

    expect(searchInputRef.current).toBe(searchBox());
  });
});
