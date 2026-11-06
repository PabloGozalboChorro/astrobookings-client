import type { BookingWithActivityDto } from '../api/schemas';
import { parseLaunchDate, parseLaunchName, type Launch } from './launch';

export type PaymentStatus = 'pending' | 'paid' | 'refunded';

export type BookedLaunch = Pick<
  Launch,
  | 'id'
  | 'slug'
  | 'fullName'
  | 'mission'
  | 'rocket'
  | 'location'
  | 'date'
  | 'durationMinutes'
  | 'pricePerSeat'
  | 'status'
>;

export type Booking = {
  id: string;
  launchId: string;
  participants: number;
  createdAt: Date;
  paymentStatus: PaymentStatus;
  launch: BookedLaunch;
  totalAmount: number;
};

const PAYMENT_STATUS_LABELS: Readonly<Record<PaymentStatus, string>> = {
  pending: 'Pendiente de pago',
  paid: 'Pagada',
  refunded: 'Reembolsada',
};

export function totalAmount(pricePerSeat: number, participants: number): number {
  return Math.round(pricePerSeat * participants * 100) / 100;
}

export function toBooking(dto: BookingWithActivityDto): Booking {
  const { activity } = dto;
  const { rocket, mission } = parseLaunchName(activity.name);
  return {
    id: dto.id,
    launchId: dto.activityId,
    participants: dto.participants,
    createdAt: new Date(dto.createdAt),
    paymentStatus: dto.paymentStatus,
    totalAmount: totalAmount(activity.price, dto.participants),
    launch: {
      id: dto.activityId,
      slug: activity.slug,
      fullName: activity.name,
      mission,
      rocket,
      location: activity.location,
      date: parseLaunchDate(activity.date),
      durationMinutes: activity.duration,
      pricePerSeat: activity.price,
      status: activity.status,
    },
  };
}

// Array.prototype.sort is stable, so bookings created at the same time keep the API order.
export function sortByMostRecent(bookings: readonly Booking[]): Booking[] {
  return [...bookings].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return PAYMENT_STATUS_LABELS[status];
}
