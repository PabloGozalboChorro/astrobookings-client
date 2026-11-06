import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from '../../../src/components/FormField';

describe('FormField edge cases', () => {
  it('R8: treats an empty error as no error', () => {
    render(<FormField label="Email" name="email" error="" />);

    const input = screen.getByLabelText('Email');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('R8: links each field to its own error when there are several fields', () => {
    render(
      <>
        <FormField label="Email" name="email" error="Introduce un email válido." />
        <FormField
          label="Contraseña"
          name="password"
          type="password"
          error="La contraseña debe tener al menos 6 caracteres."
        />
      </>,
    );

    const email = screen.getByLabelText('Email');
    const password = screen.getByLabelText('Contraseña');
    expect(email.getAttribute('aria-describedby')).not.toBe(password.getAttribute('aria-describedby'));
    expect(email).toHaveAccessibleDescription('Introduce un email válido.');
    expect(password).toHaveAccessibleDescription('La contraseña debe tener al menos 6 caracteres.');
  });
});
