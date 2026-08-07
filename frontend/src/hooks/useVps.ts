import { useCallback } from 'react';
import { fetchVps, type VpsStatus } from '../api/client';
import { useApiData } from './useApiData';

/** Результат запроса статусов VPS: список, ошибка, загрузка и перезагрузка. */
interface UseVpsResult {
  statuses: VpsStatus[];
  error: string | null;
  loading: boolean;
  /** Принудительно перепроверить статусы (с обходом кэша на бэкенде) */
  refresh: () => void;
}

export function useVps(): UseVpsResult {
  const { data, error, loading, reload } = useApiData<VpsStatus[]>(() => fetchVps());

  const refresh = useCallback(() => {
    reload(() => fetchVps(true));
  }, [reload]);

  return { statuses: data ?? [], error, loading, refresh };
}
