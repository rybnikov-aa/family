import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Универсальный хук загрузки данных с одного API-эндпоинта.
 *
 * Заменяет повторяющийся паттерн fetch-on-mount (data/error/loading + защита от
 * setState после размонтирования), ранее продублированный в `useVps`/`useProjects`/`useHealth`.
 *
 * `reload(next?)` повторяет загрузку; опциональный `next` подменяет fetcher —
 * например для принудительного `?refresh=1` в `useVps`.
 */
export function useApiData<T>(fetcher: () => Promise<T>) {
  // Актуальный fetcher храним в ref — хук не перезапускает загрузку на каждый рендер.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  // Защита от setState после размонтирования.
  const mountedRef = useRef(true);

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback((next?: () => Promise<T>) => {
    const fn = next ?? fetcherRef.current;
    setLoading(true);
    setError(null);
    fn()
      .then((result) => {
        if (mountedRef.current) setData(result);
      })
      .catch((err: unknown) => {
        if (mountedRef.current) setError(err instanceof Error ? err.message : 'Unknown error');
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, []);

  // Первичная загрузка при монтировании.
  useEffect(() => {
    run();
  }, [run]);

  return { data, error, loading, reload: run };
}
