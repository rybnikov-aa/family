import { useEffect, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import StatusCard from './StatusCard';
import ThemeToggle from './ThemeToggle';
import { ROUTES } from '../routes';
import { useHealth } from '../hooks/useHealth';

interface PageLayoutProps {
  children: ReactNode;
}

function PageLayout({ children }: PageLayoutProps) {
  const { error, loading } = useHealth();
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
            <span>•</span>
          </h1>
          <div className="sub">family.rybnikov.su</div>
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
            <a href="/renovation/" className="renov-link">
              Ремонт
            </a>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      {children}

      <footer className="footer">
        <span className="copy">© 2026 family.rybnikov.su</span>
        <span className="footer-status">
          <StatusCard label="фронтенд" value={frontendValue} tone={frontendTone} />
          <StatusCard label="бэкенд" value={backendValue} tone={backendTone} />
        </span>
        <span>
          <a href="/renovation/">Ремонт</a>
          <Link to={ROUTES.home}>Дневник</Link>
          <Link to={ROUTES.news}>Новости</Link>
          <a href="https://immich.rybnikov-aa-home.netcraze.link/">Архив</a>
        </span>
      </footer>
    </div>
  );
}

export default PageLayout;
