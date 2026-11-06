import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PaymentStatusBadge } from '../../../../src/features/bookings/PaymentStatusBadge';

describe('PaymentStatusBadge', () => {
  it.each([
    ['pending', 'Pendiente de pago'],
    ['paid', 'Pagada'],
    ['refunded', 'Reembolsada'],
  ] as const)('R5: shows the label of the payment status %s', (status, label) => {
    render(<PaymentStatusBadge status={status} />);

    const badge = screen.getByText(label);
    expect(badge).toHaveClass('payment-status', `payment-status--${status}`);
  });
});
