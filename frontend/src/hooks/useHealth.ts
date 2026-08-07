import { fetchHealth, type HealthResponse } from '../api/client';
import { useApiData } from './useApiData';

interface UseHealthResult {
  data: HealthResponse | null;
  error: string | null;
  loading: boolean;
}

export function useHealth(): UseHealthResult {
  return useApiData<HealthResponse>(() => fetchHealth());
}
