import { useState, type ComponentType } from 'react';
import PageLayout from '../components/PageLayout';
import CreateProjectModal from '../components/CreateProjectModal';
import SectionCard from '../components/SectionCard';
import Button from '../components/Button';
import { FolderIcon, PlusIcon, ProjectsIcon, RenovationIcon } from '../components/icons';
import type { IconProps } from '../components/icons';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';

/** Иконки проектов по имени из `<meta name="project-icon">` (см. `projects/_template`). */
const projectIcons: Record<string, ComponentType<IconProps>> = {
  renovation: RenovationIcon,
  folder: FolderIcon,
  projects: ProjectsIcon,
};

/**
 * Раздел «Проекты»: список отдельных подпроектов. Данные динамические —
 * приходят с бэкенда (`GET /api/projects`): статичные проекты (подпапки
 * `PROJECTS_DIR` с `index.html`) + прикладные (SPA) проекты из реестра
 * `backend/src/config/appProjects.ts` (`kind: 'app'`, например «Ремонт»).
 * Для прикладных проектов бэкенд отдаёт внутренний маршрут (`/projects/renovation`),
 * который SectionCard рендерит как внутренний Link (hash-роутинг); статичные
 * (`/projects/<slug>/`) — как обычные ссылки.
 */
function ProjectsPage() {
  const { projects, error, loading, refresh } = useProjects();
  // Создание проекта — только для admin.
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <PageLayout>
      <section className="page">
        <div className="page__head">
          <span className="page__icon page__icon--projects">
            <ProjectsIcon />
          </span>
          <div>
            <h2>Проекты</h2>
            <div className="page__sub">Отдельные подпроекты: документация, отчёты и архивы</div>
          </div>
          {isAdmin && (
            <div className="page__head-actions">
              <Button variant="primary" icon={<PlusIcon />} onClick={() => setCreateOpen(true)}>
                Создать проект
              </Button>
            </div>
          )}
        </div>

        {error ? (
          <div className="news-empty">Не удалось загрузить проекты: {error}</div>
        ) : loading && projects.length === 0 ? (
          <div className="news-empty">Загрузка проектов…</div>
        ) : projects.length === 0 ? (
          <div className="news-empty">Проектов пока нет — загляните позже.</div>
        ) : (
          <div className="grid">
            {projects.map((project) => {
              const Icon = projectIcons[project.icon] ?? ProjectsIcon;
              return (
                <SectionCard
                  key={project.slug}
                  icon={Icon}
                  color={project.accent}
                  title={project.title}
                  description={project.description}
                  tag="→ открыть"
                  href={project.url}
                  wide
                />
              );
            })}
          </div>
        )}
      </section>

      {createOpen && (
        <CreateProjectModal onClose={() => setCreateOpen(false)} onCreated={refresh} />
      )}
    </PageLayout>
  );
}

export default ProjectsPage;
