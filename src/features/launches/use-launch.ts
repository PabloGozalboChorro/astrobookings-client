import { useCallback } from 'react';
import { getActivity } from '../../api/activities';
import { toLaunch, type Launch } from '../../domain/launch';
import { useAsyncData, type AsyncData } from '../../hooks/use-async-data';

export function useLaunch(id: string): AsyncData<Launch> {
  const loader = useCallback(
    async (signal: AbortSignal) => toLaunch(await getActivity(id, signal)),
    [id],
  );
  return useAsyncData(loader);
}
