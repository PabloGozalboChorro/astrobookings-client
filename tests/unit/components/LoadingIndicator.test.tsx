import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LoadingIndicator } from '../../../src/components/LoadingIndicator';

describe('LoadingIndicator', () => {
  it('R10: shows the default loading text in a status', () => {
    render(<LoadingIndicator />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
  });

  it('R10: shows the given label', () => {
    render(<LoadingIndicator label="Cargando lanzamientos…" />);

    expect(screen.getByRole('status')).toHaveTextContent('Cargando lanzamientos…');
  });
});
