import { useState, type FormEvent } from 'react';
import Modal from './Modal';
import Button from './Button';
import { updateRenovationMetaObject } from '../api/client';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface RenovationAddressModalProps {
  /** Текущий адрес объекта — начальное значение поля. */
  object: string;
  /** Закрыть форму без сохранения. */
  onClose: () => void;
  /** Вызывается после успешного сохранения (перезагрузить сводку). */
  onSaved: () => void;
}

/**
 * Форма редактирования адреса объекта «Ремонта» (страница «Ремонт»).
 * Адрес показывается в подзаголовке шапки и в реквизитах проекта; сохраняется
 * в `renovation_meta.object` через `PUT /api/renovation/meta`.
 */
function RenovationAddressModal({ object, onClose, onSaved }: RenovationAddressModalProps) {
  const [value, setValue] = useState(object);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeClose(onClose);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Адрес не может быть пустым');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateRenovationMetaObject(trimmed);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить адрес');
      setSaving(false);
    }
  };

  return (
    <Modal title="Адрес объекта" onClose={onClose}>
      <form className="vps-form" onSubmit={handleSubmit}>
        <p className="vps-form__note">
          Адрес отображается в подзаголовке страницы «Ремонт» и в реквизитах проекта.
        </p>

        <label className="field">
          <span className="field__label">Объект (адрес)</span>
          <input
            className="input"
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="г. Ростов-на-Дону, …"
            autoFocus
            required
          />
        </label>

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        <div className="vps-form__actions">
          <Button onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default RenovationAddressModal;
