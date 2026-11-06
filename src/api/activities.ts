import { z } from 'zod';
import { http } from './http';
import { activityDtoSchema, type ActivityDto } from './schemas';

const activityListSchema = z.array(activityDtoSchema);

export function getActivities(signal?: AbortSignal): Promise<ActivityDto[]> {
  return http('/activities', activityListSchema, { signal });
}
