import { useCallback, useEffect, useState } from 'react';

export type AsyncDataState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'ready'; data: T };

export type AsyncDataLoader<T> = (signal: AbortSignal) => Promise<T>;

export type AsyncData<T> = {
  state: AsyncDataState<T>;
  reload: () => void;
};

type SettledState<T> = Exclude<AsyncDataState<T>, { status: 'loading' }>;

type SettledLoad<T> = {
  loader: AsyncDataLoader<T>;
  reloadCount: number;
  state: SettledState<T>;
};

const LOADING_STATE = { status: 'loading' } as const;

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function useAsyncData<T>(loader: AsyncDataLoader<T>): AsyncData<T> {
  const [reloadCount, setReloadCount] = useState(0);
  const [settledLoad, setSettledLoad] = useState<SettledLoad<T> | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function load(): Promise<void> {
      try {
        const data = await loader(controller.signal);
        if (!controller.signal.aborted) {
          setSettledLoad({ loader, reloadCount, state: { status: 'ready', data } });
        }
      } catch (error: unknown) {
        if (!controller.signal.aborted && !isAbortError(error)) {
          setSettledLoad({ loader, reloadCount, state: { status: 'error', error } });
        }
      }
    }

    void load();
    return () => {
      controller.abort();
    };
  }, [loader, reloadCount]);

  const reload = useCallback(() => {
    setReloadCount((count) => count + 1);
  }, []);

  const isCurrent =
    settledLoad !== null &&
    settledLoad.loader === loader &&
    settledLoad.reloadCount === reloadCount;

  return { state: isCurrent ? settledLoad.state : LOADING_STATE, reload };
}
