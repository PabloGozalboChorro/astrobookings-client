import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorMessage } from '../../../src/components/ErrorMessage';

const NETWORK_TEXT =
  'No se puede conectar con el servidor de AstroBookings. Comprueba tu conexión e inténtalo de nuevo.';

describe('ErrorMessage', () => {
  it('R9: shows the message in an alert and retries once', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorMessage message={NETWORK_TEXT} onRetry={onRetry} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(NETWORK_TEXT);

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('R9: hides the retry button without a retry handler', () => {
    render(<ErrorMessage message={NETWORK_TEXT} />);

    expect(screen.getByRole('alert')).toHaveTextContent(NETWORK_TEXT);
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });
});
