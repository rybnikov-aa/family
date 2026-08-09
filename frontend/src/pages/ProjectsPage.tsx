import { useState } from 'react';
import PageLayout from '../components/PageLayout';
import CreateProjectModal from '../components/CreateProjectModal';
import ProjectEditModal from '../components/ProjectEditModal';
import SectionCard from '../components/SectionCard';
import IconButton from '../components/IconButton';
import Button from '../components/Button';
import { EditIcon, PlusIcon, ProjectsIcon, TrashIcon } from '../components/icons';
import { deleteProject, fetchProject, type Project, type ProjectDetail } from '../api/client';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';
import { projectIcons } from '../utils/projectIcons';

/**
 * Раздел «Проекты»: список отдельных подпроектов. Данные динамические —
 * приходят с бэкенда (`GET /api/projects`): встроенные (SPA) проекты из
 * реестра `backend/src/config/appProjects.ts` + созданные через UI записи БД.
 * Все проекты — прикладные (`kind: 'app'`), карточка ведёт в SPA-маршрут
 * `/projects/<slug>` (hash-роутинг). Создание/редактирование/удаление — admin.
 */
function ProjectsPage() {
  const { projects, error, loading, refresh } = useProjects();
  // Создание/редактирование/удаление — только для admin.
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectDetail | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Редактирование: нужны полные данные (контент) — запрашиваем отдельно.
  const handleEdit = async (project: Project) => {
    try {
      setEditing(await fetchProject(project.slug));
    } catch {
      /* модалка не откроется — список не трогаем */
    }
  };

  const handleDelete = async (project: Project) => {
    if (!window.confirm(`Удалить проект «${project.title}»? Действие необратимо.`)) return;
    setDeleting(project.slug);
    try {
      await deleteProject(project.slug);
      refresh();
    } finally {
      setDeleting(null);
    }
  };

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
              const Icon = projectIcons[project.icon] ?? projectIcons.projects;
              const actions =
                isAdmin && project.editable ? (
                  <div className="card-actions__buttons">
                    <IconButton
                      label={`Редактировать «${project.title}»`}
                      tooltip="Редактировать"
                      size="sm"
                      plain
                      onClick={() => void handleEdit(project)}
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      label={`Удалить «${project.title}»`}
                      tooltip="Удалить"
                      size="sm"
                      plain
                      danger
                      disabled={deleting === project.slug}
                      onClick={() => void handleDelete(project)}
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                ) : undefined;
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
                  actions={actions}
                />
              );
            })}
          </div>
        )}
      </section>

      {createOpen && (
        <CreateProjectModal onClose={() => setCreateOpen(false)} onCreated={refresh} />
      )}
      {editing && (
        <ProjectEditModal project={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      )}
    </PageLayout>
  );
}

export default ProjectsPage;
