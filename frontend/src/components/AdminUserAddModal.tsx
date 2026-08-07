import { useState, type FormEvent } from 'react';
import Modal from './Modal';
import Button from './Button';
import { createAdminUser } from '../api/client';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface AdminUserAddModalProps {
  /** Закрыть форму без сохранения */
  onClose: () => void;
  /** Вызывается после успешного добавления пользователя (для обновления списка) */
  onAdded: () => void;
}

/** Роль нового пользователя. */
type NewUserRole = 'admin' | 'user';

/**
 * Форма добавления пользователя (админ-панель).
 *
 * Поля: имя пользователя (логин), отображаемое имя, роль (admin/user),
 * пароль (не короче 6 символов).
 */
function AdminUserAddModal({ onClose, onAdded }: AdminUserAddModalProps) {
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<NewUserRole>('user');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape закрывает модалку.
  useEscapeClose(onClose);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    if (!username.trim()) {
      setError('Укажите имя пользователя (логин)');
      return;
    }
    if (!name.trim()) {
      setError('Укажите отображаемое имя');
      return;
    }
    if (password.length < 6) {
      setError('Пароль должен быть не короче 6 символов');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createAdminUser({
        username: username.trim(),
        name: name.trim(),
        role,
        password,
      });
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить пользователя');
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Добавить пользователя" onClose={onClose}>
      <form className="vps-form" onSubmit={handleSubmit}>
        <label className="vps-form__field">
          <span className="vps-form__label">Имя пользователя (логин)</span>
          <input
            className="vps-form__control"
            type="text"
            autoComplete="off"
            maxLength={50}
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="напр. mama"
            required
          />
        </label>

        <label className="vps-form__field">
          <span className="vps-form__label">Отображаемое имя</span>
          <input
            className="vps-form__control"
            type="text"
            autoComplete="off"
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="напр. Мама"
            required
          />
        </label>

        <label className="vps-form__field">
          <span className="vps-form__label">Роль</span>
          <select
            className="vps-form__control"
            value={role}
            onChange={(event) => setRole(event.target.value as NewUserRole)}
          >
            <option value="user">Пользователь</option>
            <option value="admin">Администратор</option>
          </select>
        </label>

        <label className="vps-form__field">
          <span className="vps-form__label">Пароль</span>
          <input
            className="vps-form__control"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Не короче 6 символов"
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
            {submitting ? 'Добавление…' : 'Добавить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default AdminUserAddModal;
