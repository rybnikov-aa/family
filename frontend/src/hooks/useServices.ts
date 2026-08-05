import { useMemo } from 'react';
import type { ServiceStatus, ServiceState } from '../types/service';
import { BoltIcon, FolderIcon, HomeIcon, ServerIcon } from '../components/icons';
import type { VpsStatus } from '../api/client';
import { useVps } from './useVps';
import { availabilityState, overallAvailability } from '../utils/availability';

export interface UseServicesResult {
  /** Список сервисов для отображения в блоке состояния */
  services: ServiceStatus[];
  /** Сырые статусы VPS (для детализации) */
  vps: VpsStatus[];
}

/**
 * Возвращает список сервисов с их актуальным состоянием.
 *
 * Статичные метрики заполнены плейсхолдерами (state: 'ok'), а VPS показывает
 * процент доступности, рассчитанный из реальной проверки на бэкенде
 * (GET /api/vps): доступность по IP (0.5) + доступность сервисов (0.5).
 */
export function useServices(): UseServicesResult {
  const { statuses, error, loading } = useVps();

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
        id: 'renovation',
        label: 'ремонт',
        value: '40%',
        state: 'ok',
        href: '/renovation/',
        icon: BoltIcon,
      },
      {
        id: 'vps',
        label: 'VPS',
        value: vpsValue,
        state: vpsState,
        icon: ServerIcon,
      },
    ];
  }, [statuses, error, loading]);

  return { services, vps: statuses };
}
