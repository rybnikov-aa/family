import { useState, type FormEvent } from 'react';
import { createProject } from '../api/client';
import Modal from './Modal';
import Button from './Button';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface CreateProjectModalProps {
  /** Закрыть форму без сохранения */
  onClose: () => void;
  /** Вызывается после успешного создания проекта (для обновления списка) */
  onCreated: () => void;
}

/** Допустимое имя папки проекта (slug): латиница, цифры, дефисы, без `_`/`.` в начале. */
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
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
 * Форма создания статичного проекта (кнопка «Создать проект», admin).
 *
 * Поля: имя (slug), название, описание, акцентный цвет, иконка, порядок.
 * `POST /api/projects` создаёт подпапку `PROJECTS_DIR/<slug>/` с `index.html`
 * из встроенного шаблона бэкенда; после успеха список проектов обновляется.
 */
function CreateProjectModal({ onClose, onCreated }: CreateProjectModalProps) {
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [icon, setIcon] = useState('projects');
  const [order, setOrder] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape закрывает модалку.
  useEscapeClose(onClose);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const slugValue = slug.trim();
    const titleValue = title.trim();
    const descriptionValue = description.trim();
    const accentValue = accent.trim();

    if (!SLUG_RE.test(slugValue)) {
      setError('Имя проекта — латиница, цифры и дефисы (например «dacha» или «trip-2026»).');
      return;
    }
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
      await createProject({
        slug: slugValue,
        title: titleValue,
        description: descriptionValue,
        accent: accentValue,
        icon,
        order: orderValue,
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать проект');
      setSubmitting(false);
    }
  };

  return (
    <Modal title="Создать проект" onClose={onClose}>
      <form className="vps-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Имя проекта (slug)</span>
          <input
            className="input"
            type="text"
            autoComplete="off"
            maxLength={50}
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder="напр. dacha"
            required
          />
          <span className="field__hint">
            Латиница, цифры и дефисы — это имя папки проекта на сайте (например, dacha).
          </span>
        </label>

        <label className="field">
          <span className="field__label">Название</span>
          <input
            className="input"
            type="text"
            autoComplete="off"
            maxLength={100}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="напр. Дача"
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
            placeholder="Краткое описание для карточки в разделе «Проекты»."
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
            {submitting ? 'Создание…' : 'Создать'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default CreateProjectModal;
