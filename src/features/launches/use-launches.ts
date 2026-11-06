import { useCallback } from 'react';
import { getActivities } from '../../api/activities';
import { isVisible, toLaunch, type Launch } from '../../domain/launch';
import { useAsyncData, type AsyncData } from '../../hooks/use-async-data';

export function useLaunches(): AsyncData<Launch[]> {
  const loader = useCallback(async (signal: AbortSignal) => {
    const activities = await getActivities(signal);
    return activities.map(toLaunch).filter(isVisible);
  }, []);
  return useAsyncData(loader);
}
