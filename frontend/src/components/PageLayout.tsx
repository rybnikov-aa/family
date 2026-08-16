import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import StatusCard from './StatusCard';
import ThemeToggle from './ThemeToggle';
import IconButton from './IconButton';
import { LogoutIcon, UserIcon, UsersIcon } from './icons';
import { ROUTES } from '../routes';
import { useHealth } from '../hooks/useHealth';
import { useAuth } from '../hooks/useAuth';
import { APP_DOMAIN } from '../utils/brand';

interface PageLayoutProps {
  children: ReactNode;
}

function PageLayout({ children }: PageLayoutProps) {
  const { error, loading } = useHealth();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Фронтенд считается работоспособным, пока страница отрисована.
  const frontendValue = 'online';
  const frontendTone = 'ok';

  const backendValue = error ? 'офлайн' : loading ? 'проверка…' : 'online';
  const backendTone = error ? 'error' : loading ? 'muted' : 'ok';

  // Скролл при смене маршрута: на главную — к разделам, если запрошено, иначе наверх.
  useEffect(() => {
    if ((location.state as { scrollToSections?: boolean } | null)?.scrollToSections) {
      document.getElementById('sections')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);

  const goToSections = () => {
    if (location.pathname === ROUTES.home) {
      document.getElementById('sections')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(ROUTES.home, { state: { scrollToSections: true } });
    }
  };

  return (
    <div className="container">
      <header className="header">
        <Link to={ROUTES.home} className="brand">
          <h1>
            <span className="brand-mark">
              <UsersIcon width="3rem" height="3rem" />
            </span>
          </h1>
        </Link>
        <div className="header-actions">
          <nav className="nav">
            <NavLink
              to={ROUTES.home}
              end
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              Главная
            </NavLink>
            <button type="button" className="nav-anchor" onClick={goToSections}>
              Разделы
            </button>
            <NavLink
              to={ROUTES.news}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              Новости
            </NavLink>
            <NavLink
              to={ROUTES.diary}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              Дневник
            </NavLink>
            <NavLink
              to={ROUTES.projects}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              Проекты
            </NavLink>
          </nav>
          {user && (
            <div className="user">
              <UserIcon className="user__icon" width="1rem" height="1rem" />
              <Link to={ROUTES.profile} className="user__name" title="Профиль">
                {user.name}
              </Link>
              {user.role === 'admin' && (
                <Link
                  to={ROUTES.adminUsers}
                  className="badge badge--link"
                  title="Управление пользователями"
                >
                  админ
                </Link>
              )}
              <IconButton label="Выйти" tooltip="Выйти" onClick={() => void logout()}>
                <LogoutIcon />
              </IconButton>
            </div>
          )}
          <ThemeToggle />
        </div>
      </header>

      {children}

      <footer className="footer">
        <span className="copy">© 2026 {APP_DOMAIN}</span>
        <span className="footer-status">
          <StatusCard label="фронтенд" value={frontendValue} tone={frontendTone} />
          <StatusCard label="бэкенд" value={backendValue} tone={backendTone} />
        </span>
        <span>
          <Link to={ROUTES.diary}>Дневник</Link>
          <Link to={ROUTES.news}>Новости</Link>
          <Link to={ROUTES.projects}>Проекты</Link>
          <a href="https://immich.rybnikov-aa-home.netcraze.link/">Архив</a>
        </span>
      </footer>
    </div>
  );
}

export default PageLayout;
