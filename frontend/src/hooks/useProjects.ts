import { useEffect, useState } from 'react';
import { fetchProjects, type Project } from '../api/client';

/** Результат запроса списка проектов: данные, ошибка и флаг загрузки. */
interface UseProjectsResult {
  projects: Project[];
  error: string | null;
  loading: boolean;
}

export function useProjects(): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    fetchProjects()
      .then((result) => {
        if (active) setProjects(result);
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

  return { projects, error, loading };
}
