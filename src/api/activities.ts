import { z } from 'zod';
import { http } from './http';
import { activityDtoSchema, type ActivityDto } from './schemas';

export type ActivitySort = 'name' | 'date' | 'price';

export type SortOrder = 'asc' | 'desc';

export type ActivitiesQuery = { q?: string; sort?: ActivitySort; order?: SortOrder };

const activityListSchema = z.array(activityDtoSchema);

function toActivitiesPath({ q, sort, order }: ActivitiesQuery): string {
  const searchParams = new URLSearchParams();
  if (q !== undefined && q !== '') {
    searchParams.set('q', q);
  }
  if (sort !== undefined) {
    searchParams.set('_sort', sort);
  }
  if (order !== undefined) {
    searchParams.set('_order', order);
  }
  const search = searchParams.toString();
  return search === '' ? '/activities' : `/activities?${search}`;
}

export function getActivities(
  query: ActivitiesQuery = {},
  signal?: AbortSignal,
): Promise<ActivityDto[]> {
  return http(toActivitiesPath(query), activityListSchema, { signal });
}

export function getActivity(id: string, signal?: AbortSignal): Promise<ActivityDto> {
  return http(`/activities/${encodeURIComponent(id)}`, activityDtoSchema, { signal });
}
