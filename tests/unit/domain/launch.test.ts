import { describe, expect, it } from 'vitest';
import {
  isVisible,
  launchStatusLabel,
  parseLaunchName,
  type LaunchStatus,
} from '../../../src/domain/launch';
import { launchFromDto } from '../support/activities';

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
