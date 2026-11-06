import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from '../../../src/components/EmptyState';

describe('EmptyState', () => {
  it('renders its message', () => {
    render(<EmptyState message="No hay lanzamientos disponibles." />);

    expect(screen.getByText('No hay lanzamientos disponibles.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
