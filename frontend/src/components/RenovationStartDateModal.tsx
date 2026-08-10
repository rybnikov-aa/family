import { useState, type FormEvent } from 'react';
import Modal from './Modal';
import Button from './Button';
import { updateRenovationStartDate } from '../api/client';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface RenovationStartDateModalProps {
  /** Текущая дата старта — начальное значение поля (ГГГГ-ММ-ДД). */
  startDate: string;
  /** Закрыть форму без сохранения. */
  onClose: () => void;
  /** Вызывается после успешного сохранения (перезагрузить сводку). */
  onSaved: () => void;
}

/**
 * Форма редактирования даты старта «Ремонта» (страница «Ремонт», admin).
 * От даты старта считается прогресс-бар времени (прошедшее время к сроку);
 * сохраняется в `renovation_meta.start_date` через `PUT /api/renovation/meta`.
 */
function RenovationStartDateModal({ startDate, onClose, onSaved }: RenovationStartDateModalProps) {
  const [value, setValue] = useState(startDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeClose(onClose);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!value) {
      setError('Укажите дату старта');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updateRenovationStartDate(value);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить дату старта');
      setSaving(false);
    }
  };

  return (
    <Modal title="Дата старта" onClose={onClose}>
      <form className="vps-form" onSubmit={handleSubmit}>
        <p className="vps-form__note">
          От даты старта считается прогресс-бар времени на странице «Ремонт» (прошедшее время к
          сроку).
        </p>

        <label className="field">
          <span className="field__label">Дата старта</span>
          <input
            className="input"
            type="date"
            value={value}
            onChange={(event) => setValue(event.target.value)}
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

export default RenovationStartDateModal;
