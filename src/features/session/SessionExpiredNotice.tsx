import { Link } from 'react-router';
import { SESSION_TEXT } from '../../domain/api-errors';
import { loginPath } from '../../domain/session';
import { useCurrentPath } from '../../hooks/use-current-path';

type SessionExpiredNoticeProps = {
  showLoginLink?: boolean;
};

export function SessionExpiredNotice({ showLoginLink = true }: SessionExpiredNoticeProps) {
  const currentPath = useCurrentPath();

  return (
    <div role="alert" className="session-notice">
      <p>{SESSION_TEXT}</p>
      {showLoginLink && (
        <Link to={loginPath(currentPath)}>Iniciar sesión</Link>
      )}
    </div>
  );
}
