import { useEffect, useState } from 'react';
import { fetchVps, type VpsStatus } from '../api/client';

/** Результат запроса статусов VPS: список, ошибка и признак загрузки. */
interface UseVpsResult {
  statuses: VpsStatus[];
  error: string | null;
  loading: boolean;
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

  return { statuses, error, loading };
}
