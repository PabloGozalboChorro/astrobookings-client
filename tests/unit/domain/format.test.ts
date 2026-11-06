import { describe, expect, it } from 'vitest';
import {
  formatDateTime,
  formatDuration,
  formatPrice,
  formatTotalSeats,
} from '../../../src/domain/format';

function normalizeSpaces(text: string): string {
  return text.replace(/\u00a0|\u202f/g, ' ');
}

describe('formatPrice', () => {
  it.each([
    [249999, '249.999,00 €'],
    [12500, '12.500,00 €'],
    [1249999, '1.249.999,00 €'],
    [2500, '2500,00 €'],
    [99.5, '99,50 €'],
    [0, '0,00 €'],
    [1234.567, '1234,57 €'],
  ])('R5: formats price %d as "%s"', (amount, expected) => {
    expect(normalizeSpaces(formatPrice(amount))).toBe(expected);
  });
});

describe('formatDateTime', () => {
  it.each([
    ['2027-03-15T14:30:00.000Z', 'lunes, 15 de marzo de 2027, 14:30'],
    ['2027-06-01T09:00:00.000Z', 'martes, 1 de junio de 2027, 9:00'],
  ])('R5: formats %s as "%s"', (isoDate, expected) => {
    expect(normalizeSpaces(formatDateTime(new Date(isoDate)))).toBe(expected);
  });
});

describe('formatDuration', () => {
  it.each([
    [11, '11 min'],
    [90, '1 h 30 min'],
    [180, '3 h'],
    [1440, '1 día'],
    [1501, '1 día 1 h'],
    [2880, '2 días'],
    [259200, '180 días'],
    [0, '0 min'],
    [59, '59 min'],
    [60, '1 h'],
    [1439, '23 h 59 min'],
    [4320, '3 días'],
  ])('R6: formats %i minutes as "%s"', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe('formatTotalSeats', () => {
  it.each([
    [1, '1 plaza en total'],
    [6, '6 plazas en total'],
  ])('R2: formatTotalSeats(%i) is "%s"', (seats, expected) => {
    expect(formatTotalSeats(seats)).toBe(expected);
  });
});
