import { useCallback } from 'react';
import { getActivities, type ActivitiesQuery } from '../../api/activities';
import { isVisible, toLaunch, type Launch } from '../../domain/launch';
import { useAsyncData, type AsyncData } from '../../hooks/use-async-data';

export function useLaunches({ q, sort, order }: ActivitiesQuery): AsyncData<Launch[]> {
  const loader = useCallback(
    async (signal: AbortSignal) => {
      const activities = await getActivities({ q, sort, order }, signal);
      return activities.map(toLaunch).filter(isVisible);
    },
    [q, sort, order],
  );
  return useAsyncData(loader);
}
