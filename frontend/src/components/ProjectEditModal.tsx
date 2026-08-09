import { useState, type FormEvent } from 'react';
import { updateProject, type ProjectDetail } from '../api/client';
import Modal from './Modal';
import Button from './Button';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface ProjectEditModalProps {
  /** Проект для редактирования (только созданные через UI — `editable`). */
  project: ProjectDetail;
  /** Закрыть форму без сохранения. */
  onClose: () => void;
  /** Вызывается после успешного сохранения (для обновления страницы/списка). */
  onSaved: () => void;
}

/** Допустимый акцентный цвет (`#RRGGBB`). */
const ACCENT_RE = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_ACCENT = '#3b82f6';

/** Иконки карточки проекта (маппятся в `projectIcons` на странице «Проекты»). */
const PROJECT_ICONS = [
  { value: 'projects', label: 'Проекты' },
  { value: 'folder', label: 'Папка' },
  { value: 'renovation', label: 'Ремонт' },
];

/**
 * Форма редактирования проекта (admin): метаданные + markdown-контент страницы.
 * `PATCH /api/projects/:slug` — slug менять нельзя (имя проекта неизменно).
 */
function ProjectEditModal({ project, onClose, onSaved }: ProjectEditModalProps) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [accent, setAccent] = useState(project.accent);
  const [icon, setIcon] = useState(project.icon);
  const [order, setOrder] = useState(
    project.order === Number.MAX_SAFE_INTEGER ? '' : String(project.order),
  );
  const [content, setContent] = useState(project.content);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape закрывает модалку.
  useEscapeClose(onClose);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const titleValue = title.trim();
    const descriptionValue = description.trim();
    const accentValue = accent.trim();

    if (!titleValue) {
      setError('Укажите название проекта');
      return;
    }
    if (!descriptionValue) {
      setError('Укажите описание проекта');
      return;
    }
    if (!ACCENT_RE.test(accentValue)) {
      setError('Акцентный цвет должен быть в формате #RRGGBB');
      return;
    }

    const orderValue = order.trim() === '' ? undefined : Number(order);

    setSubmitting(true);
    setError(null);
    try {
      await updateProject(project.slug, {
        slug: project.slug,
        title: titleValue,
        description: descriptionValue,
        accent: accentValue,
        icon,
        order: orderValue,
        content,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить проект');
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Редактировать «${project.title}»`} onClose={onClose}>
      <form className="vps-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Название</span>
          <input
            className="input"
            type="text"
            autoComplete="off"
            maxLength={100}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Описание</span>
          <textarea
            className="input"
            rows={3}
            maxLength={300}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
          />
        </label>

        <label className="field">
          <span className="field__label">Акцентный цвет карточки</span>
          <div className="project-accent__row">
            <input
              className="project-accent__picker"
              type="color"
              value={ACCENT_RE.test(accent) ? accent : DEFAULT_ACCENT}
              onChange={(event) => setAccent(event.target.value)}
              aria-label="Выбрать акцентный цвет"
            />
            <input
              className="input"
              type="text"
              value={accent}
              onChange={(event) => setAccent(event.target.value)}
              placeholder="#3b82f6"
              maxLength={7}
            />
          </div>
        </label>

        <label className="field">
          <span className="field__label">Иконка</span>
          <select className="input" value={icon} onChange={(event) => setIcon(event.target.value)}>
            {PROJECT_ICONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">Порядок в списке (необязательно)</span>
          <input
            className="input"
            type="number"
            min={0}
            value={order}
            onChange={(event) => setOrder(event.target.value)}
            placeholder="Пусто — в конец списка"
          />
        </label>

        <label className="field">
          <span className="field__label">Контент страницы (markdown)</span>
          <textarea
            className="input input--area"
            rows={10}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="## Раздел&#10;&#10;Текст проекта в формате markdown: заголовки, списки, ссылки."
          />
          <span className="field__hint">
            Markdown: ## заголовки, **жирный**, *курсив*, - списки, [ссылки](url).
          </span>
        </label>

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        <div className="vps-form__actions">
          <Button onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default ProjectEditModal;
