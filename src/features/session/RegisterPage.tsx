import { useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { register } from '../../api/auth';
import { ErrorMessage } from '../../components/ErrorMessage';
import { FormField } from '../../components/FormField';
import { authPagePath, LOGIN_PATH, resolveReturnPath } from '../../domain/session';
import {
  registerErrorFeedback,
  validateRegisterForm,
  type RegisterFormErrors,
} from './register-form';
import { useSession } from './use-session';

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string };

export function RegisterPage() {
  const { session, signIn } = useSession();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<RegisterFormErrors>({});
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
    const errors = validateRegisterForm({ username, email, password, termsAccepted });
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setSubmitState({ status: 'idle' });
      return;
    }

    inFlight.current = true;
    setSubmitState({ status: 'submitting' });
    try {
      const response = await register({
        username: username.trim(),
        email: email.trim(),
        password,
        terms: true,
      });
      signIn(response, Date.now());
    } catch (error: unknown) {
      const feedback = registerErrorFeedback(error);
      setFieldErrors(feedback.fieldErrors);
      setSubmitState({ status: 'error', message: feedback.alert });
    } finally {
      inFlight.current = false;
    }
  }

  const submitting = submitState.status === 'submitting';

  return (
    <section className="login-page">
      <h1>Crear cuenta</h1>
      <form className="login-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <FormField
          label="Nombre de usuario"
          type="text"
          name="username"
          autoComplete="username"
          value={username}
          error={fieldErrors.username}
          onChange={(event) => setUsername(event.target.value)}
        />
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
          autoComplete="new-password"
          value={password}
          error={fieldErrors.password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <FormField
          label="Acepto los términos y condiciones"
          type="checkbox"
          name="terms"
          checked={termsAccepted}
          error={fieldErrors.terms}
          onChange={(event) => setTermsAccepted(event.target.checked)}
        />
        {submitState.status === 'error' && <ErrorMessage message={submitState.message} />}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
      <p>
        <Link to={authPagePath(LOGIN_PATH, volver)}>¿Ya tienes cuenta? Inicia sesión</Link>
      </p>
    </section>
  );
}
