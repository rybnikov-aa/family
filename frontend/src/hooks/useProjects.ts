import { fetchProjects, type Project } from '../api/client';
import { useApiData } from './useApiData';

/** Результат запроса списка проектов: данные, ошибка и флаг загрузки. */
interface UseProjectsResult {
  projects: Project[];
  error: string | null;
  loading: boolean;
}

export function useProjects(): UseProjectsResult {
  const { data, error, loading } = useApiData<Project[]>(() => fetchProjects());
  return { projects: data ?? [], error, loading };
}
