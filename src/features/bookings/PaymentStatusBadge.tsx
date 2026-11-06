import { paymentStatusLabel, type PaymentStatus } from '../../domain/booking';

type PaymentStatusBadgeProps = {
  status: PaymentStatus;
};

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  return (
    <span className={`payment-status payment-status--${status}`}>
      {paymentStatusLabel(status)}
    </span>
  );
}
