import type { ServiceStatus } from '../types/service';

interface ServiceStatsProps {
  /** Список сервисов с их состоянием */
  services: ServiceStatus[];
  /** Идёт ли сейчас обновление состояния (напр. периодическая проверка) */
  loading?: boolean;
}

/**
 * Динамический блок состояния сервисов на главной странице.
 * Получает готовый список сервисов (с состояниями) извне и только отрисовывает его,
 * поэтому реальная логика проверки подключается отдельно — без изменения этого компонента.
 */
function ServiceStats({ services, loading = false }: ServiceStatsProps) {
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
        if (service.onClick) {
          return (
            <button
              type="button"
              className="stat-item stat-item--clickable"
              key={service.id}
              onClick={service.onClick}
              title={`Детали: ${service.label}`}
            >
              {body}
            </button>
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
