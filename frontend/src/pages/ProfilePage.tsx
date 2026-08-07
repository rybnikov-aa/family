import { useState, type FormEvent } from 'react';
import PageLayout from '../components/PageLayout';
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
            <span className="profile__role">
              {user.role === 'admin' ? 'админ' : 'пользователь'}
            </span>
          </div>

          <form onSubmit={onNameSubmit}>
            <label className="profile__field">
              <span className="profile__label">Отображаемое имя</span>
              <input
                className="profile__input"
                type="text"
                autoComplete="name"
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            {nameMessage && (
              <div className="profile__message" role="status">
                {nameMessage}
              </div>
            )}
            {nameError && (
              <div className="profile__error" role="alert">
                {nameError}
              </div>
            )}

            <button type="submit" className="profile__submit" disabled={nameSaving || !name.trim()}>
              {nameSaving ? 'Сохранение…' : 'Сохранить имя'}
            </button>
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
            <label className="profile__field">
              <span className="profile__label">Текущий пароль</span>
              <input
                className="profile__input"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </label>
            <label className="profile__field">
              <span className="profile__label">Новый пароль</span>
              <input
                className="profile__input"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {passwordMessage && (
              <div className="profile__message" role="status">
                {passwordMessage}
              </div>
            )}
            {passwordError && (
              <div className="profile__error" role="alert">
                {passwordError}
              </div>
            )}

            <button
              type="submit"
              className="profile__submit"
              disabled={passwordSaving || !currentPassword || password.length < 6}
            >
              {passwordSaving ? 'Сохранение…' : 'Сменить пароль'}
            </button>
            <p className="profile__hint">Минимальная длина пароля — 6 символов.</p>
          </form>
        </div>
      </section>
    </PageLayout>
  );
}

export default ProfilePage;
