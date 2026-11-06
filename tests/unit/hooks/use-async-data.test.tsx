import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { useCallback } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LoadingIndicator } from '../../../src/components/LoadingIndicator';
import {
  useAsyncData,
  type AsyncDataLoader,
  type AsyncDataState,
} from '../../../src/hooks/use-async-data';
import { deferred, type Deferred } from '../support/deferred';

function LaunchNames({ loader }: { loader: AsyncDataLoader<string[]> }) {
  const { state } = useAsyncData(loader);
  if (state.status === 'loading') {
    return <LoadingIndicator />;
  }
  if (state.status === 'error') {
    return <p role="alert">Error</p>;
  }
  return <p>{state.data.join(', ')}</p>;
}

type SearchLoad = { q: string; signal: AbortSignal; result: Deferred<string[]> };

function useSearch(q: string, search: (q: string, signal: AbortSignal) => Promise<string[]>) {
  const loader = useCallback((signal: AbortSignal) => search(q, signal), [q, search]);
  return useAsyncData(loader);
}

function abortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

describe('useAsyncData', () => {
  it('R10: shows a loading status while the load is pending and hides it when it resolves', async () => {
    const load = deferred<string[]>();
    const loader = () => load.promise;
    render(<LaunchNames loader={loader} />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');

    await act(async () => {
      load.resolve(['Artemis', 'Falcon']);
    });

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Artemis, Falcon')).toBeInTheDocument();
  });

  it('R10: exposes the error when the load fails', async () => {
    const failure = new Error('boom');
    const loader = () => Promise.reject(failure);

    const { result } = renderHook(() => useAsyncData(loader));

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'error', error: failure });
    });
  });

  it('R9: reload repeats the load', async () => {
    const loader = vi
      .fn<(signal: AbortSignal) => Promise<string>>()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('ok');

    const { result } = renderHook(() => useAsyncData(loader));
    await waitFor(() => {
      expect(result.current.state.status).toBe('error');
    });

    act(() => {
      result.current.reload();
    });

    expect(result.current.state).toEqual({ status: 'loading' });
    await waitFor(() => {
      expect(result.current.state).toEqual({ status: 'ready', data: 'ok' });
    });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('R11: aborts the previous load and keeps only the latest result', async () => {
    const loads: SearchLoad[] = [];
    const search = (q: string, signal: AbortSignal) => {
      const result = deferred<string[]>();
      loads.push({ q, signal, result });
      return result.promise;
    };

    const { result, rerender } = renderHook(({ q }) => useSearch(q, search), {
      initialProps: { q: 'fal' },
    });
    rerender({ q: 'falcon' });

    expect(result.current.state).toEqual({ status: 'loading' });
    const [falLoad, falconLoad] = loads;
    if (falLoad === undefined || falconLoad === undefined) {
      throw new Error('Expected two loads');
    }
    expect(falLoad.q).toBe('fal');
    expect(falLoad.signal.aborted).toBe(true);
    expect(falconLoad.signal.aborted).toBe(false);

    await act(async () => {
      falconLoad.result.resolve(['Falcon 9', 'Falcon Heavy']);
    });
    await act(async () => {
      falLoad.result.resolve(['Falcon 9', 'Falcon Heavy', 'Falstaff']);
    });

    expect(result.current.state).toEqual({ status: 'ready', data: ['Falcon 9', 'Falcon Heavy'] });
  });

  it('R11: does not show an aborted load as an error', async () => {
    const statuses: Array<AsyncDataState<string[]>['status']> = [];
    const loads: SearchLoad[] = [];
    const search = (q: string, signal: AbortSignal) => {
      const result = deferred<string[]>();
      signal.addEventListener('abort', () => result.reject(abortError()));
      loads.push({ q, signal, result });
      return result.promise;
    };

    const { result, rerender } = renderHook(
      ({ q }) => {
        const asyncData = useSearch(q, search);
        statuses.push(asyncData.state.status);
        return asyncData;
      },
      { initialProps: { q: 'fal' } },
    );
    await act(async () => {
      rerender({ q: 'falcon' });
    });
    await act(async () => {
      loads[1]?.result.resolve(['Falcon 9']);
    });

    expect(result.current.state).toEqual({ status: 'ready', data: ['Falcon 9'] });
    expect(statuses).not.toContain('error');
  });
});
