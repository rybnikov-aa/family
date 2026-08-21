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

/**
 * Загружает список событий (`GET /api/diary`). Бэкенд уже сортирует
 * по дате начала (свежие — раньше); здесь сортировка дублируется как
 * защитный контракт фронтенда — порядок гарантирован независимо от API.
 */
export function useDiaryEvents(): UseDiaryEventsResult {
  const { data, error, loading, reload } = useApiData<DiaryEventSummary[]>(() =>
    fetchDiaryEvents(),
  );
  const events = [...(data ?? [])].sort((a, b) =>
    a.dateStart < b.dateStart ? 1 : a.dateStart > b.dateStart ? -1 : b.id - a.id,
  );
  return { events, error, loading, refresh: reload };
}
