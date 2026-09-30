import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { createNews, updateNews, type NewsPost } from '../api/client';

interface NewsAdminModalProps {
  post?: NewsPost | null;
  onClose: () => void;
  onSaved: () => void;
}

function localDateTime(value?: string): string {
  if (!value) return new Date().toISOString().slice(0, 16);
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function NewsAdminModal({ post = null, onClose, onSaved }: NewsAdminModalProps) {
  const [title, setTitle] = useState(post?.title ?? '');
  const [tag, setTag] = useState(post?.tag ?? '');
  const [text, setText] = useState(post?.text ?? '');
  const [publishAt, setPublishAt] = useState(localDateTime(post?.publishAt));
  const [pinned, setPinned] = useState(post?.pinned ?? false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input = { title, tag, text, publishAt, pinned, files };
      if (post) await updateNews(post.id, input);
      else await createNews(input);
      onSaved();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить новость');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={post ? 'Редактировать новость' : 'Новая новость'} onClose={onClose} wide>
      <form className="vps-form" onSubmit={(event) => void submit(event)}>
        {error && <div className="alert alert--error">{error}</div>}
        <label className="field">
          <span className="field__label">Заголовок</span>
          <input
            className="input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>
        <div className="diary-dates">
          <label className="field">
            <span className="field__label">Тег</span>
            <input
              className="input"
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              placeholder="раздел"
            />
          </label>
          <label className="field">
            <span className="field__label">Дата публикации</span>
            <input
              className="input"
              type="datetime-local"
              value={publishAt}
              onChange={(event) => setPublishAt(event.target.value)}
              required
            />
          </label>
        </div>
        <label className="field">
          <span className="field__label">Текст</span>
          <textarea
            className="input input--area"
            rows={8}
            value={text}
            onChange={(event) => setText(event.target.value)}
            required
          />
        </label>
        <label className="field__radio">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(event) => setPinned(event.target.checked)}
          />
          Закрепить новость
        </label>
        <label className="field">
          <span className="field__label">Фотографии</span>
          <input
            className="input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
        </label>
        {post && post.attachments.length > 0 && (
          <p className="field__hint">
            Существующие вложения сохраняются; новые будут добавлены к ним.
          </p>
        )}
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

export default NewsAdminModal;
