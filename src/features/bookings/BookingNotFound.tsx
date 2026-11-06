import { Link } from 'react-router';
import { BOOKING_NOT_FOUND_TEXT } from '../../domain/api-errors';

export function BookingNotFound() {
  return (
    <>
      <h1>Reserva no encontrada</h1>
      <p>{BOOKING_NOT_FOUND_TEXT}</p>
      <p>
        <Link to="/reservas">Volver a mis reservas</Link>
      </p>
    </>
  );
}
