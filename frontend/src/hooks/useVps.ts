import { useCallback, useEffect, useState } from 'react';
import { fetchVps, type VpsStatus } from '../api/client';

/** Результат запроса статусов VPS: список, ошибка, загрузка и перезагрузка. */
interface UseVpsResult {
  statuses: VpsStatus[];
  error: string | null;
  loading: boolean;
  /** Принудительно перепроверить статусы (с обходом кэша на бэкенде) */
  refresh: () => void;
}

export function useVps(): UseVpsResult {
  const [statuses, setStatuses] = useState<VpsStatus[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchVps()
      .then((result) => {
        if (active) setStatuses(result);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchVps(true)
      .then((result) => setStatuses(result))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unknown error'))
      .finally(() => setLoading(false));
  }, []);

  return { statuses, error, loading, refresh };
}
