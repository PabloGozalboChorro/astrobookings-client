import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { BookabilityReason } from '../../../../src/domain/launch';
import { BookabilityNotice } from '../../../../src/features/launches/BookabilityNotice';

describe('BookabilityNotice', () => {
  it.each<[string, BookabilityReason]>([
    ['Agotado: no quedan plazas', 'sold-out'],
    ['Este lanzamiento ya se ha realizado', 'done'],
    ['Este lanzamiento se ha cancelado', 'cancelled'],
    ['La fecha de este lanzamiento ya ha pasado', 'past-date'],
    ['No disponible', 'draft'],
  ])('R7: BookabilityNotice shows "%s" for %s', (text, reason) => {
    render(<BookabilityNotice reason={reason} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('R7: BookabilityNotice has no status or alert role', () => {
    render(<BookabilityNotice reason="sold-out" />);

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
