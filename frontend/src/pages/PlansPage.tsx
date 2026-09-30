import { useMemo, useState } from 'react';
import PageLayout from '../components/PageLayout';
import Button from '../components/Button';
import IconButton from '../components/IconButton';
import PlanTaskModal from '../components/PlanTaskModal';
import {
  CalendarIcon,
  EditIcon,
  ListViewIcon,
  PlansIcon,
  PlusIcon,
  TrashIcon,
} from '../components/icons';
import {
  deletePlan,
  updatePlan,
  type PlanPriority,
  type PlanStatus,
  type PlanTask,
} from '../api/client';
import { usePlans } from '../hooks/usePlans';
import { useProjects } from '../hooks/useProjects';
import { useAuth } from '../hooks/useAuth';
import { usePlanReminders } from '../hooks/usePlanReminders';

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
const statusLabels: Record<PlanStatus, string> = {
  todo: 'К выполнению',
  doing: 'В работе',
  done: 'Готово',
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
  const [view, setView] = useState<'board' | 'list' | 'calendar'>('board');
  const [changingStatus, setChangingStatus] = useState<number | null>(null);
  const { permission, supported, enable } = usePlanReminders(tasks);

  const filtered = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (!projectFilter || task.projectSlug === projectFilter) &&
          (!priorityFilter || task.priority === priorityFilter),
      ),
    [tasks, projectFilter, priorityFilter],
  );

  const overdue = (task: PlanTask) =>
    Boolean(
      task.dueDate &&
      task.status !== 'done' &&
      task.dueDate < new Date().toISOString().slice(0, 10),
    );
  const calendarDays = useMemo(() => {
    const now = new Date();
    const count = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return Array.from({ length: count }, (_, index) => {
      const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
      return { day, tasks: filtered.filter((task) => task.dueDate === day) };
    });
  }, [filtered]);

  const remove = async (task: PlanTask) => {
    if (!window.confirm(`Удалить задачу «${task.title}»?`)) return;
    await deletePlan(task.id);
    refresh();
  };

  const changeStatus = async (task: PlanTask, status: PlanStatus) => {
    if (status === task.status) return;
    setChangingStatus(task.id);
    try {
      await updatePlan(task.id, {
        title: task.title,
        description: task.description,
        status,
        priority: task.priority,
        dueDate: task.dueDate,
        projectSlug: task.projectSlug,
        recurrence: task.recurrence,
      });
      refresh();
    } finally {
      setChangingStatus(null);
    }
  };

  const renderTask = (task: PlanTask) => (
    <article
      className={`plan-task plan-task--${task.priority}${overdue(task) ? ' plan-task--overdue' : ''}`}
      key={task.id}
    >
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
        {isAdmin ? (
          <select
            className="plan-task__status"
            value={task.status}
            disabled={changingStatus === task.id}
            aria-label={`Статус задачи «${task.title}»`}
            onChange={(event) => void changeStatus(task, event.target.value as PlanStatus)}
          >
            {columns.map((column) => (
              <option key={column.status} value={column.status}>
                {column.title}
              </option>
            ))}
          </select>
        ) : (
          <span className="badge badge--muted">{statusLabels[task.status]}</span>
        )}
        <span className={`badge badge--${task.priority === 'high' ? 'danger' : 'muted'}`}>
          {priorityLabels[task.priority]}
        </span>
        {task.dueDate && <time dateTime={task.dueDate}>{task.dueDate}</time>}
        {task.projectTitle && <span>{task.projectTitle}</span>}
        {task.recurrence !== 'none' && <span>повторяется</span>}
      </div>
    </article>
  );

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
          <div className="diary-layout-toggle" role="group" aria-label="Режим планов">
            <IconButton
              label="Доска"
              tooltip="Доска"
              size="sm"
              plain={view !== 'board'}
              active={view === 'board'}
              onClick={() => setView('board')}
            >
              <PlansIcon />
            </IconButton>
            <IconButton
              label="Список"
              tooltip="Список"
              size="sm"
              plain={view !== 'list'}
              active={view === 'list'}
              onClick={() => setView('list')}
            >
              <ListViewIcon />
            </IconButton>
            <IconButton
              label="Календарь"
              tooltip="Календарь"
              size="sm"
              plain={view !== 'calendar'}
              active={view === 'calendar'}
              onClick={() => setView('calendar')}
            >
              <CalendarIcon />
            </IconButton>
          </div>
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
          {supported && permission !== 'granted' && (
            <Button onClick={() => void enable()}>Включить напоминания</Button>
          )}
        </div>
        {error ? (
          <div className="news-empty">Не удалось загрузить планы: {error}</div>
        ) : loading && tasks.length === 0 ? (
          <div className="news-empty">Загрузка планов…</div>
        ) : view === 'calendar' ? (
          <div className="plans-calendar">
            <div className="plans-calendar__head">
              {new Date().toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
            </div>
            <div className="plans-calendar__grid">
              {calendarDays.map(({ day, tasks: dayTasks }) => (
                <div className="plans-calendar__day" key={day}>
                  <time>{Number(day.slice(-2))}</time>
                  {dayTasks.map((task) => (
                    <div
                      className={`plans-calendar__task${overdue(task) ? ' plans-calendar__task--overdue' : ''}`}
                      key={task.id}
                    >
                      {task.title}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : view === 'list' ? (
          <div className="plans-list">{filtered.map(renderTask)}</div>
        ) : (
          <div className="plans-board">
            {columns.map((column) => (
              <section className="plans-column" key={column.status}>
                <div className="plans-column__head">
                  <h3>{column.title}</h3>
                  <span>{filtered.filter((task) => task.status === column.status).length}</span>
                </div>
                {filtered.filter((task) => task.status === column.status).map(renderTask)}
              </section>
            ))}
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
