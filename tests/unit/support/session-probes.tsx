import { useCallback } from 'react';
import { useLocation } from 'react-router';
import { z } from 'zod';
import { http } from '../../../src/api/http';
import { useAsyncData } from '../../../src/hooks/use-async-data';

const bookingsSchema = z.array(z.unknown());

function useProtectedRequest() {
  const loader = useCallback(
    (signal: AbortSignal) => http('/bookings', bookingsSchema, { auth: true, signal }),
    [],
  );
  return useAsyncData(loader);
}

export function ProtectedProbe() {
  const location = useLocation();
  const { state } = useProtectedRequest();
  return (
    <section aria-label="Sonda protegida">
      <p>{`Ruta: ${location.pathname}${location.search}`}</p>
      <p>{`Petición: ${state.status}`}</p>
    </section>
  );
}

export function LocationProbe() {
  const location = useLocation();
  return <p>{`Ruta: ${location.pathname}${location.search}`}</p>;
}

export function CurrentLocation() {
  const location = useLocation();
  return <output aria-label="Ubicación actual">{`${location.pathname}${location.search}`}</output>;
}
