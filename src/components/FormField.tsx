import { useId, type InputHTMLAttributes } from 'react';

type FormFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  error?: string;
};

export function FormField({ label, error, ...inputProps }: FormFieldProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const hasError = error !== undefined && error !== '';

  return (
    <div>
      <label htmlFor={inputId}>{label}</label>
      <input
        {...inputProps}
        id={inputId}
        aria-invalid={hasError ? 'true' : undefined}
        aria-describedby={hasError ? errorId : undefined}
      />
      {hasError && <p id={errorId}>{error}</p>}
    </div>
  );
}
