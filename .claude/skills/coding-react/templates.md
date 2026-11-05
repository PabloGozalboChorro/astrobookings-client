# Plantillas React

## Cliente de la API — `src/api/http.ts`
```ts
const BASE_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!response.ok) {
    throw new ApiError(response.status, await response.text());
  }
  return (await response.json()) as T;
}
```

## Recurso — `src/api/launches.ts`
```ts
import type { Launch } from '../types/launch';
import { http } from './http';

export function getLaunches(): Promise<Launch[]> {
  return http<Launch[]>('/launches');
}
```

## Hook de datos — `src/features/launches/use-launches.ts`
```ts
import { useEffect, useState } from 'react';
import { getLaunches } from '../../api/launches';
import type { Launch } from '../../types/launch';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; launches: Launch[] };

export function useLaunches(): State {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getLaunches()
      .then((launches) => !cancelled && setState({ status: 'ready', launches }))
      .catch((error: unknown) =>
        !cancelled &&
        setState({ status: 'error', message: error instanceof Error ? error.message : 'Unknown error' }),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
```

## Componente — `src/features/launches/LaunchList.tsx`
```tsx
import { useLaunches } from './use-launches';

export function LaunchList() {
  const state = useLaunches();

  if (state.status === 'loading') return <p role="status">Loading launches…</p>;
  if (state.status === 'error') return <p role="alert">{state.message}</p>;
  if (state.launches.length === 0) return <p>No launches available.</p>;

  return (
    <ul aria-label="Launches">
      {state.launches.map((launch) => (
        <li key={launch.id}>{launch.mission}</li>
      ))}
    </ul>
  );
}
```
