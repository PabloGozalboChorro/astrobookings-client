import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetworkError } from '../../../src/api/errors';
import { ErrorMessage } from '../../../src/components/ErrorMessage';
import { LoadingIndicator } from '../../../src/components/LoadingIndicator';
import { toUserMessage } from '../../../src/domain/api-errors';
import { useAsyncData, type AsyncDataLoader } from '../../../src/hooks/use-async-data';
import { deferred, type Deferred } from '../support/deferred';

type PendingLoad = { signal: AbortSignal; result: Deferred<string> };

function recordingLoader(loads: PendingLoad[]): AsyncDataLoader<string> {
  return (signal) => {
    const result = deferred<string>();
    loads.push({ signal, result });
    return result.promise;
  };
}

function LaunchList({ loader }: { loader: AsyncDataLoader<string> }) {
  const { state, reload } = useAsyncData(loader);
  if (state.status === 'loading') {
    return <LoadingIndicator label="Cargando lanzamientos…" />;
  }
  if (state.status === 'error') {
    return <ErrorMessage message={toUserMessage(state.error)} onRetry={reload} />;
  }
  return <p>{state.data}</p>;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAsyncData edge cases', () => {
  it('R11: reload during a pending load aborts it and keeps only the latest result', async () => {
    const loads: PendingLoad[] = [];
    const loader = recordingLoader(loads);
    const { result } = renderHook(() => useAsyncData(loader));

    act(() => {
      result.current.reload();
    });

    const [first, second] = loads;
    if (first === undefined || second === undefined) {
      throw new Error('Expected two loads');
    }
    expect(first.signal.aborted).toBe(true);
    expect(second.signal.aborted).toBe(false);

    await act(async () => {
      second.result.resolve('latest');
    });
    await act(async () => {
      first.result.resolve('stale');
    });

    expect(result.current.state).toEqual({ status: 'ready', data: 'latest' });
  });

  it('R11: ignores a superseded load that fails with a non-abort error', async () => {
    const loads: PendingLoad[] = [];
    const loader = recordingLoader(loads);
    const { result } = renderHook(() => useAsyncData(loader));

    act(() => {
      result.current.reload();
    });
    await act(async () => {
      loads[0]?.result.reject(new NetworkError());
    });

    expect(result.current.state).toEqual({ status: 'loading' });

    await act(async () => {
      loads[1]?.result.resolve('latest');
    });

    expect(result.current.state).toEqual({ status: 'ready', data: 'latest' });
  });

  it('R11: aborts the pending load on unmount without reporting errors', async () => {
    const consoleError = vi.spyOn(console, 'error');
    const loads: PendingLoad[] = [];
    const loader = recordingLoader(loads);
    const { unmount } = renderHook(() => useAsyncData(loader));

    unmount();
    await act(async () => {
      loads[0]?.result.resolve('late');
    });

    expect(loads[0]?.signal.aborted).toBe(true);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('R10: shows the loading status again when reloading after a successful load', async () => {
    const loads: PendingLoad[] = [];
    const loader = recordingLoader(loads);
    const { result } = renderHook(() => useAsyncData(loader));
    await act(async () => {
      loads[0]?.result.resolve('first');
    });
    expect(result.current.state).toEqual({ status: 'ready', data: 'first' });

    act(() => {
      result.current.reload();
    });

    expect(result.current.state).toEqual({ status: 'loading' });
    await act(async () => {
      loads[1]?.result.resolve('second');
    });
    expect(result.current.state).toEqual({ status: 'ready', data: 'second' });
  });
});

describe('loading, error and retry together', () => {
  it('R3, R9, R10: shows the network error in an alert and "Reintentar" repeats the load', async () => {
    const user = userEvent.setup();
    const loads: PendingLoad[] = [];
    const loader = recordingLoader(loads);
    render(<LaunchList loader={loader} />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando lanzamientos…');

    await act(async () => {
      loads[0]?.result.reject(new NetworkError());
    });

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.',
    );

    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(loads).toHaveLength(2);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();

    await act(async () => {
      loads[1]?.result.resolve('Falcon 9');
    });

    expect(screen.getByText('Falcon 9')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
