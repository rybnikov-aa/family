import { useCallback, useRef, useState } from 'react';
import {
  fetchRenovationMaterialsReport,
  fetchRenovationWorkReport,
  type RenovationMaterialsReport,
  type RenovationWorkReport,
} from '../api/client';

interface ReportsState {
  work: RenovationWorkReport | null;
  materials: RenovationMaterialsReport | null;
  loading: boolean;
  error: string | null;
  /** Загрузить оба отчёта (лениво, при первом открытии вкладки). */
  load: () => Promise<void>;
  /** Сбросить кэш и перезагрузить. */
  reload: () => Promise<void>;
}

/**
 * Отчёты «Ремонта» (этап 5) — «Ход работ» и «Материалы».
 * Ленивая загрузка по требованию (кэш в памяти до reload).
 */
export function useRenovationReports(): ReportsState {
  const [work, setWork] = useState<RenovationWorkReport | null>(null);
  const [materials, setMaterials] = useState<RenovationMaterialsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    if (loadedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const [w, m] = await Promise.all([
        fetchRenovationWorkReport(),
        fetchRenovationMaterialsReport(),
      ]);
      setWork(w.work);
      setMaterials(m.materials);
      loadedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки отчётов');
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(async () => {
    loadedRef.current = false;
    setWork(null);
    setMaterials(null);
    await load();
  }, [load]);

  return { work, materials, loading, error, load, reload };
}
