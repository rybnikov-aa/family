import type { ComponentType } from 'react';
import PageLayout from '../components/PageLayout';
import SectionCard from '../components/SectionCard';
import { FolderIcon, ProjectsIcon, RenovationIcon } from '../components/icons';
import type { IconProps } from '../components/icons';
import { useProjects } from '../hooks/useProjects';

/** Иконки проектов по имени из `<meta name="project-icon">` (см. `projects/_template`). */
const projectIcons: Record<string, ComponentType<IconProps>> = {
  renovation: RenovationIcon,
  folder: FolderIcon,
  projects: ProjectsIcon,
};

/**
 * Раздел «Проекты»: список отдельных подпроектов (подпапок на сервере
 * с `index.html`). Данные динамические — приходят с бэкенда (`GET /api/projects`).
 */
function ProjectsPage() {
  const { projects, error, loading } = useProjects();

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
                />
              );
            })}
          </div>
        )}
      </section>
    </PageLayout>
  );
}

export default ProjectsPage;
