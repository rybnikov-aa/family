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
      {services.map((service) => {
        const Icon = service.icon;
        const body = (
          <>
            <span
              className={`stat-item__dot stat-item__dot--${service.state}`}
              aria-hidden="true"
            />
            <span className="stat-item__icon" aria-hidden="true">
              <Icon />
            </span>
            <div className="stat-item__info">
              <span className="stat-item__value">{service.value}</span>
              <span className="stat-item__label">
                {service.href ? <a href={service.href}>{service.label}</a> : service.label}
              </span>
            </div>
          </>
        );

        // Кликабельная карточка (например, VPS — открывает детализацию).
        // Рядом со значением доступности выводим кнопку «Обновить».
        if (service.onClick) {
          return (
            <div
              className="stat-item stat-item--clickable"
              role="button"
              tabIndex={0}
              key={service.id}
              onClick={service.onClick}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  service.onClick?.();
                }
              }}
              title={`Детали: ${service.label}`}
            >
              <span
                className={`stat-item__dot stat-item__dot--${service.state}`}
                aria-hidden="true"
              />
              <span className="stat-item__icon" aria-hidden="true">
                <Icon />
              </span>
              <div className="stat-item__info">
                <span className="stat-item__value-row">
                  <span className="stat-item__value">{service.value}</span>
                  {onRefresh && (
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
            </div>
          );
        }

        return (
          <div className="stat-item" role="listitem" key={service.id}>
            {body}
          </div>
        );
      })}
    </div>
  );
}

export default ServiceStats;
