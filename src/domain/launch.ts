import type { ActivityDto } from '../api/schemas';

export type LaunchStatus = 'published' | 'confirmed' | 'sold-out' | 'done' | 'cancelled' | 'draft';

export type Launch = {
  id: string;
  slug: string;
  fullName: string;
  mission: string;
  rocket: string | null;
  location: string;
  date: Date;
  durationMinutes: number;
  pricePerSeat: number;
  totalSeats: number;
  minParticipants: number;
  status: LaunchStatus;
};

export type LaunchName = {
  rocket: string | null;
  mission: string;
};

const NAME_SEPARATOR = ' · ';
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const STATUS_LABELS: Readonly<Record<LaunchStatus, string>> = {
  published: 'Abierto a reservas',
  confirmed: 'Confirmado',
  'sold-out': 'Agotado',
  done: 'Realizado',
  cancelled: 'Cancelado',
  draft: 'Borrador',
};

export function parseLaunchName(name: string): LaunchName {
  const separatorIndex = name.indexOf(NAME_SEPARATOR);
  if (separatorIndex === -1) {
    return { rocket: null, mission: name };
  }
  const rocket = name.slice(0, separatorIndex).trim();
  const mission = name.slice(separatorIndex + NAME_SEPARATOR.length).trim();
  if (rocket === '' || mission === '') {
    return { rocket: null, mission: name };
  }
  return { rocket, mission };
}

function parseLaunchDate(value: string): Date {
  const dateOnly = DATE_ONLY_PATTERN.exec(value);
  if (dateOnly === null) {
    return new Date(value);
  }
  const [, year, month, day] = dateOnly;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function toLaunch(dto: ActivityDto): Launch {
  const { rocket, mission } = parseLaunchName(dto.name);
  return {
    id: dto.id,
    slug: dto.slug,
    fullName: dto.name,
    mission,
    rocket,
    location: dto.location,
    date: parseLaunchDate(dto.date),
    durationMinutes: dto.duration,
    pricePerSeat: dto.price,
    totalSeats: dto.maxParticipants,
    minParticipants: dto.minParticipants,
    status: dto.status,
  };
}

export function isVisible(launch: Launch): boolean {
  return launch.status !== 'draft';
}

export function launchStatusLabel(status: LaunchStatus): string {
  return STATUS_LABELS[status];
}
