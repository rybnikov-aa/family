import { useEffect, useState, type FormEvent } from 'react';
import ThemeToggle from '../components/ThemeToggle';
import Button from '../components/Button';
import { LockIcon, UsersIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';
import { pageTitle } from '../utils/brand';

/** Экран входа: весь портал закрыт авторизацией. */
function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = pageTitle('Вход');
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      await login(username.trim(), password);
      // При успехе AuthProvider обновляет состояние, и роутер показывает приложение.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
      setSubmitting(false);
    }
  };

  return (
    <div className="login">
      <div className="login__theme">
        <ThemeToggle />
      </div>
      <div className="login__card">
        <div className="login__brand">
          <span className="login__brand-mark">
            <LockIcon width="2.2rem" height="2.2rem" />
          </span>
        </div>
        <h2 className="login__title">Семейное пространство</h2>
        <p className="login__sub">Вход для членов семьи</p>

        <form className="login__form" onSubmit={onSubmit}>
          <label className="field">
            <span className="field__label">Имя пользователя</span>
            <input
              className="input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="field">
            <span className="field__label">Пароль</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && (
            <div className="alert alert--error" role="alert">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !username.trim() || !password}
          >
            {submitting ? 'Вход…' : 'Войти'}
          </Button>
        </form>

        <div className="login__footer">
          <UsersIcon />
          Приватное пространство семьи
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
