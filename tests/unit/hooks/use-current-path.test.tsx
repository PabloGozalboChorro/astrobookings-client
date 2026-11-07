import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useCurrentPath } from '../../../src/hooks/use-current-path';

describe('useCurrentPath', () => {
  it.each([
    ['/reservas', '/reservas'],
    ['/reservas?lanzamiento=activity-1', '/reservas?lanzamiento=activity-1'],
    ['/lanzamientos/activity-1?x=1', '/lanzamientos/activity-1?x=1#detalle'],
  ])('R1/R4: returns %s for %s', (expected, entry) => {
    function wrapper({ children }: { children: ReactNode }) {
      return <MemoryRouter initialEntries={[entry]}>{children}</MemoryRouter>;
    }

    const { result } = renderHook(() => useCurrentPath(), { wrapper });

    expect(result.current).toBe(expected);
  });
});
