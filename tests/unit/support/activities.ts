import { activityDtoSchema } from '../../../src/api/schemas';
import { toLaunch, type Launch } from '../../../src/domain/launch';

export type ActivityDtoFixture = {
  id: string;
  name: string;
  slug: string;
  price: number;
  date: string;
  duration: number;
  location: string;
  minParticipants: number;
  maxParticipants: number;
  status: string;
  userId: string;
  createdAt: string;
  updatedAt?: string;
};

export function activityDto(overrides: Partial<ActivityDtoFixture> = {}): ActivityDtoFixture {
  return {
    id: 'activity-1',
    name: 'Falcon 9 · Misión Luna',
    slug: 'falcon-9-mision-luna',
    price: 249999,
    date: '2027-03-15T14:30:00.000Z',
    duration: 4320,
    location: 'Cabo Cañaveral, Florida (EE. UU.)',
    minParticipants: 2,
    maxParticipants: 6,
    status: 'published',
    userId: 'user-1',
    createdAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  };
}

export const draftActivityDto = activityDto({
  id: 'activity-7',
  name: 'Vega · Prueba de Sistemas',
  slug: 'vega-prueba-de-sistemas',
  price: 99999,
  date: '2027-11-01T12:00:00.000Z',
  duration: 90,
  location: 'Puerto espacial de Kourou (Guayana Francesa)',
  minParticipants: 1,
  maxParticipants: 5,
  status: 'draft',
});

export function launchFromDto(overrides: Partial<ActivityDtoFixture> = {}): Launch {
  return toLaunch(activityDtoSchema.parse(activityDto(overrides)));
}
