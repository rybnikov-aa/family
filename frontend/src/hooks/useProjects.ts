import { useCallback } from 'react';
import { fetchProjects, type Project } from '../api/client';
import { useApiData } from './useApiData';

/** Результат запроса списка проектов: данные, ошибка и флаг загрузки. */
interface UseProjectsResult {
  projects: Project[];
  error: string | null;
  loading: boolean;
  /** Принудительно обновить список (обход 60-с кэша на бэкенде) */
  refresh: () => void;
}

export function useProjects(): UseProjectsResult {
  const { data, error, loading, reload } = useApiData<Project[]>(() => fetchProjects());

  const refresh = useCallback(() => {
    reload(() => fetchProjects(true));
  }, [reload]);

  return { projects: data ?? [], error, loading, refresh };
}
