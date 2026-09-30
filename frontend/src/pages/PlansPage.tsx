import { useMemo, useState } from 'react';
import PageLayout from '../components/PageLayout';
import Button from '../components/Button';
import IconButton from '../components/IconButton';
import PlanTaskModal from '../components/PlanTaskModal';
import { EditIcon, PlansIcon, PlusIcon, TrashIcon } from '../components/icons';
import { deletePlan, type PlanPriority, type PlanStatus, type PlanTask } from '../api/client';
import { usePlans } from '../hooks/usePlans';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';

const columns: { status: PlanStatus; title: string }[] = [
  { status: 'todo', title: 'К выполнению' },
  { status: 'doing', title: 'В работе' },
  { status: 'done', title: 'Готово' },
];

const priorityLabels: Record<PlanPriority, string> = {
  low: 'низкий',
  normal: 'обычный',
  high: 'высокий',
};

function PlansPage() {
  const { tasks, error, loading, refresh } = usePlans();
  const { projects } = useProjects();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [projectFilter, setProjectFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [editing, setEditing] = useState<PlanTask | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (!projectFilter || task.projectSlug === projectFilter) &&
          (!priorityFilter || task.priority === priorityFilter),
      ),
    [tasks, projectFilter, priorityFilter],
  );

  const remove = async (task: PlanTask) => {
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
    await deletePlan(task.id);
    refresh();
  };

  return (
    <PageLayout>
      <section className="page plans-page">
        <div className="page__head">
          <span className="page__icon page__icon--plans">
            <PlansIcon />
          </span>
          <div>
            <h2>Планы</h2>
            <div className="page__sub">Задачи, сроки и ближайшие шаги</div>
          </div>
          {isAdmin && (
            <div className="page__head-actions">
              <Button variant="primary" icon={<PlusIcon />} onClick={() => setCreateOpen(true)}>
                Новая задача
              </Button>
            </div>
          )}
        </div>
        <div className="plans-toolbar">
          <select
            className="input"
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          >
            <option value="">Все проекты</option>
            {projects.map((project) => (
              <option key={project.slug} value={project.slug}>
                {project.title}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          >
            <option value="">Все приоритеты</option>
            <option value="high">Высокий</option>
            <option value="normal">Обычный</option>
            <option value="low">Низкий</option>
          </select>
        </div>
        {error ? (
          <div className="news-empty">Не удалось загрузить планы: {error}</div>
        ) : loading && tasks.length === 0 ? (
          <div className="news-empty">Загрузка планов…</div>
        ) : (
          <div className="plans-board">
            {columns.map((column) => {
              const columnTasks = filtered.filter((task) => task.status === column.status);
              return (
                <section className="plans-column" key={column.status}>
                  <div className="plans-column__head">
                    <h3>{column.title}</h3>
                    <span>{columnTasks.length}</span>
                  </div>
                  {columnTasks.length === 0 ? (
                    <div className="plans-column__empty">Задач нет</div>
                  ) : (
                    columnTasks.map((task) => (
                      <article className={`plan-task plan-task--${task.priority}`} key={task.id}>
                        <div className="plan-task__head">
                          <h4>{task.title}</h4>
                          {isAdmin && (
                            <div className="plan-task__actions">
                              <IconButton
                                label="Редактировать"
                                tooltip="Редактировать"
                                size="sm"
                                plain
                                onClick={() => setEditing(task)}
                              >
                                <EditIcon />
                              </IconButton>
                              <IconButton
                                label="Удалить"
                                tooltip="Удалить"
                                size="sm"
                                plain
                                danger
                                onClick={() => void remove(task)}
                              >
                                <TrashIcon />
                              </IconButton>
                            </div>
                          )}
                        </div>
                        {task.description && <p>{task.description}</p>}
                        <div className="plan-task__meta">
                          <span
                            className={`badge badge--${task.priority === 'high' ? 'danger' : 'muted'}`}
                          >
                            {priorityLabels[task.priority]}
                          </span>
                          {task.dueDate && (
                            <time dateTime={task.dueDate}>
                              {new Date(`${task.dueDate}T00:00:00`).toLocaleDateString('ru-RU')}
                            </time>
                          )}
                          {task.projectTitle && <span>{task.projectTitle}</span>}
                        </div>
                      </article>
                    ))
                  )}
                </section>
              );
            })}
          </div>
        )}
      </section>
      {createOpen && (
        <PlanTaskModal projects={projects} onClose={() => setCreateOpen(false)} onSaved={refresh} />
      )}
      {editing && (
        <PlanTaskModal
          task={editing}
          projects={projects}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </PageLayout>
  );
}

export default PlansPage;
