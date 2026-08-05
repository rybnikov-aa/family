import { useEffect, useState, type FormEvent } from 'react';
import type { VpsServiceConfig } from '../api/client';
import { createVps } from '../api/client';
import { COUNTRIES } from '../utils/countries';
import { EllipsisIcon, PlusIcon } from './icons';

/** Типы сервисов, поддерживаемые проверкой доступности на бэкенде. */
const SERVICE_TYPES = [
  { value: 'http', label: 'HTTP(S)' },
  { value: 'ocserv', label: 'OpenConnect (ocserv)' },
];

/** Пустой черновик сервиса. */
const emptyService = (): VpsServiceConfig => ({ name: '', type: 'http', address: '' });

interface VpsAddModalProps {
  /** Закрыть форму без сохранения */
  onClose: () => void;
  /** Вызывается после успешного добавления VPS (для обновления списка) */
  onAdded: () => void;
}

/**
 * Форма добавления VPS на мониторинг доступности.
 *
 * Поля: Расположение (выпадающий список), Имя, IP, Панель управления
 * и поле «Сервисы» — набор сервисов, редактируемый по кнопке с троеточием.
 */
function VpsAddModal({ onClose, onAdded }: VpsAddModalProps) {
  const [country, setCountry] = useState('');
  const [name, setName] = useState('');
  const [ip, setIp] = useState('');
  const [panel, setPanel] = useState('');
  const [services, setServices] = useState<VpsServiceConfig[]>([]);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape: сначала закрыть редактор сервисов, затем форму.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (servicesOpen) {
        setServicesOpen(false);
      } else {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [servicesOpen, onClose]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!country) {
      setError('Выберите расположение');
      return;
    }
    if (!name.trim()) {
      setError('Укажите имя');
      return;
    }
    if (!ip.trim()) {
      setError('Укажите IP-адрес');
      return;
    }

    const validServices = services
      .filter((s) => s.name.trim() !== '' && s.type.trim() !== '' && s.address.trim() !== '')
      .map((s) => ({
        name: s.name.trim(),
        type: s.type.trim(),
        address: s.address.trim(),
      }));

    setSubmitting(true);
    setError(null);
    try {
      await createVps({
        country,
        name: name.trim(),
        ip: ip.trim(),
        panel: panel.trim(),
        services: validServices,
      });
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить VPS');
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Добавить VPS"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__head">
          <h3>Добавить VPS</h3>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <form className="vps-form" onSubmit={handleSubmit}>
          <label className="vps-form__field">
            <span className="vps-form__label">Расположение</span>
            <select
              className="vps-form__control"
              value={country}
              onChange={(event) => setCountry(event.target.value)}
              required
            >
              <option value="" disabled>
                Выберите страну…
              </option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <label className="vps-form__field">
            <span className="vps-form__label">Имя</span>
            <input
              className="vps-form__control"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="напр. my-vps-01"
              required
            />
          </label>

          <label className="vps-form__field">
            <span className="vps-form__label">IP</span>
            <input
              className="vps-form__control"
              type="text"
              value={ip}
              onChange={(event) => setIp(event.target.value)}
              placeholder="напр. 150.251.139.253"
              required
            />
          </label>

          <label className="vps-form__field">
            <span className="vps-form__label">Панель управления</span>
            <input
              className="vps-form__control"
              type="text"
              value={panel}
              onChange={(event) => setPanel(event.target.value)}
              placeholder="напр. https://my.justhost.asia/"
            />
          </label>

          <div className="vps-form__field">
            <span className="vps-form__label">Сервисы</span>
            <div className="vps-services">
              {services.length > 0 ? (
                <ul className="vps-services__list">
                  {services.map((service, index) => (
                    <li className="vps-services__chip" key={index}>
                      <span className="vps-services__chip-name">
                        {service.name.trim() !== '' ? service.name : 'Без имени'}
                      </span>
                      <span className="vps-services__chip-meta">{service.type}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="vps-services__empty">Сервисы не добавлены</span>
              )}
              <button
                type="button"
                className="vps-services__edit"
                onClick={() => setServicesOpen(true)}
                aria-label="Редактировать сервисы"
                title="Редактировать сервисы"
              >
                <EllipsisIcon />
              </button>
            </div>
          </div>

          {error && <div className="vps-form__error">{error}</div>}

          <div className="vps-form__actions">
            <button
              type="button"
              className="vps-form__button"
              onClick={onClose}
              disabled={submitting}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="vps-form__button vps-form__button--primary"
              disabled={submitting}
            >
              {submitting ? 'Добавление…' : 'Добавить'}
            </button>
          </div>
        </form>

        {servicesOpen && (
          <ServicesEditor
            services={services}
            onChange={setServices}
            onClose={() => setServicesOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

interface ServicesEditorProps {
  services: VpsServiceConfig[];
  onChange: (services: VpsServiceConfig[]) => void;
  onClose: () => void;
}

/** Редактор набора сервисов: список с добавлением/удалением/правкой. */
function ServicesEditor({ services, onChange, onClose }: ServicesEditorProps) {
  const addService = () => onChange([...services, emptyService()]);
  const updateService = (index: number, patch: Partial<VpsServiceConfig>) =>
    onChange(services.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  const removeService = (index: number) => onChange(services.filter((_, i) => i !== index));

  return (
    <div className="services-editor-backdrop" onClick={onClose}>
      <div
        className="services-editor"
        role="dialog"
        aria-modal="true"
        aria-label="Редактор сервисов"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="services-editor__head">
          <h4>Сервисы</h4>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Готово">
            ✕
          </button>
        </div>

        {services.length === 0 && (
          <p className="services-editor__empty">Сервисов пока нет — добавьте первый.</p>
        )}

        <ul className="services-editor__list">
          {services.map((service, index) => (
            <li className="services-editor__item" key={index}>
              <div className="services-editor__row">
                <input
                  className="vps-form__control"
                  type="text"
                  value={service.name}
                  onChange={(event) => updateService(index, { name: event.target.value })}
                  placeholder="Имя (напр. 3x-ui)"
                />
                <button
                  type="button"
                  className="services-editor__remove"
                  onClick={() => removeService(index)}
                  aria-label="Удалить сервис"
                  title="Удалить сервис"
                >
                  ✕
                </button>
              </div>
              <div className="services-editor__row">
                <select
                  className="vps-form__control"
                  value={service.type}
                  onChange={(event) => updateService(index, { type: event.target.value })}
                >
                  {SERVICE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <input
                  className="vps-form__control"
                  type="text"
                  value={service.address}
                  onChange={(event) => updateService(index, { address: event.target.value })}
                  placeholder="Адрес (URL или host)"
                />
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="vps-form__button vps-form__button--primary services-editor__add"
          onClick={addService}
        >
          <PlusIcon />
          Добавить сервис
        </button>

        <div className="vps-form__actions">
          <button
            type="button"
            className="vps-form__button vps-form__button--primary"
            onClick={onClose}
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}

export default VpsAddModal;
