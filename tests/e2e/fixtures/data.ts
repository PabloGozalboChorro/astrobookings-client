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

export type ErrorResponseFixture = {
  message: string;
  errors: { field: string; message: string }[];
};

// Literal copy of activity-bookings-express/db/seed/activities.json (same order and fields).
export const launchDtos: readonly ActivityDtoFixture[] = [
  {
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
  },
  {
    id: 'activity-2',
    name: 'Starship · Órbita Marciana',
    slug: 'starship-orbita-marciana',
    price: 1249999,
    date: '2027-06-01T09:00:00.000Z',
    duration: 259200,
    location: 'Starbase, Texas (EE. UU.)',
    minParticipants: 4,
    maxParticipants: 12,
    status: 'confirmed',
    userId: 'user-1',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'activity-3',
    name: 'New Shepard · Vuelo Suborbital',
    slug: 'new-shepard-vuelo-suborbital',
    price: 12500,
    date: '2027-02-10T16:00:00.000Z',
    duration: 11,
    location: 'Launch Site One, Texas (EE. UU.)',
    minParticipants: 1,
    maxParticipants: 6,
    status: 'published',
    userId: 'user-1',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'activity-4',
    name: 'Soyuz · Estación Orbital',
    slug: 'soyuz-estacion-orbital',
    price: 389999,
    date: '2027-04-20T08:15:00.000Z',
    duration: 14400,
    location: 'Cosmódromo de Baikonur (Kazajistán)',
    minParticipants: 2,
    maxParticipants: 3,
    status: 'sold-out',
    userId: 'user-1',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'activity-5',
    name: 'Ariane 6 · Mirador Orbital',
    slug: 'ariane-6-mirador-orbital',
    price: 179999,
    date: '2027-09-12T21:45:00.000Z',
    duration: 1440,
    location: 'Puerto espacial de Kourou (Guayana Francesa)',
    minParticipants: 2,
    maxParticipants: 8,
    status: 'cancelled',
    userId: 'user-1',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'activity-6',
    name: 'Electron · Amanecer Orbital',
    slug: 'electron-amanecer-orbital',
    price: 89999,
    date: '2026-09-30T06:00:00.000Z',
    duration: 180,
    location: 'Península de Mahia (Nueva Zelanda)',
    minParticipants: 1,
    maxParticipants: 4,
    status: 'done',
    userId: 'user-1',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
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
    userId: 'user-1',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'activity-8',
    name: 'Paseo Lunar Express',
    slug: 'paseo-lunar-express',
    price: 499999,
    date: '2027-12-24T20:00:00.000Z',
    duration: 8640,
    location: 'Cabo Cañaveral, Florida (EE. UU.)',
    minParticipants: 2,
    maxParticipants: 10,
    status: 'published',
    userId: 'user-1',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'activity-9',
    name: 'Falcon Heavy · Ventana Perdida',
    slug: 'falcon-heavy-ventana-perdida',
    price: 299999,
    date: '2026-10-01T18:30:00.000Z',
    duration: 2880,
    location: 'Centro Espacial Kennedy, Florida (EE. UU.)',
    minParticipants: 2,
    maxParticipants: 8,
    status: 'published',
    userId: 'user-1',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
];

export const DRAFT_LAUNCH_ID = 'activity-7';

export function findLaunchDto(id: string): ActivityDtoFixture {
  const launch = launchDtos.find((dto) => dto.id === id);
  if (launch === undefined) {
    throw new Error(`Unknown launch fixture: ${id}`);
  }
  return launch;
}

export const draftLaunchDto = findLaunchDto(DRAFT_LAUNCH_ID);

export const visibleLaunchDtos = launchDtos.filter((dto) => dto.id !== DRAFT_LAUNCH_ID);

export const errorResponses = {
  failedToRetrieveActivities: { message: 'Failed to retrieve activities', errors: [] },
  failedToRetrieveActivity: { message: 'Failed to retrieve activity', errors: [] },
  activityNotFound: { message: 'Activity not found', errors: [] },
} satisfies Record<string, ErrorResponseFixture>;
