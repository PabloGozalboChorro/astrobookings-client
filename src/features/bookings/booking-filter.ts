import type { Booking } from '../../domain/booking';

const LAUNCH_FILTER_PARAM = 'lanzamiento';

export type LaunchFilterOption = {
  launchId: string;
  label: string;
};

function compareOptions(a: LaunchFilterOption, b: LaunchFilterOption): number {
  const byLabel = a.label.localeCompare(b.label, 'es', { sensitivity: 'base' });
  if (byLabel !== 0) {
    return byLabel;
  }
  if (a.launchId === b.launchId) {
    return 0;
  }
  return a.launchId < b.launchId ? -1 : 1;
}

export function launchFilterOptions(bookings: readonly Booking[]): LaunchFilterOption[] {
  const labelsByLaunchId = new Map<string, string>();
  for (const booking of bookings) {
    if (!labelsByLaunchId.has(booking.launchId)) {
      labelsByLaunchId.set(booking.launchId, booking.launch.fullName);
    }
  }
  return Array.from(labelsByLaunchId, ([launchId, label]) => ({ launchId, label })).sort(
    compareOptions,
  );
}

export function selectedLaunchId(
  searchParams: URLSearchParams,
  options: readonly LaunchFilterOption[],
): string | null {
  const launchId = searchParams.get(LAUNCH_FILTER_PARAM);
  return options.some((option) => option.launchId === launchId) ? launchId : null;
}

export function withLaunchFilter(
  searchParams: URLSearchParams,
  launchId: string | null,
): URLSearchParams {
  const next = new URLSearchParams(searchParams);
  if (launchId === null) {
    next.delete(LAUNCH_FILTER_PARAM);
  } else {
    next.set(LAUNCH_FILTER_PARAM, launchId);
  }
  return next;
}

export function filterBookingsByLaunch(
  bookings: readonly Booking[],
  launchId: string | null,
): Booking[] {
  if (launchId === null) {
    return [...bookings];
  }
  return bookings.filter((booking) => booking.launchId === launchId);
}
