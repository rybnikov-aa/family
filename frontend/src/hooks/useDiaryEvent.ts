import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchDiaryEvent, type DiaryEventDetail } from '../api/client';

/** Результат запроса одного события «Дневника». */
interface UseDiaryEventResult {
  event: DiaryEventDetail | null;
  error: string | null;
  loading: boolean;
  /** Повторно загрузить событие (после редактирования). */
  reload: () => void;
}

/**
 * Загружает полные данные события (`GET /api/diary/:id`).
 * Перезагружается при смене `id` (навигация между событиями без
 * размонтирования страницы) и по `reload`.
 */
export function useDiaryEvent(id: number | null): UseDiaryEventResult {
  const [event, setEvent] = useState<DiaryEventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const mountedRef = useRef(true);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (id === null) {
      setEvent(null);
      setError('Событие не найдено');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDiaryEvent(id)
      .then((result) => {
        if (!cancelled) setEvent(result);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Не удалось загрузить событие');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, version]);

  return { event, error, loading, reload };
}
