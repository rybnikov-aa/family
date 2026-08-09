import { useState } from 'react';
import PageLayout from '../components/PageLayout';
import Button from '../components/Button';
import IconButton from '../components/IconButton';
import AdminUserAddModal from '../components/AdminUserAddModal';
import AdminUserPasswordModal from '../components/AdminUserPasswordModal';
import { LockIcon, PlusIcon, TrashIcon } from '../components/icons';
import { useApiData } from '../hooks/useApiData';
import { useAuth } from '../hooks/useAuth';
import { deleteAdminUser, fetchAdminUsers, type AdminUser } from '../api/client';

/** Преобразует дату создания (SQLite `datetime('now')`, UTC) в «ДД.ММ.ГГГГ». */
function formatDate(value: string): string {
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Админ-панель «Пользователи»: список учётных записей, добавление, удаление
 * и принудительная смена пароля. Доступна только роли `admin` (гейт `AdminGate`),
 * открывается по клику на бейдж «админ» в шапке.
 */
function AdminUsersPage() {
  const { user } = useAuth();
  const { data: users, error, loading, reload } = useApiData(fetchAdminUsers);
  const [addOpen, setAddOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<AdminUser | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Ошибки операций (напр. удаление) — отдельно от успеха: раньше всё сообщение
  // показывалось зелёным (`alert--success`), и сбой выглядел как успех.
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAdded = () => {
    setAddOpen(false);
    setMessage(null);
    setActionError(null);
    reload();
  };

  const handlePasswordChanged = () => {
    setPasswordTarget(null);
    setMessage(null);
    setActionError(null);
    reload();
  };

  const handleDelete = async (target: AdminUser) => {
    if (!window.confirm(`Удалить пользователя «${target.name}» (${target.username})?`)) return;
    setMessage(null);
    setActionError(null);
    try {
      await deleteAdminUser(target.id);
      setMessage(`Пользователь «${target.username}» удалён`);
      reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Не удалось удалить пользователя');
    }
  };

  return (
    <PageLayout>
      <section className="admin">
        <div className="admin__head">
          <div>
            <h2 className="admin__title">Пользователи</h2>
            <p className="admin__sub">Управление учётными записями портала</p>
          </div>
          <Button variant="primary" icon={<PlusIcon />} onClick={() => setAddOpen(true)}>
            Добавить пользователя
          </Button>
        </div>

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}
        {actionError && (
          <div className="alert alert--error" role="alert">
            {actionError}
          </div>
        )}
        {message && (
          <div className="alert alert--success" role="status">
            {message}
          </div>
        )}

        <div className="admin__card">
          {loading && <p className="admin__empty">Загрузка…</p>}
          {!loading && users && users.length === 0 && (
            <p className="admin__empty">Пользователей пока нет.</p>
          )}
          {!loading && users && users.length > 0 && (
            <table className="admin__table">
              <thead>
                <tr>
                  <th>Логин</th>
                  <th>Имя</th>
                  <th>Роль</th>
                  <th>Создан</th>
                  <th className="admin__table-actions" aria-label="Действия" />
                </tr>
              </thead>
              <tbody>
                {users.map((entry) => (
                  <tr key={entry.id}>
                    <td className="admin__username">{entry.username}</td>
                    <td>{entry.name}</td>
                    <td>
                      <span
                        className={`badge badge--surface${entry.role === 'user' ? ' badge--muted' : ''}`}
                      >
                        {entry.role === 'admin' ? 'админ' : 'пользователь'}
                      </span>
                    </td>
                    <td className="admin__date">{formatDate(entry.createdAt)}</td>
                    <td className="admin__row-actions">
                      <IconButton
                        label={`Задать пароль «${entry.username}»`}
                        tooltip="Задать пароль"
                        onClick={() => setPasswordTarget(entry)}
                      >
                        <LockIcon />
                      </IconButton>
                      <IconButton
                        label={`Удалить «${entry.username}»`}
                        tooltip="Удалить"
                        danger
                        disabled={entry.id === user?.id}
                        onClick={() => void handleDelete(entry)}
                      >
                        <TrashIcon />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && users && users.length > 0 && user && (
            <p className="admin__hint">Свою учётную запись удалить нельзя.</p>
          )}
        </div>
      </section>

      {addOpen && <AdminUserAddModal onClose={() => setAddOpen(false)} onAdded={handleAdded} />}
      {passwordTarget && (
        <AdminUserPasswordModal
          user={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onChanged={handlePasswordChanged}
        />
      )}
    </PageLayout>
  );
}

export default AdminUsersPage;
