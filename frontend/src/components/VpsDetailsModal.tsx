import { useEffect, useRef, useState } from 'react';
import type { VpsStatus } from '../api/client';
import { CheckIcon, CopyIcon, RefreshIcon, SettingsIcon } from './icons';
import { availabilityState, overallAvailability, vpsAvailability } from '../utils/availability';

interface VpsDetailsModalProps {
  /** Сырые статусы VPS для детализации */
  statuses: VpsStatus[];
  onClose: () => void;
  /** Принудительно перепроверить статусы VPS */
  onRefresh?: () => void;
  /** Идёт ли сейчас обновление */
  refreshing?: boolean;
}

function VpsDetailsModal({
  statuses,
  onClose,
  onRefresh,
  refreshing = false,
}: VpsDetailsModalProps) {
  const overall = overallAvailability(statuses);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const copyTimerRef = useRef<number | null>(null);

  // Копирование IP в буфер обмена с кратковременной «галочкой».
  const copyIp = (ip: string) => {
    void navigator.clipboard
      .writeText(ip)
      .then(() => {
        setCopiedIp(ip);
        if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
        copyTimerRef.current = window.setTimeout(() => setCopiedIp(null), 1500);
      })
      .catch(() => undefined);
  };

  // Сброс таймера копирования при размонтировании.
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Закрытие по Escape.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Доступность VPS"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <h3>Доступность VPS</h3>
          <div className="modal__head-actions">
            {onRefresh && (
              <button
                type="button"
                className={`modal__refresh${refreshing ? ' modal__refresh--spinning' : ''}`}
                onClick={onRefresh}
                aria-label="Обновить"
                title="Обновить"
                disabled={refreshing}
              >
                <RefreshIcon />
              </button>
            )}
            <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
              ✕
            </button>
          </div>
        </div>

        <div className="modal__summary">
          Общая доступность: <strong>{Math.round(overall * 100)}%</strong>
        </div>

        <div className="modal__list">
          {statuses.map((vps) => {
            const availability = vpsAvailability(vps);
            const state = availabilityState(Math.round(availability.total * 100));
            return (
              <div className="modal__vps" key={vps.name}>
                <div className="modal__vps-head">
                  <img
                    className="modal__vps-flag"
                    src={`https://flagcdn.com/${vps.country.toLowerCase()}.svg`}
                    alt={`Флаг: ${vps.country}`}
                    width={24}
                    height={16}
                  />
                  <span className="modal__vps-name">{vps.name}</span>
                  <span className="modal__vps-head-end">
                    <span className="modal__vps-ip-cluster">
                      <span className="modal__vps-ip">{vps.ip}</span>
                      <button
                        type="button"
                        className={`modal__vps-copy${
                          copiedIp === vps.ip ? ' modal__vps-copy--copied' : ''
                        }`}
                        onClick={() => copyIp(vps.ip)}
                        aria-label="Скопировать IP"
                        data-tooltip={copiedIp === vps.ip ? 'Скопировано' : 'Скопировать IP'}
                      >
                        {copiedIp === vps.ip ? <CheckIcon /> : <CopyIcon />}
                      </button>
                      {vps.panel && (
                        <a
                          className="modal__vps-panel"
                          href={vps.panel}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-tooltip="Панель управления хостера"
                          aria-label="Панель управления хостера"
                        >
                          <SettingsIcon />
                        </a>
                      )}
                    </span>
                    <span className={`modal__badge modal__badge--${state}`}>
                      {Math.round(availability.total * 100)}%
                    </span>
                  </span>
                </div>
                <ul className="modal__services">
                  {vps.services.length > 0 ? (
                    vps.services.map((service) => (
                      <li key={service.name} className="modal__service">
                        {service.type === 'http' ? (
                          <a
                            className="modal__service-name"
                            href={service.address}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={service.address}
                          >
                            {service.name}
                          </a>
                        ) : (
                          <span className="modal__service-name" title={service.address}>
                            {service.name}
                          </span>
                        )}
                        <span
                          className={`modal__service-dot modal__service-dot--${
                            service.online ? 'ok' : 'error'
                          }`}
                          title={service.online ? 'доступен' : 'недоступен'}
                        />
                      </li>
                    ))
                  ) : (
                    <li className="modal__service modal__service--muted">Сервисы не настроены</li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default VpsDetailsModal;
