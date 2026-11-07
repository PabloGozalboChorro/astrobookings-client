import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { createBooking, type CreateBookingRequest } from '../../api/bookings';
import { isUnauthorizedError } from '../../api/errors';
import { loginPath } from '../../domain/session';
import { useCurrentPath } from '../../hooks/use-current-path';

export type CreateBookingOutcome =
  | { status: 'ignored' }
  | { status: 'created' }
  | { status: 'failed'; error: unknown };

export type CreateBooking = {
  submitting: boolean;
  submit: (request: CreateBookingRequest) => Promise<CreateBookingOutcome>;
};

export type JustCreatedState = { justCreated: true };

export function useCreateBooking(): CreateBooking {
  const navigate = useNavigate();
  const currentPath = useCurrentPath();
  const inFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(
    async (request: CreateBookingRequest): Promise<CreateBookingOutcome> => {
      if (inFlight.current) {
        return { status: 'ignored' };
      }
      inFlight.current = true;
      setSubmitting(true);
      try {
        const booking = await createBooking(request);
        const state: JustCreatedState = { justCreated: true };
        void navigate(`/reservas/${encodeURIComponent(booking.id)}`, { state });
        return { status: 'created' };
      } catch (error: unknown) {
        // http() has already expired the session; the detail page is public, so go to sign in.
        if (isUnauthorizedError(error)) {
          void navigate(loginPath(currentPath));
        }
        return { status: 'failed', error };
      } finally {
        inFlight.current = false;
        setSubmitting(false);
      }
    },
    [navigate, currentPath],
  );

  return { submitting, submit };
}

export function isJustCreatedState(state: unknown): state is JustCreatedState {
  return (
    typeof state === 'object' &&
    state !== null &&
    'justCreated' in state &&
    state.justCreated === true
  );
}
