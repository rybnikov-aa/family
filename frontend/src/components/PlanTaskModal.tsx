import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { createPlan, updatePlan, type PlanTask, type PlanTaskInput } from '../api/client';

interface PlanTaskModalProps {
  task?: PlanTask | null;
  projects: { slug: string; title: string }[];
  onClose: () => void;
  onSaved: () => void;
}

function PlanTaskModal({ task, projects, onClose, onSaved }: PlanTaskModalProps) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [status, setStatus] = useState(task?.status ?? 'todo');
  const [priority, setPriority] = useState(task?.priority ?? 'normal');
  const [recurrence, setRecurrence] = useState(task?.recurrence ?? 'none');
  const [dueDate, setDueDate] = useState(task?.dueDate ?? '');
  const [projectSlug, setProjectSlug] = useState(task?.projectSlug ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const input: PlanTaskInput = {
      title,
      description,
      status,
      priority,
      recurrence,
      dueDate: dueDate || null,
      projectSlug: projectSlug || null,
    };
    try {
      if (task) await updatePlan(task.id, input);
      else await createPlan(input);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить задачу');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={task ? 'Изменить задачу' : 'Новая задача'} onClose={onClose}>
      <form className="vps-form" onSubmit={(event) => void submit(event)}>
        {error && <div className="alert alert--error">{error}</div>}
        <label className="field">
          <span className="field__label">Название</span>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            autoFocus
            required
          />
        </label>
        <label className="field">
          <span className="field__label">Описание</span>
          <textarea
            className="input input--area"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="plans-form__grid">
          <label className="field">
            <span className="field__label">Статус</span>
            <select
              className="input"
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
            >
              <option value="todo">К выполнению</option>
              <option value="doing">В работе</option>
              <option value="done">Готово</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">Приоритет</span>
            <select
              className="input"
              value={priority}
              onChange={(event) => setPriority(event.target.value as typeof priority)}
            >
              <option value="low">Низкий</option>
              <option value="normal">Обычный</option>
              <option value="high">Высокий</option>
            </select>
          </label>
        </div>
        <label className="field">
          <span className="field__label">Повторение</span>
          <select
            className="input"
            value={recurrence}
            onChange={(event) => setRecurrence(event.target.value as typeof recurrence)}
          >
            <option value="none">Не повторять</option>
            <option value="daily">Каждый день</option>
            <option value="weekly">Каждую неделю</option>
            <option value="monthly">Каждый месяц</option>
          </select>
        </label>
        <div className="plans-form__grid">
          <label className="field">
            <span className="field__label">Срок</span>
            <input
              className="input"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Проект</span>
            <select
              className="input"
              value={projectSlug}
              onChange={(event) => setProjectSlug(event.target.value)}
            >
              <option value="">Без проекта</option>
              {projects.map((project) => (
                <option key={project.slug} value={project.slug}>
                  {project.title}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="vps-form__actions">
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default PlanTaskModal;
