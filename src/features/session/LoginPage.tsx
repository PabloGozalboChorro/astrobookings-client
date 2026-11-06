import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { login } from '../../api/auth';
import { ErrorMessage } from '../../components/ErrorMessage';
import { FormField } from '../../components/FormField';
import { fieldErrorMessages } from '../../domain/api-errors';
import { authPagePath, REGISTER_PATH, resolveReturnPath } from '../../domain/session';
import { loginErrorMessage, validateLoginForm, type LoginFormErrors } from './login-form';
import { SessionExpiredNotice } from './SessionExpiredNotice';
import { useSession } from './use-session';

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string };

export function LoginPage() {
  const { session, expiredNotice, signIn } = useSession();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFormErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });
  const inFlight = useRef(false);
  const volver = searchParams.get('volver');

  if (session !== null) {
    return <Navigate to={resolveReturnPath(volver)} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) {
      return;
    }
    const errors = validateLoginForm({ email, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSubmitState({ status: 'idle' });
      return;
    }

    inFlight.current = true;
    setSubmitState({ status: 'submitting' });
    try {
      const response = await login({ email: email.trim(), password });
      signIn(response, Date.now());
    } catch (error: unknown) {
      const apiFieldErrors = fieldErrorMessages(error);
      setFieldErrors({ email: apiFieldErrors.email, password: apiFieldErrors.password });
      setSubmitState({ status: 'error', message: loginErrorMessage(error) });
    } finally {
      inFlight.current = false;
    }
  }

  const submitting = submitState.status === 'submitting';

  return (
    <section className="login-page">
      <h1>Iniciar sesión</h1>
      {expiredNotice && <SessionExpiredNotice showLoginLink={false} />}
      <form className="login-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <FormField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          error={fieldErrors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FormField
          label="Contraseña"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          error={fieldErrors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {submitState.status === 'error' && <ErrorMessage message={submitState.message} />}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Entrando…' : 'Iniciar sesión'}
        </button>
      </form>
      <p>
        <Link to={authPagePath(REGISTER_PATH, volver)}>¿No tienes cuenta? Crea una</Link>
      </p>
    </section>
  );
}
