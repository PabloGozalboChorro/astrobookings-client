import { useState, type FormEvent } from 'react';
import { ErrorMessage } from '../../components/ErrorMessage';
import { FormField } from '../../components/FormField';
import { totalAmount } from '../../domain/booking';
import { formatPrice } from '../../domain/format';
import type { Launch } from '../../domain/launch';
import { bookingErrorFeedback, parseParticipants, validateParticipants } from './booking-form';
import { useCreateBooking } from './use-create-booking';

const INITIAL_PARTICIPANTS = '1';

type BookingFormProps = {
  launch: Launch;
};

function totalAmountText(pricePerSeat: number, value: string): string {
  const participants = parseParticipants(value);
  if (participants === null) {
    return 'Importe total: —';
  }
  return `Importe total: ${formatPrice(totalAmount(pricePerSeat, participants))}`;
}

export function BookingForm({ launch }: BookingFormProps) {
  const { submitting, submit } = useCreateBooking();
  const [value, setValue] = useState(INITIAL_PARTICIPANTS);
  const [knownAvailableSeats, setKnownAvailableSeats] = useState<number | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [alert, setAlert] = useState<string | undefined>(undefined);
  const maxSeats = knownAvailableSeats ?? launch.totalSeats;
  const noSeatsLeft = knownAvailableSeats === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || noSeatsLeft) {
      return;
    }
    const validation = validateParticipants(value, maxSeats);
    if (!validation.ok) {
      setFieldError(validation.error);
      setAlert(undefined);
      return;
    }
    setFieldError(undefined);
    setAlert(undefined);

    const outcome = await submit({ activityId: launch.id, participants: validation.participants });
    if (outcome.status !== 'failed') {
      return;
    }
    const feedback = bookingErrorFeedback(outcome.error);
    setFieldError(feedback.fieldError);
    setAlert(feedback.alert);
    if (feedback.availableSeats !== undefined) {
      setKnownAvailableSeats(feedback.availableSeats);
    }
  }

  return (
    <form className="booking-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
      <FormField
        label="Número de plazas"
        type="number"
        name="participants"
        inputMode="numeric"
        min={1}
        step={1}
        max={maxSeats}
        value={value}
        error={fieldError}
        onChange={(event) => setValue(event.target.value)}
      />
      <p aria-live="polite">{totalAmountText(launch.pricePerSeat, value)}</p>
      {alert !== undefined && <ErrorMessage message={alert} />}
      <button type="submit" disabled={submitting || noSeatsLeft}>
        {submitting ? 'Reservando…' : 'Reservar'}
      </button>
    </form>
  );
}
