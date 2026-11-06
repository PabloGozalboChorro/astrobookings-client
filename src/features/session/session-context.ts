import { createContext } from 'react';
import type { AuthResponseDto } from '../../api/auth';
import type { Session } from '../../domain/session';

export type SessionContextValue = {
  session: Session | null;
  expiredNotice: boolean;
  signIn: (auth: AuthResponseDto, receivedAt: number) => void;
  signOut: () => void;
  expireSession: () => void;
  checkExpiry: () => void;
};

export const SessionContext = createContext<SessionContextValue | null>(null);
