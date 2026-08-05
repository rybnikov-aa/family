import { useMemo } from 'react';
import type { ServiceStatus, ServiceState } from '../types/service';
import { FolderIcon, HomeIcon, ProjectsIcon, ServerIcon } from '../components/icons';
import type { VpsStatus } from '../api/client';
import { useVps } from './useVps';
import { useProjects } from './useProjects';
import { ROUTES } from '../routes';
import { availabilityState, overallAvailability } from '../utils/availability';

export interface UseServicesResult {
  /** Список сервисов для отображения в блоке состояния */
  services: ServiceStatus[];
  /** Сырые статусы VPS (для детализации) */
  vps: VpsStatus[];
  /** Идёт ли загрузка/обновление статусов VPS */
  loading: boolean;
  /** Принудительно перепроверить статусы VPS */
  refresh: () => void;
}

/**
 * Возвращает список сервисов с их актуальным состоянием.
 *
 * Статичные метрики заполнены плейсхолдерами (state: 'ok'), а VPS показывает
 * процент доступности, рассчитанный из реальной проверки на бэкенде
 * (GET /api/vps): доступность по IP (0.5) + доступность сервисов (0.5).
 */
/** Склонение «проект/проекта/проектов» по количеству. */
function pluralProjects(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'проект';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'проекта';
  return 'проектов';
}

export function useServices(): UseServicesResult {
  const { statuses, error, loading, refresh } = useVps();
  const { projects, error: projectsError, loading: projectsLoading } = useProjects();

  const services = useMemo<ServiceStatus[]>(() => {
    const total = statuses.length;
    const percent = Math.round(overallAvailability(statuses) * 100);

    let vpsValue = 'проверка…';
    let vpsState: ServiceState = 'checking';
    if (error) {
      vpsValue = 'офлайн';
      vpsState = 'error';
    } else if (!loading && total > 0) {
      vpsValue = `${percent}%`;
      vpsState = availabilityState(percent);
    } else if (!loading && total === 0) {
      vpsValue = '—';
      vpsState = 'unknown';
    }

    let projectsValue = 'проверка…';
    let projectsState: ServiceState = 'checking';
    let projectsLabel = 'проектов';
    if (projectsError) {
      projectsValue = '—';
      projectsState = 'unknown';
    } else if (!projectsLoading) {
      const count = projects.length;
      projectsValue = String(count);
      projectsState = 'ok';
      projectsLabel = pluralProjects(count);
    }

    return [
      {
        id: 'site',
        label: 'дата регистрации',
        value: '2026',
        state: 'ok',
        icon: HomeIcon,
      },
      {
        id: 'sections',
        label: 'активных раздела',
        value: '4',
        state: 'ok',
        icon: FolderIcon,
      },
      {
        id: 'projects',
        label: projectsLabel,
        value: projectsValue,
        state: projectsState,
        // Внутренний SPA-маршрут в raw-ссылке должен быть в hash-форме (#/projects).
        href: `#${ROUTES.projects}`,
        icon: ProjectsIcon,
      },
      {
        id: 'vps',
        label: 'VPS',
        value: vpsValue,
        state: vpsState,
        icon: ServerIcon,
      },
    ];
  }, [statuses, error, loading, projects, projectsError, projectsLoading]);

  return { services, vps: statuses, loading, refresh };
}
