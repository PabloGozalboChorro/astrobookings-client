import type { ActivityDtoFixture } from './data.ts';

// Faithful copy of how activity-bookings-express (master) answers GET /activities:
// - src/routes/activities.ts:115-126: only queries when q, slug or _sort is present
//   (otherwise returns the seed in insertion order); _order defaults to 'asc'.
// - src/services/activity.service.ts:98-160 (ActivityService.query): slug filter; q is
//   lower-cased and trimmed and matched with includes() on name, location and slug
//   (case-insensitive, accent-sensitive); _sort compares dates with getTime(), numbers
//   by subtraction and strings with localeCompare, nulls last; any _order other than
//   'desc' is ascending.
// Keep it aligned with the API: if the fork changes, update this file.

const DATE_FIELDS = new Set(['date', 'createdAt', 'updatedAt']);

function fieldValue(dto: ActivityDtoFixture, field: string): unknown {
  return new Map<string, unknown>(Object.entries(dto)).get(field);
}

function compareValues(field: string, aValue: unknown, bValue: unknown, order: number): number {
  if (aValue === undefined || aValue === null) {
    return bValue === undefined || bValue === null ? 0 : 1;
  }
  if (bValue === undefined || bValue === null) {
    return -1;
  }
  if (DATE_FIELDS.has(field)) {
    return (new Date(String(aValue)).getTime() - new Date(String(bValue)).getTime()) * order;
  }
  if (typeof aValue === 'number' && typeof bValue === 'number') {
    return (aValue - bValue) * order;
  }
  return String(aValue).localeCompare(String(bValue)) * order;
}

export function queryLaunchDtos(
  dtos: readonly ActivityDtoFixture[],
  url: URL,
): ActivityDtoFixture[] {
  const q = url.searchParams.get('q');
  const slug = url.searchParams.get('slug');
  const sortField = url.searchParams.get('_sort');
  let results = [...dtos];

  if (!q && !slug && !sortField) {
    return results;
  }

  if (slug) {
    results = results.filter((dto) => dto.slug === slug);
  }

  if (q && q.trim() !== '') {
    const searchTerm = q.toLowerCase().trim();
    results = results.filter(
      (dto) =>
        dto.name.toLowerCase().includes(searchTerm) ||
        dto.location.toLowerCase().includes(searchTerm) ||
        dto.slug.toLowerCase().includes(searchTerm),
    );
  }

  if (sortField) {
    const order = url.searchParams.get('_order') === 'desc' ? -1 : 1;
    results.sort((a, b) =>
      compareValues(sortField, fieldValue(a, sortField), fieldValue(b, sortField), order),
    );
  }

  return results;
}
