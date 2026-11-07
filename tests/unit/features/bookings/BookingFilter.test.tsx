import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BookingFilter } from '../../../../src/features/bookings/BookingFilter';
import type { LaunchFilterOption } from '../../../../src/features/bookings/booking-filter';

const OPTIONS: readonly LaunchFilterOption[] = [
  { launchId: 'activity-1', label: 'Falcon 9 · Misión Luna' },
  { launchId: 'activity-3', label: 'New Shepard · Vuelo Suborbital' },
];

function launchSelect(): HTMLElement {
  return screen.getByRole('combobox', { name: 'Filtrar por lanzamiento' });
}

function optionTexts(): string[] {
  return within(launchSelect())
    .getAllByRole('option')
    .map((option) => option.textContent ?? '');
}

describe('BookingFilter', () => {
  it('R1: renders the select with "Todos los lanzamientos" first', () => {
    const { rerender } = render(
      <BookingFilter options={OPTIONS} selectedLaunchId={null} onChange={vi.fn()} />,
    );

    expect(optionTexts()).toEqual([
      'Todos los lanzamientos',
      'Falcon 9 · Misión Luna',
      'New Shepard · Vuelo Suborbital',
    ]);
    expect(launchSelect()).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Todos los lanzamientos' })).toHaveProperty(
      'selected',
      true,
    );

    rerender(<BookingFilter options={OPTIONS} selectedLaunchId="activity-3" onChange={vi.fn()} />);

    expect(launchSelect()).toHaveValue('activity-3');
    expect(screen.getByRole('option', { name: 'New Shepard · Vuelo Suborbital' })).toHaveProperty(
      'selected',
      true,
    );
  });

  it('R2: calls onChange with the launch id', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(launchId: string | null) => void>();
    render(<BookingFilter options={OPTIONS} selectedLaunchId={null} onChange={onChange} />);

    await user.selectOptions(launchSelect(), 'Falcon 9 · Misión Luna');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('activity-1');
  });

  it('R3: calls onChange with null for "Todos los lanzamientos"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn<(launchId: string | null) => void>();
    render(<BookingFilter options={OPTIONS} selectedLaunchId="activity-1" onChange={onChange} />);

    await user.selectOptions(launchSelect(), 'Todos los lanzamientos');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
