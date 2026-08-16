import { useState, type FormEvent } from 'react';
import type { VpsEntryInput, VpsServiceConfig } from '../api/client';
import { createVps, updateVps } from '../api/client';
import { COUNTRIES } from '../utils/countries';
import { useEscapeClose } from '../hooks/useEscapeClose';
import Modal from './Modal';
import Button from './Button';
import IconButton from './IconButton';
import { EllipsisIcon, PlusIcon, TrashIcon } from './icons';

/** Типы сервисов, поддерживаемые проверкой доступности на бэкенде. */
const SERVICE_TYPES = [
  { value: 'http', label: 'HTTP(S)' },
  { value: 'ocserv', label: 'OpenConnect (ocserv)' },
];

/** Черновик сервиса: VpsServiceConfig + локальный id для стабильных React-ключей. */
type ServiceDraft = VpsServiceConfig & { uid: number };

/** Монотонный счётчик локальных id сервисов (только для ключей списка). */
let nextServiceUid = 1;

/** Пустой черновик сервиса. */
const emptyService = (): ServiceDraft => ({
  uid: nextServiceUid++,
  name: '',
  type: 'http',
  address: '',
});

interface VpsAddModalProps {
  /** Закрыть форму без сохранения */
  onClose: () => void;
  /** Вызывается после успешного сохранения VPS (для обновления списка) */
  onAdded: () => void;
  /** Режим формы: создание или редактирование */
  mode?: 'create' | 'edit';
  /** Исходная запись при редактировании */
  initialEntry?: VpsEntryInput;
  /** Текущее имя записи до редактирования (URL-параметр) */
  currentName?: string;
}

/**
 * Форма добавления/редактирования VPS на мониторинг доступности.
 *
 * Поля: Расположение (выпадающий список), Имя, IP, Панель управления
 * и поле «Сервисы» — набор сервисов, редактируемый по кнопке с троеточием.
 */
function VpsAddModal({
  onClose,
  onAdded,
  mode = 'create',
  initialEntry,
  currentName,
}: VpsAddModalProps) {
  const [country, setCountry] = useState(initialEntry?.country ?? '');
  const [name, setName] = useState(initialEntry?.name ?? '');
  const [ip, setIp] = useState(initialEntry?.ip ?? '');
  const [panel, setPanel] = useState(initialEntry?.panel ?? '');
  const [services, setServices] = useState<ServiceDraft[]>(
    (initialEntry?.services ?? []).map((service, index) => ({ ...service, uid: index + 1 })),
  );
  const [servicesOpen, setServicesOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape: сначала закрыть редактор сервисов, затем форму (Modal сам Escape не слушает).
  useEscapeClose(() => {
    if (servicesOpen) setServicesOpen(false);
    else onClose();
  });

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

    const payload = {
      country,
      name: name.trim(),
      ip: ip.trim(),
      panel: panel.trim(),
      services: validServices,
    };

    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'edit') {
        await updateVps(currentName ?? initialEntry?.name ?? name.trim(), payload);
      } else {
        await createVps(payload);
      }
      onAdded();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : mode === 'edit'
            ? 'Не удалось сохранить VPS'
            : 'Не удалось добавить VPS',
      );
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={mode === 'edit' ? 'Редактировать VPS' : 'Добавить VPS'}
      onClose={onClose}
      closeOnEscape={false}
    >
      <form className="vps-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Расположение</span>
          <select
            className="input"
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

        <label className="field">
          <span className="field__label">Имя</span>
          <input
            className="input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="напр. my-vps-01"
            required
          />
        </label>

        <label className="field">
          <span className="field__label">IP</span>
          <input
            className="input"
            type="text"
            value={ip}
            onChange={(event) => setIp(event.target.value)}
            placeholder="напр. 150.251.139.253"
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Панель управления</span>
          <input
            className="input"
            type="text"
            value={panel}
            onChange={(event) => setPanel(event.target.value)}
            placeholder="напр. https://my.justhost.asia/"
          />
        </label>

        <div className="field">
          <span className="field__label">Сервисы</span>
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
            <IconButton
              className="vps-services__edit"
              label="Редактировать сервисы"
              tooltip="Редактировать сервисы"
              onClick={() => setServicesOpen(true)}
            >
              <EllipsisIcon />
            </IconButton>
          </div>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        <div className="vps-form__actions">
          <Button onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting
              ? mode === 'edit'
                ? 'Сохранение…'
                : 'Добавление…'
              : mode === 'edit'
                ? 'Сохранить'
                : 'Добавить'}
          </Button>
        </div>
      </form>

      {servicesOpen && (
        <ServicesEditor
          services={services}
          onChange={setServices}
          onClose={() => setServicesOpen(false)}
        />
      )}
    </Modal>
  );
}

interface ServicesEditorProps {
  services: ServiceDraft[];
  onChange: (services: ServiceDraft[]) => void;
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
          <IconButton label="Готово" onClick={onClose}>
            ✕
          </IconButton>
        </div>

        {services.length === 0 && (
          <p className="services-editor__empty">Сервисов пока нет — добавьте первый.</p>
        )}

        <ul className="services-editor__list">
          {services.map((service, index) => (
            <li className="services-editor__item" key={service.uid}>
              <div className="services-editor__fields">
                <input
                  className="input services-editor__name"
                  type="text"
                  value={service.name}
                  onChange={(event) => updateService(index, { name: event.target.value })}
                  placeholder="Имя (напр. 3x-ui)"
                />
                <select
                  className="input services-editor__type"
                  value={service.type}
                  onChange={(event) => updateService(index, { type: event.target.value })}
                >
                  {SERVICE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="services-editor__addr">
                <input
                  className="input"
                  type="text"
                  value={service.address}
                  onChange={(event) => updateService(index, { address: event.target.value })}
                  placeholder="Адрес (URL или host)"
                />
              </div>
              <IconButton
                className="services-editor__remove"
                danger
                label="Удалить сервис"
                tooltip="Удалить сервис"
                onClick={() => removeService(index)}
              >
                <TrashIcon />
              </IconButton>
            </li>
          ))}
        </ul>

        <Button
          variant="primary"
          icon={<PlusIcon />}
          className="services-editor__add"
          onClick={addService}
        >
          Добавить сервис
        </Button>

        <div className="vps-form__actions">
          <Button variant="primary" onClick={onClose}>
            Готово
          </Button>
        </div>
      </div>
    </div>
  );
}

export default VpsAddModal;
