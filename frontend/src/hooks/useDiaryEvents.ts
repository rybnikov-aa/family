import { fetchDiaryEvents, type DiaryEventSummary } from '../api/client';
import { useApiData } from './useApiData';

/** Результат запроса списка событий «Дневника». */
interface UseDiaryEventsResult {
  events: DiaryEventSummary[];
  error: string | null;
  loading: boolean;
  /** Повторно загрузить список (после создания/изменения/удаления). */
  refresh: () => void;
}

/** Загружает список событий (`GET /api/diary`). */
export function useDiaryEvents(): UseDiaryEventsResult {
  const { data, error, loading, reload } = useApiData<DiaryEventSummary[]>(() =>
    fetchDiaryEvents(),
  );
  return { events: data ?? [], error, loading, refresh: reload };
}
