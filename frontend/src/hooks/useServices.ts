import { useMemo } from 'react';
import type { ServiceStatus, ServiceState } from '../types/service';
import { ServerIcon } from '../components/icons';
import type { VpsStatus } from '../api/client';
import { useVps } from './useVps';
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
 * В строке состояния на главной показываем только VPS: процент доступности,
 * рассчитанный из реальной проверки на бэкенде (GET /api/vps):
 * доступность по IP (0.5) + доступность сервисов (0.5).
 */
export function useServices(): UseServicesResult {
  const { statuses, error, loading, refresh } = useVps();

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
        id: 'vps',
        label: 'VPS',
        value: vpsValue,
        state: vpsState,
        icon: ServerIcon,
      },
    ];
  }, [statuses, error, loading]);

  return { services, vps: statuses, loading, refresh };
}
