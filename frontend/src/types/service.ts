import type { ComponentType } from 'react';
import type { IconProps } from '../components/icons';

/**
 * Состояние сервиса в момент проверки.
 * - ok       — сервис доступен и отвечает
 * - warning  — частично доступен / есть проблемы
 * - error    — сервис недоступен/ошибка
 * - checking — идёт проверка
 * - unknown  — статус пока неизвестен (проверка ещё не подключена)
 */
export type ServiceState = 'ok' | 'warning' | 'error' | 'checking' | 'unknown';

export interface ServiceStatus {
  /** Уникальный идентификатор сервиса */
  id: string;
  /** Название сервиса (подпись) */
  label: string;
  /** Значение для отображения (напр. «100%», «40%», «2026») */
  value: string;
  /** Актуальное состояние сервиса */
  state: ServiceState;
  /** Опциональная ссылка, связанная с сервисом */
  href?: string;
  /** Иконка сервиса */
  icon: ComponentType<IconProps>;
  /** Обработчик клика по карточке (напр. открыть детализацию) */
  onClick?: () => void;
}
