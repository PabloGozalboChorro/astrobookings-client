import { describe, expect, it } from 'vitest';
import {
  bookabilityReasonText,
  getBookability,
  isVisible,
  launchStatusLabel,
  parseLaunchName,
  type BookabilityReason,
  type LaunchStatus,
} from '../../../src/domain/launch';
import { launchFromDto, seedActivityDto } from '../support/activities';

describe('parseLaunchName', () => {
  it.each([
    ['Starship · Órbita Marciana', 'Starship', 'Órbita Marciana'],
    ['Falcon 9 · Misión · Luna', 'Falcon 9', 'Misión · Luna'],
    ['  Soyuz  ·  Estación Orbital ', 'Soyuz', 'Estación Orbital'],
    ['Falcon 9 ·  · Luna', 'Falcon 9', '· Luna'],
  ])('R3: splits "%s" into rocket and mission', (name, rocket, mission) => {
    expect(parseLaunchName(name)).toEqual({ rocket, mission });
  });

  it.each([
    'Paseo Lunar Express',
    'Falcon 9 · ',
    ' · Misión Luna',
    'Falcon 9·Luna',
    'Falcon 9 ·Luna',
    ' · ',
  ])(
    'R4: keeps the full name as mission when "%s" cannot be split',
    (name) => {
      expect(parseLaunchName(name)).toEqual({ rocket: null, mission: name });
    },
  );
});

describe('toLaunch', () => {
  it('R2: toLaunch maps the DTO fields to the domain model', () => {
    expect(launchFromDto()).toEqual({
      id: 'activity-1',
      slug: 'falcon-9-mision-luna',
      fullName: 'Falcon 9 · Misión Luna',
      mission: 'Misión Luna',
      rocket: 'Falcon 9',
      location: 'Cabo Cañaveral, Florida (EE. UU.)',
      date: new Date('2027-03-15T14:30:00.000Z'),
      durationMinutes: 4320,
      pricePerSeat: 249999,
      totalSeats: 6,
      minParticipants: 2,
      status: 'published',
    });
  });

  it('R5: toLaunch reads a date without time as local midnight', () => {
    const previousTimeZone = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      const { date } = launchFromDto({ date: '2027-10-26' });

      expect(date.getFullYear()).toBe(2027);
      expect(date.getMonth()).toBe(9);
      expect(date.getDate()).toBe(26);
      expect(date.getHours()).toBe(0);
      expect(date.getMinutes()).toBe(0);
    } finally {
      process.env.TZ = previousTimeZone;
    }
  });
});

describe('isVisible', () => {
  it.each<[boolean, LaunchStatus]>([
    [false, 'draft'],
    [true, 'published'],
    [true, 'confirmed'],
    [true, 'sold-out'],
    [true, 'done'],
    [true, 'cancelled'],
  ])('R1: isVisible is %s for status %s', (visible, status) => {
    expect(isVisible(launchFromDto({ status }))).toBe(visible);
  });
});

describe('launchStatusLabel', () => {
  it.each<[LaunchStatus, string]>([
    ['published', 'Abierto a reservas'],
    ['confirmed', 'Confirmado'],
    ['sold-out', 'Agotado'],
    ['done', 'Realizado'],
    ['cancelled', 'Cancelado'],
    ['draft', 'Borrador'],
  ])('R2: labels status %s as "%s"', (status, label) => {
    expect(launchStatusLabel(status)).toBe(label);
  });
});

describe('getBookability', () => {
  const NOW = new Date('2026-11-05T10:00:00.000Z');

  function seedLaunch(id: string) {
    return launchFromDto(seedActivityDto(id));
  }

  it.each(['activity-1', 'activity-2'])('R6: %s is bookable', (id) => {
    expect(getBookability(seedLaunch(id), NOW)).toEqual({ bookable: true });
  });

  it.each<[string, BookabilityReason]>([
    ['activity-9', 'past-date'],
    ['activity-4', 'sold-out'],
    ['activity-5', 'cancelled'],
    ['activity-6', 'done'],
    ['activity-7', 'draft'],
  ])('R6: %s is not bookable because of %s', (id, reason) => {
    expect(getBookability(seedLaunch(id), NOW)).toEqual({ bookable: false, reason });
  });

  it.each<LaunchStatus>(['published', 'confirmed'])(
    'R6: a %s launch dated exactly now is not bookable (past-date)',
    (status) => {
      const launch = launchFromDto({ status, date: NOW.toISOString() });

      expect(getBookability(launch, NOW)).toEqual({ bookable: false, reason: 'past-date' });
    },
  );

  it.each<LaunchStatus>(['published', 'confirmed'])(
    'R6: a %s launch 1 ms after now is bookable',
    (status) => {
      const launch = launchFromDto({ status, date: new Date(NOW.getTime() + 1).toISOString() });

      expect(getBookability(launch, NOW)).toEqual({ bookable: true });
    },
  );

  it.each<[LaunchStatus, BookabilityReason]>([
    ['draft', 'draft'],
    ['cancelled', 'cancelled'],
    ['done', 'done'],
    ['sold-out', 'sold-out'],
  ])('R6: reason priority %s with a past date gives %s', (status, reason) => {
    const launch = launchFromDto({ status, date: '2026-01-01T00:00:00.000Z' });

    expect(getBookability(launch, NOW)).toEqual({ bookable: false, reason });
  });
});

describe('bookabilityReasonText', () => {
  it.each<[BookabilityReason, string]>([
    ['sold-out', 'Agotado: no quedan plazas'],
    ['done', 'Este lanzamiento ya se ha realizado'],
    ['cancelled', 'Este lanzamiento se ha cancelado'],
    ['past-date', 'La fecha de este lanzamiento ya ha pasado'],
    ['draft', 'No disponible'],
  ])('R7: bookabilityReasonText(%s) is "%s"', (reason, text) => {
    expect(bookabilityReasonText(reason)).toBe(text);
  });
});
