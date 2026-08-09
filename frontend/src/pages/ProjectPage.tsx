import { useState, type CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import ProjectEditModal from '../components/ProjectEditModal';
import Button from '../components/Button';
import { EditIcon } from '../components/icons';
import { useProject } from '../hooks/useProject';
import { useAuth } from '../hooks/useAuth';
import { renderMarkdown } from '../utils/markdown';
import { projectIcons } from '../utils/projectIcons';

/**
 * Страница прикладного проекта (`#/projects/:slug`): заголовок с акцентным
 * цветом + markdown-контент из БД. Созданные через UI проекты доступны
 * администратору для редактирования (метаданные + контент).
 */
function ProjectPage() {
  const { slug = '' } = useParams();
  const { project, error, loading, reload } = useProject(slug);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [editOpen, setEditOpen] = useState(false);

  const Icon = project
    ? (projectIcons[project.icon] ?? projectIcons.projects)
    : projectIcons.projects;

  return (
    <PageLayout>
      <section className="page">
        {loading ? (
          <div className="news-empty">Загрузка проекта…</div>
        ) : error ? (
          <div className="news-empty">Не удалось загрузить проект: {error}</div>
        ) : project ? (
          <>
            <div
              className="page__head project-page__head"
              style={{ '--accent': project.accent } as CSSProperties}
            >
              <span className="page__icon" style={{ color: project.accent }}>
                <Icon />
              </span>
              <div>
                <h2>{project.title}</h2>
                <div className="page__sub">{project.description}</div>
              </div>
              {isAdmin && project.editable && (
                <div className="page__head-actions">
                  <Button variant="secondary" icon={<EditIcon />} onClick={() => setEditOpen(true)}>
                    Редактировать
                  </Button>
                </div>
              )}
            </div>

            {project.content.trim() === '' ? (
              <div className="news-empty">Контент пока не добавлен.</div>
            ) : (
              <div className="markdown" style={{ '--accent': project.accent } as CSSProperties}>
                {renderMarkdown(project.content)}
              </div>
            )}
          </>
        ) : null}
      </section>

      {editOpen && project && (
        <ProjectEditModal project={project} onClose={() => setEditOpen(false)} onSaved={reload} />
      )}
    </PageLayout>
  );
}

export default ProjectPage;
