import { useState, type FormEvent } from 'react';
import Modal from './Modal';
import Button from './Button';
import { setAdminUserPassword, type AdminUser } from '../api/client';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface AdminUserPasswordModalProps {
  /** Пользователь, которому задаём пароль */
  user: AdminUser;
  /** Закрыть форму без сохранения */
  onClose: () => void;
  /** Вызывается после успешной смены пароля */
  onChanged: () => void;
}

/**
 * Принудительная смена пароля пользователю (админ-панель).
 * Текущий пароль пользователя не требуется — администратор задаёт новый напрямую.
 */
function AdminUserPasswordModal({ user, onClose, onChanged }: AdminUserPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape закрывает модалку.
  useEscapeClose(onClose);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await setAdminUserPassword(user.id, password);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сменить пароль');
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Задать пароль" onClose={onClose}>
      <form className="vps-form" onSubmit={handleSubmit}>
        <p className="vps-form__note">
          Новый пароль для «{user.name}» ({user.username}). Текущий пароль пользователя не
          требуется.
        </p>

        <label className="vps-form__field">
          <span className="vps-form__label">Новый пароль</span>
          <input
            className="vps-form__control"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Не короче 6 символов"
            autoFocus
            required
          />
        </label>

        {error && (
          <div className="vps-form__error" role="alert">
            {error}
          </div>
        )}

        <div className="vps-form__actions">
          <Button onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AdminUserPasswordModal;
