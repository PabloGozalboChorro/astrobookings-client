import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthResponseDto } from '../../api/auth';
import { onSessionRejected, setAccessTokenGetter } from '../../api/http';
import { createSession, isExpired, type Session } from '../../domain/session';
import { SessionContext, type SessionContextValue } from './session-context';
import {
  clearStoredSession,
  readStoredAccessToken,
  readStoredSession,
  saveSession,
  type StoredSessionResult,
} from './session-storage';

// Registered when the module loads, not in an effect: child effects run before the
// provider's, so the first authenticated request of a child route needs the getter ready.
setAccessTokenGetter(readStoredAccessToken);

const MAX_TIMEOUT_MS = 2_147_483_647;

type SessionState = {
  session: Session | null;
  expiredNotice: boolean;
};

function initialState(stored: StoredSessionResult): SessionState {
  if (stored.status === 'valid') {
    return { session: stored.session, expiredNotice: false };
  }
  return { session: null, expiredNotice: stored.status === 'expired' };
}

function msUntil(expiresAt: number): number {
  return Math.min(Math.max(expiresAt - Date.now(), 0), MAX_TIMEOUT_MS);
}

type SessionProviderProps = {
  children: ReactNode;
};

export function SessionProvider({ children }: SessionProviderProps) {
  const [initialRead] = useState(() => readStoredSession(Date.now()));
  const [state, setState] = useState(() => initialState(initialRead));
  const { session, expiredNotice } = state;

  useEffect(() => {
    if (initialRead.status === 'expired' || initialRead.status === 'invalid') {
      clearStoredSession();
    }
  }, [initialRead]);

  const signIn = useCallback((auth: AuthResponseDto, receivedAt: number) => {
    const newSession = createSession(auth, receivedAt);
    saveSession(newSession);
    setState({ session: newSession, expiredNotice: false });
  }, []);

  const signOut = useCallback(() => {
    clearStoredSession();
    setState({ session: null, expiredNotice: false });
  }, []);

  const expireSession = useCallback(() => {
    clearStoredSession();
    setState({ session: null, expiredNotice: true });
  }, []);

  const checkExpiry = useCallback(() => {
    if (session !== null && isExpired(session, Date.now())) {
      expireSession();
    }
  }, [session, expireSession]);

  useEffect(() => onSessionRejected(expireSession), [expireSession]);

  useEffect(() => {
    if (session === null) {
      return undefined;
    }
    const timeoutId = setTimeout(checkExpiry, msUntil(session.expiresAt));
    return () => {
      clearTimeout(timeoutId);
    };
  }, [session, checkExpiry]);

  const value = useMemo<SessionContextValue>(
    () => ({ session, expiredNotice, signIn, signOut, expireSession, checkExpiry }),
    [session, expiredNotice, signIn, signOut, expireSession, checkExpiry],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}
