import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../src/api/errors';
import { FormField } from '../../../src/components/FormField';
import { fieldErrorMessages } from '../../../src/domain/api-errors';

function validationError(fieldErrors: Record<string, string>): ApiError {
  return new ApiError({
    status: 400,
    kind: 'validation',
    message: 'Validation failed',
    fieldErrors,
    availableSeats: null,
  });
}

function describedText(input: HTMLElement): string | null {
  const describedBy = input.getAttribute('aria-describedby');
  if (describedBy === null) {
    return null;
  }
  return document.getElementById(describedBy)?.textContent ?? null;
}

describe('FormField', () => {
  it('R8: marks the field as invalid and links its error', () => {
    const errors = fieldErrorMessages(validationError({ email: 'Invalid email' }));

    render(<FormField label="Email" name="email" type="email" error={errors.email} />);

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(describedText(input)).toBe('Introduce un email válido.');
  });

  it('R8: shows the unknown field text', () => {
    const errors = fieldErrorMessages(validationError({ foo: 'bad value' }));

    render(<FormField label="Foo" name="foo" error={errors.foo} />);

    expect(describedText(screen.getByLabelText('Foo'))).toBe('Dato no válido (bad value)');
  });

  it('R8: has no aria-invalid nor aria-describedby without error', () => {
    render(<FormField label="Email" name="email" />);

    const input = screen.getByLabelText('Email');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('R8: passes the input props to the control', () => {
    render(<FormField label="Plazas" name="participants" type="number" min={1} defaultValue="2" />);

    const input = screen.getByLabelText('Plazas');
    expect(input).toHaveAttribute('name', 'participants');
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '1');
    expect(input).toHaveValue(2);
  });
});
