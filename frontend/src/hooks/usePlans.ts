import { useCallback } from 'react';
import { fetchPlans, type PlanTask } from '../api/client';
import { useApiData } from './useApiData';

interface UsePlansResult {
  tasks: PlanTask[];
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

export function usePlans(): UsePlansResult {
  const { data, error, loading, reload } = useApiData<PlanTask[]>(fetchPlans);
  const refresh = useCallback(() => reload(fetchPlans), [reload]);
  return { tasks: data ?? [], error, loading, refresh };
}
