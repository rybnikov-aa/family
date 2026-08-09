import { fetchRenovationOverview, type RenovationOverview } from '../api/client';
import { useApiData } from './useApiData';

/** Результат запроса сводки «Ремонта»: данные, ошибка, загрузка и перезагрузка. */
interface UseRenovationOverviewResult {
  overview: RenovationOverview | null;
  error: string | null;
  loading: boolean;
  /** Повторно загрузить сводку (после импорта/изменений). */
  reload: () => void;
}

/** Сводка проекта «Ремонт» (`GET /api/renovation`). */
export function useRenovationOverview(): UseRenovationOverviewResult {
  const { data, error, loading, reload } = useApiData<RenovationOverview>(() =>
    fetchRenovationOverview(),
  );
  return { overview: data, error, loading, reload };
}
