import { useState, type FormEvent } from 'react';
import PageLayout from '../components/PageLayout';
import Button from '../components/Button';
import { LockIcon, UserIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';

/**
 * Страница профиля: просмотр учётных данных, изменение отображаемого имени
 * и смена пароля (с подтверждением текущим паролем). Открывается по клику
 * на имя пользователя в шапке.
 */
function ProfilePage() {
  const { user, updateProfile } = useAuth();

  // Имя
  const [name, setName] = useState(user?.name ?? '');
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaving, setNameSaving] = useState(false);

  // Пароль
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  if (!user) return null;

  const onNameSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (nameSaving) return;
    setNameError(null);
    setNameMessage(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Имя не может быть пустым');
      return;
    }
    setNameSaving(true);
    try {
      await updateProfile({ name: trimmed });
      setName(trimmed);
      setNameMessage('Имя обновлено');
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Не удалось обновить имя');
    } finally {
      setNameSaving(false);
    }
  };

  const onPasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordSaving) return;
    setPasswordError(null);
    setPasswordMessage(null);
    if (password.length < 6) {
      setPasswordError('Новый пароль должен быть не короче 6 символов');
      return;
    }
    if (!currentPassword) {
      setPasswordError('Укажите текущий пароль');
      return;
    }
    setPasswordSaving(true);
    try {
      await updateProfile({ currentPassword, password });
      setCurrentPassword('');
      setPassword('');
      setPasswordMessage('Пароль изменён');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Не удалось изменить пароль');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <PageLayout>
      <section className="profile">
        <h2 className="profile__title">Профиль</h2>

        <div className="profile__card">
          <div className="profile__card-head">
            <span className="profile__card-icon">
              <UserIcon />
            </span>
            <div>
              <h3 className="profile__card-title">Имя и учётные данные</h3>
              <p className="profile__card-sub">Отображаемое имя видно в шапке портала</p>
            </div>
          </div>

          <div className="profile__meta">
            <span>Логин: {user.username}</span>
            <span className="badge badge--surface">
              {user.role === 'admin' ? 'админ' : 'пользователь'}
            </span>
          </div>

          <form onSubmit={onNameSubmit}>
            <label className="field field--block">
              <span className="field__label">Отображаемое имя</span>
              <input
                className="input input--surface"
                type="text"
                autoComplete="name"
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            {nameMessage && (
              <div className="alert alert--success alert--block" role="status">
                {nameMessage}
              </div>
            )}
            {nameError && (
              <div className="alert alert--error alert--block" role="alert">
                {nameError}
              </div>
            )}

            <Button type="submit" variant="primary" disabled={nameSaving || !name.trim()}>
              {nameSaving ? 'Сохранение…' : 'Сохранить имя'}
            </Button>
          </form>
        </div>

        <div className="profile__card">
          <div className="profile__card-head">
            <span className="profile__card-icon">
              <LockIcon />
            </span>
            <div>
              <h3 className="profile__card-title">Пароль</h3>
              <p className="profile__card-sub">Смена пароля — с подтверждением текущим</p>
            </div>
          </div>

          <form onSubmit={onPasswordSubmit}>
            <label className="field field--block">
              <span className="field__label">Текущий пароль</span>
              <input
                className="input input--surface"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label className="field field--block">
              <span className="field__label">Новый пароль</span>
              <input
                className="input input--surface"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {passwordMessage && (
              <div className="alert alert--success alert--block" role="status">
                {passwordMessage}
              </div>
            )}
            {passwordError && (
              <div className="alert alert--error alert--block" role="alert">
                {passwordError}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              disabled={passwordSaving || !currentPassword || password.length < 6}
            >
              {passwordSaving ? 'Сохранение…' : 'Сменить пароль'}
            </Button>
            <p className="profile__hint">Минимальная длина пароля — 6 символов.</p>
          </form>
        </div>
      </section>
    </PageLayout>
  );
}

export default ProfilePage;
