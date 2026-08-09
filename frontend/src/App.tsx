import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Outlet, RouterProvider, createHashRouter, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import NewsPage from './pages/NewsPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectPage from './pages/ProjectPage';
import LoginPage from './pages/LoginPage';
// Тяжёлые страницы (с модалками/отчётами) грузим лениво — отдельные чанки.
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const RenovationPage = lazy(() => import('./pages/RenovationPage'));
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
          : location.pathname === ROUTES.renovation
            ? 'Ремонт • family.rybnikov.su'
            : location.pathname.startsWith('/projects/')
              ? 'Проект • family.rybnikov.su'
              : location.pathname === ROUTES.profile
                ? 'Профиль • family.rybnikov.su'
                : location.pathname === ROUTES.adminUsers
                  ? 'Пользователи • family.rybnikov.su'
                  : 'Семейное пространство • family.rybnikov.su';
  }, [location.pathname]);

  // Ленивые страницы ждут чанк — показываем заглушку.
  return (
    <Suspense fallback={<div className="route-loading">Загрузка…</div>}>
      <Outlet />
    </Suspense>
  );
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

/** Гейт роли: админ-разделы доступны только пользователям с ролью `admin`. */
function AdminGate() {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to={ROUTES.home} replace />;
  return <Outlet />;
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
          { path: ROUTES.renovation, element: <RenovationPage /> },
          // Страница прикладного проекта (статические пути, например renovation, выше).
          { path: ROUTES.project, element: <ProjectPage /> },
          { path: ROUTES.profile, element: <ProfilePage /> },
          // Админ-разделы: доступны только роли `admin` (иначе — на главную).
          {
            element: <AdminGate />,
            children: [{ path: ROUTES.adminUsers, element: <AdminUsersPage /> }],
          },
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
