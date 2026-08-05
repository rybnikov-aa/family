import { useMemo } from 'react';
import type { ServiceStatus, ServiceState } from '../types/service';
import { BoltIcon, FolderIcon, HomeIcon, ServerIcon } from '../components/icons';
import { useVps } from './useVps';

/**
 * Возвращает список сервисов с их актуальным состоянием.
 *
 * Статичные метрики заполнены плейсхолдерами (state: 'ok'), а статус VPS
 * агрегируется из реальной проверки доступности на бэкенде (GET /api/vps).
 * Остальные проверки будут добавлены позже — появятся отдельные fetcher'ы/
 * периодические опросы, обновляющие поле `state` у своих элементов.
 */
export function useServices(): ServiceStatus[] {
  const { statuses, error, loading } = useVps();

  return useMemo<ServiceStatus[]>(() => {
    // VPS-сервис: агрегированное состояние доступности всех VPS из конфига.
    const onlineCount = statuses.filter((vps) => vps.online).length;
    const total = statuses.length;

    let vpsValue = 'проверка…';
    let vpsState: ServiceState = 'checking';
    if (error) {
      vpsValue = 'офлайн';
      vpsState = 'error';
    } else if (!loading && total > 0) {
      if (onlineCount === total) {
        vpsValue = 'online';
        vpsState = 'ok';
      } else if (onlineCount === 0) {
        vpsValue = 'офлайн';
        vpsState = 'error';
      } else {
        vpsValue = `${onlineCount}/${total}`;
        vpsState = 'warning';
      }
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
}
