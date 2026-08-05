import { useEffect } from 'react';
import { Navigate, Outlet, RouterProvider, createHashRouter, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import NewsPage from './pages/NewsPage';
import ProjectsPage from './pages/ProjectsPage';
import { ROUTES } from './routes';

/** Устанавливает заголовок вкладки по текущему маршруту. */
function RouteLayout() {
  const location = useLocation();

  useEffect(() => {
    document.title =
      location.pathname === ROUTES.news
        ? 'Новости • family.rybnikov.su'
        : location.pathname === ROUTES.projects
          ? 'Проекты • family.rybnikov.su'
          : 'Семейное пространство • family.rybnikov.su';
  }, [location.pathname]);

  return <Outlet />;
}

const router = createHashRouter([
  {
    element: <RouteLayout />,
    children: [
      { path: ROUTES.home, element: <HomePage /> },
      { path: ROUTES.news, element: <NewsPage /> },
      { path: ROUTES.projects, element: <ProjectsPage /> },
      // Неизвестные пути (например, старый якорь #sections) — на главную.
      { path: '*', element: <Navigate to={ROUTES.home} replace /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
