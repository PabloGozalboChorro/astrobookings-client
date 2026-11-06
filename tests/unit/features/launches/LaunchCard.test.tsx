import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { LaunchStatus } from '../../../../src/domain/launch';
import { LaunchCard } from '../../../../src/features/launches/LaunchCard';
import { launchFromDto, type ActivityDtoFixture } from '../../support/activities';

function renderCard(overrides: Partial<ActivityDtoFixture> = {}) {
  render(
    <MemoryRouter>
      <LaunchCard launch={launchFromDto(overrides)} />
    </MemoryRouter>,
  );
}

describe('LaunchCard', () => {
  it('R2: shows every launch field', () => {
    renderCard();

    const card = screen.getByRole('article', { name: 'Misión Luna' });
    expect(within(card).getByRole('heading', { name: 'Misión Luna' })).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Misión Luna' })).toHaveAttribute(
      'href',
      '/lanzamientos/activity-1',
    );
    expect(card).toHaveTextContent('Cohete: Falcon 9');
    expect(card).toHaveTextContent('Cabo Cañaveral, Florida (EE. UU.)');
    expect(card).toHaveTextContent('lunes, 15 de marzo de 2027, 14:30');
    expect(card).toHaveTextContent('3 días');
    expect(card).toHaveTextContent('249.999,00 € por plaza');
    expect(card).toHaveTextContent('6 plazas en total');
    expect(card).toHaveTextContent('Abierto a reservas');
  });

  it('R2: exposes the launch date as a machine-readable time', () => {
    renderCard();

    expect(screen.getByText('lunes, 15 de marzo de 2027, 14:30')).toHaveAttribute(
      'datetime',
      '2027-03-15T14:30:00.000Z',
    );
  });

  it('R2: encodes the launch id in the title link', () => {
    renderCard({ id: 'activity 10/x' });

    expect(screen.getByRole('link', { name: 'Misión Luna' })).toHaveAttribute(
      'href',
      '/lanzamientos/activity%2010%2Fx',
    );
  });

  it('R2: uses the singular when the launch has a single seat', () => {
    renderCard({ maxParticipants: 1 });

    expect(screen.getByRole('article')).toHaveTextContent('1 plaza en total');
    expect(screen.getByRole('article')).not.toHaveTextContent('plazas en total');
  });

  it('R4: hides the rocket line when the name has no separator', () => {
    renderCard({ id: 'activity-8', name: 'Paseo Lunar Express' });

    const card = screen.getByRole('article', { name: 'Paseo Lunar Express' });
    expect(within(card).getByRole('link', { name: 'Paseo Lunar Express' })).toBeInTheDocument();
    expect(card).not.toHaveTextContent('Cohete:');
  });

  it('R4: shows the full name and no rocket line when the mission is empty', () => {
    renderCard({ name: 'Falcon 9 · ' });

    expect(screen.getByRole('heading', { name: 'Falcon 9 ·' })).toBeInTheDocument();
    expect(screen.getByRole('article')).not.toHaveTextContent('Cohete:');
  });

  it.each<[LaunchStatus, string]>([
    ['published', 'Abierto a reservas'],
    ['confirmed', 'Confirmado'],
    ['sold-out', 'Agotado'],
    ['done', 'Realizado'],
    ['cancelled', 'Cancelado'],
  ])('R2: shows the status %s as "%s"', (status, label) => {
    renderCard({ status });

    expect(screen.getByRole('article')).toHaveTextContent(label);
  });

  it('R2: shows a past launch with its status text', () => {
    renderCard({ date: '2026-09-30T06:00:00.000Z', status: 'done' });

    const card = screen.getByRole('article');
    expect(card).toHaveTextContent('miércoles, 30 de septiembre de 2026, 6:00');
    expect(card).toHaveTextContent('Realizado');
  });

  it('R5: shows a date without time at 0:00 of the browser time zone', () => {
    renderCard({ date: '2027-10-26' });

    expect(screen.getByRole('article')).toHaveTextContent('martes, 26 de octubre de 2027, 0:00');
  });

  it.each([
    [0, '0,00 € por plaza'],
    [2500, '2500,00 € por plaza'],
    [99.5, '99,50 € por plaza'],
  ])('R5: shows the price %d as "%s"', (price, expected) => {
    renderCard({ price });

    expect(screen.getByRole('article')).toHaveTextContent(expected);
  });

  it('R3: splits only on the first separator in the card', () => {
    renderCard({ name: 'Falcon 9 · Misión · Luna' });

    expect(screen.getByRole('heading', { name: 'Misión · Luna' })).toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveTextContent('Cohete: Falcon 9');
  });
});
