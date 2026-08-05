import type { VpsStatus } from '../api/client';
import type { ServiceState } from '../types/service';

/**
 * Доступность одного VPS (доли 0..1).
 * total = доступность по ip * 0.5 + доступность сервисов * 0.5.
 */
export interface VpsAvailability {
  /** Доступность по IP: 1 — доступен, 0 — нет */
  ip: number;
  /** Доступность сервисов: доля доступных сервисов (0..1) */
  services: number;
  /** Итоговая доступность VPS (0..1) */
  total: number;
}

export function vpsAvailability(vps: VpsStatus): VpsAvailability {
  const ip = vps.online ? 1 : 0;
  const services =
    vps.services.length === 0
      ? 0
      : vps.services.reduce((sum, service) => sum + (service.online ? 1 : 0), 0) /
        vps.services.length;
  return { ip, services, total: ip * 0.5 + services * 0.5 };
}

/** Общая доступность всех VPS (доля 0..1) = сумма доступностей VPS / кол-во VPS. */
export function overallAvailability(statuses: VpsStatus[]): number {
  if (statuses.length === 0) return 0;
  return statuses.reduce((sum, vps) => sum + vpsAvailability(vps).total, 0) / statuses.length;
}

/**
 * Цвет индикатора по проценту доступности:
 * 100% — зелёный (ok), 90% < x < 100% — жёлтый (warning), иначе — красный (error).
 */
export function availabilityState(percent: number): ServiceState {
  if (percent >= 100) return 'ok';
  if (percent > 90) return 'warning';
  return 'error';
}
