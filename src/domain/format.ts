const LOCALE = 'es-ES';
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

const priceFormatter = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'EUR' });

export function formatPrice(amount: number): string {
  return priceFormatter.format(amount);
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, { dateStyle: 'full', timeStyle: 'short' }).format(date);
}

export function formatDuration(minutes: number): string {
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes} min`;
  }
  if (minutes < MINUTES_PER_DAY) {
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const remainingMinutes = minutes % MINUTES_PER_HOUR;
    return remainingMinutes > 0 ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
  }
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const hours = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
  const dayText = days === 1 ? '1 día' : `${days} días`;
  return hours > 0 ? `${dayText} ${hours} h` : dayText;
}
