import { memo } from 'react';
import type { ServiceStatus } from '../types/service';
import IconButton from './IconButton';
import { RefreshIcon } from './icons';

interface ServiceStatsProps {
  /** Список сервисов с их состоянием */
  services: ServiceStatus[];
  /** Идёт ли сейчас обновление состояния (напр. периодическая проверка) */
  loading?: boolean;
  /** Обработчик принудительного обновления */
  onRefresh?: () => void;
  /** Идёт ли сейчас обновление */
  refreshing?: boolean;
}

interface StatItemProps {
  service: ServiceStatus;
  onRefresh?: () => void;
  refreshing?: boolean;
}

/** Тело карточки сервиса: точка, иконка, значение и подпись (общее для обоих вариантов). */
function StatItemBody({ service, onRefresh, refreshing }: StatItemProps) {
  const Icon = service.icon;
  return (
    <>
      <span className={`stat-item__dot stat-item__dot--${service.state}`} aria-hidden="true" />
      <span className="stat-item__icon" aria-hidden="true">
        <Icon />
      </span>
      <div className="stat-item__info">
        <span className="stat-item__value-row">
          <span className="stat-item__value">{service.value}</span>
          {/* Кнопка «Обновить» — только на кликабельной карточке (VPS). */}
          {service.onClick && onRefresh && (
            <IconButton
              size="xs"
              plain
              label="Обновить"
              tooltip="Обновить"
              spinning={refreshing}
              disabled={refreshing}
              onClick={(event) => {
                event.stopPropagation();
                onRefresh();
              }}
            >
              <RefreshIcon />
            </IconButton>
          )}
        </span>
        <span className="stat-item__label">
          {service.href ? <a href={service.href}>{service.label}</a> : service.label}
        </span>
      </div>
    </>
  );
}

/**
 * Карточка сервиса (кликабельная — открывает детализацию, или обычная).
 * memo: пропсы стабильны между рендерами (service из useMemo, onRefresh — useCallback),
 * поэтому при повторных рендерах страницы карточки не перерисовываются.
 */
const StatItem = memo(function StatItem({ service, onRefresh, refreshing }: StatItemProps) {
  if (service.onClick) {
    return (
      <div
        className="stat-item stat-item--clickable"
        role="button"
        tabIndex={0}
        onClick={service.onClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            service.onClick?.();
          }
        }}
        title={`Детали: ${service.label}`}
      >
        <StatItemBody service={service} onRefresh={onRefresh} refreshing={refreshing} />
      </div>
    );
  }
  return (
    <div className="stat-item" role="listitem">
      <StatItemBody service={service} />
    </div>
  );
});

/**
 * Динамический блок состояния сервисов на главной странице.
 * Получает готовый список сервисов (с состояниями) извне и только отрисовывает его,
 * поэтому реальная логика проверки подключается отдельно — без изменения этого компонента.
 */
function ServiceStats({
  services,
  loading = false,
  onRefresh,
  refreshing = false,
}: ServiceStatsProps) {
  return (
    <div className="stats" role="list" aria-label="Состояние сервисов" aria-busy={loading}>
      {services.map((service) => (
        <StatItem
          key={service.id}
          service={service}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
      ))}
    </div>
  );
}

export default ServiceStats;
