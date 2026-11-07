import { describe, expect, it } from 'vitest';
import {
  filterBookingsByLaunch,
  launchFilterOptions,
  selectedLaunchId,
  withLaunchFilter,
} from '../../../../src/features/bookings/booking-filter';
import { bookingFromDto } from '../../support/bookings';

const firstLunarBooking = bookingFromDto();
const secondLunarBooking = bookingFromDto({
  id: 'booking-5',
  participants: 1,
  createdAt: '2026-11-05T12:00:00.000Z',
});
const suborbitalBooking = bookingFromDto({
  id: 'booking-2',
  activityId: 'activity-3',
  participants: 3,
  createdAt: '2026-11-04T18:00:00.000Z',
});

const threeBookings = [secondLunarBooking, suborbitalBooking, firstLunarBooking];

describe('launchFilterOptions', () => {
  it('R1: builds one option per distinct launch, sorted alphabetically', () => {
    const expected = [
      { launchId: 'activity-1', label: 'Falcon 9 · Misión Luna' },
      { launchId: 'activity-3', label: 'New Shepard · Vuelo Suborbital' },
    ];

    expect(launchFilterOptions(threeBookings)).toEqual(expected);
    expect(launchFilterOptions([suborbitalBooking, firstLunarBooking])).toEqual(expected);
  });

  it('R1: sorts ignoring case and uses the full name without separator', () => {
    const lowerCaseExpress = bookingFromDto({
      id: 'booking-10',
      activityId: 'activity-9',
      activity: { name: 'paseo Lunar Express' },
    });
    const ariane = bookingFromDto({ id: 'booking-11', activityId: 'activity-5' });
    const express = bookingFromDto({ id: 'booking-12', activityId: 'activity-8' });

    expect(launchFilterOptions([lowerCaseExpress, express, ariane])).toEqual([
      { launchId: 'activity-5', label: 'Ariane 6 · Mirador Orbital' },
      { launchId: 'activity-8', label: 'Paseo Lunar Express' },
      { launchId: 'activity-9', label: 'paseo Lunar Express' },
    ]);
    expect(launchFilterOptions([express])).toEqual([
      { launchId: 'activity-8', label: 'Paseo Lunar Express' },
    ]);
  });
});

describe('selectedLaunchId', () => {
  const options = launchFilterOptions(threeBookings);

  it.each([
    ['lanzamiento=activity-3', 'activity-3'],
    ['', null],
    ['lanzamiento=', null],
    ['lanzamiento=activity-99', null],
    ['lanzamiento=ACTIVITY-1', null],
  ])('R4/R5: selectedLaunchId(%s) is %s', (search, expected) => {
    expect(selectedLaunchId(new URLSearchParams(search), options)).toBe(expected);
  });
});

describe('withLaunchFilter', () => {
  it('R2: sets lanzamiento with the launch id', () => {
    expect(withLaunchFilter(new URLSearchParams(''), 'activity-1').toString()).toBe(
      'lanzamiento=activity-1',
    );
  });

  it('R3: removes lanzamiento for all launches', () => {
    expect(withLaunchFilter(new URLSearchParams('lanzamiento=activity-1'), null).toString()).toBe(
      '',
    );
  });

  it('R2/R3: keeps other parameters and does not change the input', () => {
    const current = new URLSearchParams('otro=1&lanzamiento=activity-1');

    expect(withLaunchFilter(current, 'activity-3').toString()).toBe(
      'otro=1&lanzamiento=activity-3',
    );
    expect(withLaunchFilter(current, null).toString()).toBe('otro=1');
    expect(current.toString()).toBe('otro=1&lanzamiento=activity-1');
  });
});

describe('filterBookingsByLaunch', () => {
  it('R2: keeps only the bookings of the launch in the same order', () => {
    expect(filterBookingsByLaunch(threeBookings, 'activity-1')).toEqual([
      secondLunarBooking,
      firstLunarBooking,
    ]);
  });

  it('R3: returns every booking without a launch', () => {
    expect(filterBookingsByLaunch(threeBookings, null)).toEqual(threeBookings);
  });
});

describe('booking filter edge cases (tester)', () => {
  function bookingNamed(id: string, activityId: string, name: string) {
    return bookingFromDto({ id, activityId, activity: { name } });
  }

  it('R1: sorts with accents and case as in Spanish, not by code point', () => {
    const options = launchFilterOptions([
      bookingNamed('booking-20', 'activity-1', 'Zeta · Final'),
      bookingNamed('booking-21', 'activity-2', 'Órbita Alta'),
      bookingNamed('booking-22', 'activity-3', 'ariane · Prueba'),
      bookingNamed('booking-23', 'activity-4', 'Orión · Ventana'),
      bookingNamed('booking-24', 'activity-5', 'Ñandú · Vuelo'),
      bookingNamed('booking-25', 'activity-6', 'Nube · Baja'),
    ]);

    expect(options.map((option) => option.label)).toEqual([
      'ariane · Prueba',
      'Nube · Baja',
      'Ñandú · Vuelo',
      'Órbita Alta',
      'Orión · Ventana',
      'Zeta · Final',
    ]);
  });

  it('R1: keeps launches with the same name and different ids, tied by id', () => {
    const forward = launchFilterOptions([
      bookingNamed('booking-30', 'activity-2', 'Falcon 9 · Misión Luna'),
      bookingNamed('booking-31', 'activity-1', 'Falcon 9 · Misión Luna'),
      bookingNamed('booking-32', 'activity-3', 'FALCON 9 · MISIÓN LUNA'),
    ]);
    const backward = launchFilterOptions([
      bookingNamed('booking-32', 'activity-3', 'FALCON 9 · MISIÓN LUNA'),
      bookingNamed('booking-31', 'activity-1', 'Falcon 9 · Misión Luna'),
      bookingNamed('booking-30', 'activity-2', 'Falcon 9 · Misión Luna'),
    ]);

    expect(forward.map((option) => option.launchId)).toEqual([
      'activity-1',
      'activity-2',
      'activity-3',
    ]);
    expect(backward).toEqual(forward);
  });

  it('R1: returns no options without bookings', () => {
    expect(launchFilterOptions([])).toEqual([]);
  });

  it('R1: takes the label of the first booking of each launch', () => {
    expect(
      launchFilterOptions([
        bookingNamed('booking-40', 'activity-1', 'Falcon 9 · Misión Luna'),
        bookingNamed('booking-41', 'activity-1', 'Otro nombre'),
      ]),
    ).toEqual([{ launchId: 'activity-1', label: 'Falcon 9 · Misión Luna' }]);
  });

  it('R4/R5: uses the first value of a repeated lanzamiento', () => {
    const options = launchFilterOptions(threeBookings);

    expect(
      selectedLaunchId(
        new URLSearchParams('lanzamiento=activity-3&lanzamiento=activity-1'),
        options,
      ),
    ).toBe('activity-3');
    expect(
      selectedLaunchId(
        new URLSearchParams('lanzamiento=activity-99&lanzamiento=activity-1'),
        options,
      ),
    ).toBeNull();
  });

  it('R5: no launch is selected without options', () => {
    expect(selectedLaunchId(new URLSearchParams('lanzamiento=activity-1'), [])).toBeNull();
  });

  it('R2/R3: replaces every repeated lanzamiento when writing', () => {
    const repeated = new URLSearchParams('lanzamiento=activity-3&lanzamiento=activity-1');

    expect(withLaunchFilter(repeated, 'activity-1').toString()).toBe('lanzamiento=activity-1');
    expect(withLaunchFilter(repeated, null).toString()).toBe('');
  });

  it('R2: returns an empty list for a launch without bookings and a copy for all', () => {
    expect(filterBookingsByLaunch(threeBookings, 'activity-99')).toEqual([]);
    const all = filterBookingsByLaunch(threeBookings, null);
    expect(all).not.toBe(threeBookings);
  });
});
