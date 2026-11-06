import { Link, useLocation } from 'react-router';
import { SESSION_TEXT } from '../../domain/api-errors';
import { loginPath } from '../../domain/session';

type SessionExpiredNoticeProps = {
  showLoginLink?: boolean;
};

export function SessionExpiredNotice({ showLoginLink = true }: SessionExpiredNoticeProps) {
  const location = useLocation();

  return (
    <div role="alert" className="session-notice">
      <p>{SESSION_TEXT}</p>
      {showLoginLink && (
        <Link to={loginPath(`${location.pathname}${location.search}`)}>Iniciar sesión</Link>
      )}
    </div>
  );
}
