import { fetchProject, type ProjectDetail } from '../api/client';
import { useApiData } from './useApiData';

/** Результат запроса одного проекта: данные, ошибка и флаг загрузки. */
interface UseProjectResult {
  project: ProjectDetail | null;
  error: string | null;
  loading: boolean;
  /** Повторно загрузить проект после редактирования. */
  reload: () => void;
}

/** Загружает полные данные проекта (`GET /api/projects/:slug`). */
export function useProject(slug: string): UseProjectResult {
  const { data, error, loading, reload } = useApiData<ProjectDetail>(() => fetchProject(slug));
  return { project: data ?? null, error, loading, reload };
}
