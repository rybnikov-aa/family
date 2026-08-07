import { useEffect } from 'react';
import { Navigate, Outlet, RouterProvider, createHashRouter, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import NewsPage from './pages/NewsPage';
import ProjectsPage from './pages/ProjectsPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import { ROUTES } from './routes';
import { useAuth } from './hooks/useAuth';

/** Устанавливает заголовок вкладки по текущему маршруту. */
function RouteLayout() {
  const location = useLocation();

  useEffect(() => {
    document.title =
      location.pathname === ROUTES.news
        ? 'Новости • family.rybnikov.su'
        : location.pathname === ROUTES.projects
          ? 'Проекты • family.rybnikov.su'
          : location.pathname === ROUTES.profile
            ? 'Профиль • family.rybnikov.su'
            : 'Семейное пространство • family.rybnikov.su';
  }, [location.pathname]);

  return <Outlet />;
}

/** Экран-заглушка на время проверки сессии при старте. */
function AuthLoading() {
  return <div className="auth-loading">Загрузка…</div>;
}

/**
 * Гейт авторизации: пока сессия не подтверждена — экран входа,
 * иначе — приложение (весь портал закрыт авторизацией).
 */
function AuthGate() {
  const { user, loading } = useAuth();
  if (loading) return <AuthLoading />;
  return user ? <Outlet /> : <LoginPage />;
}

const router = createHashRouter([
  {
    element: <AuthGate />,
    children: [
      {
        element: <RouteLayout />,
        children: [
          { path: ROUTES.home, element: <HomePage /> },
          { path: ROUTES.news, element: <NewsPage /> },
          { path: ROUTES.projects, element: <ProjectsPage /> },
          { path: ROUTES.profile, element: <ProfilePage /> },
          // Неизвестные пути (например, старый якорь #sections) — на главную.
          { path: '*', element: <Navigate to={ROUTES.home} replace /> },
        ],
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
