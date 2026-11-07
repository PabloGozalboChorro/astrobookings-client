import { describe, expect, it } from 'vitest';
import { totalAmount } from '../../../../src/domain/booking';
import { formatPrice } from '../../../../src/domain/format';
import {
  parseParticipants,
  validateParticipants,
} from '../../../../src/features/bookings/booking-form';

const INVALID_TEXT = 'Introduce un número entero de plazas mayor o igual que 1.';

const NO_BREAK_SPACE = String.fromCharCode(0xa0);
const NARROW_NO_BREAK_SPACE = String.fromCharCode(0x202f);

function normalizeSpaces(text: string): string {
  return text.replaceAll(NO_BREAK_SPACE, ' ').replaceAll(NARROW_NO_BREAK_SPACE, ' ');
}

describe('parseParticipants edge cases', () => {
  it.each<[string, number | null]>([
    ['007', 7],
    ['01', 1],
    ['\t2\n', 2],
    ['  6  ', 6],
    ['-0', null],
    ['00', null],
    ['-6', null],
    ['0.5', null],
    ['2.5', null],
    ['1,5', null],
    ['2 3', null],
    ['2a', null],
    ['NaN', null],
    ['Infinity', null],
    ['9007199254740993', null],
  ])('R3, R4: parseParticipants(%j) is %s', (raw, expected) => {
    expect(parseParticipants(raw)).toBe(expected);
  });
});

describe('validateParticipants edge cases', () => {
  it('R5: accepts exactly the known available seats', () => {
    expect(validateParticipants('2', 2)).toEqual({ ok: true, participants: 2 });
  });

  it('R5: rejects one more than the known available seats', () => {
    expect(validateParticipants('3', 2)).toEqual({
      ok: false,
      error: 'Puedes reservar como máximo 2 plazas.',
    });
  });

  it('R4: reports the integer error before the max error', () => {
    expect(validateParticipants('0', 0)).toEqual({ ok: false, error: INVALID_TEXT });
  });

  it('R5: rejects any number with max 0', () => {
    expect(validateParticipants('1', 0)).toEqual({
      ok: false,
      error: 'Puedes reservar como máximo 0 plazas.',
    });
  });

  it('R4, R5: accepts leading zeros and whitespace within the max', () => {
    expect(validateParticipants(' 06 ', 6)).toEqual({ ok: true, participants: 6 });
  });
});

describe('total amount rounding', () => {
  it.each<[number, number, string]>([
    [0.1, 3, '0,30 €'],
    [19.99, 3, '59,97 €'],
    [12500, 2, '25.000,00 €'],
    [249999, 6, '1.499.994,00 €'],
  ])('R3: %s × %s is %s', (price, participants, expected) => {
    expect(normalizeSpaces(formatPrice(totalAmount(price, participants)))).toBe(expected);
  });
});
