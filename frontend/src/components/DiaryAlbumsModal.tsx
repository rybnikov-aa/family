import { useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import IconButton from './IconButton';
import { PlusIcon, TrashIcon } from './icons';
import {
  createDiaryAlbum,
  deleteDiaryAlbum,
  updateDiaryAlbum,
  type DiaryAlbum,
  type DiaryEventSummary,
} from '../api/client';

interface DiaryAlbumsModalProps {
  albums: DiaryAlbum[];
  events: DiaryEventSummary[];
  onClose: () => void;
  onChanged: () => void;
}

function DiaryAlbumsModal({ albums, events, onClose, onChanged }: DiaryAlbumsModalProps) {
  const [selectedId, setSelectedId] = useState<number | null>(albums[0]?.id ?? null);
  const selected = albums.find((album) => album.id === selectedId) ?? null;
  const [title, setTitle] = useState(selected?.title ?? '');
  const [description, setDescription] = useState(selected?.description ?? '');
  const [eventIds, setEventIds] = useState<number[]>(selected?.eventIds ?? []);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(selected?.title ?? '');
    setDescription(selected?.description ?? '');
    setEventIds(selected?.eventIds ?? []);
    setCreating(false);
    setError(null);
  }, [selectedId]);

  const startCreate = () => {
    setSelectedId(null);
    setCreating(true);
    setTitle('');
    setDescription('');
    setEventIds([]);
    setError(null);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input = { title, description, eventIds };
      const saved = creating
        ? await createDiaryAlbum(input)
        : await updateDiaryAlbum(selectedId as number, input);
      setSelectedId(saved.id);
      setCreating(false);
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить альбом');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (
      !selected ||
      !window.confirm(`Удалить альбом «${selected.title}»? События останутся в дневнике.`)
    )
      return;
    try {
      await deleteDiaryAlbum(selected.id);
      setSelectedId(null);
      setCreating(false);
      onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось удалить альбом');
    }
  };

  return (
    <Modal title="Альбомы дневника" onClose={onClose} wide>
      <div className="diary-albums">
        <aside className="diary-albums__list">
          <Button variant="primary" icon={<PlusIcon />} onClick={startCreate}>
            Новый альбом
          </Button>
          {albums.map((album) => (
            <button
              className={`diary-albums__item${album.id === selectedId ? ' diary-albums__item--active' : ''}`}
              type="button"
              key={album.id}
              onClick={() => setSelectedId(album.id)}
            >
              {album.title}
              <small>{album.eventIds.length} событий</small>
            </button>
          ))}
          {albums.length === 0 && <p className="diary-albums__empty">Альбомов пока нет.</p>}
        </aside>
        {(creating || selected) && (
          <form className="diary-albums__form" onSubmit={(event) => void save(event)}>
            <div className="diary-albums__form-head">
              <h4>{creating ? 'Новый альбом' : 'Редактировать альбом'}</h4>
              {selected && (
                <IconButton
                  label="Удалить альбом"
                  tooltip="Удалить альбом"
                  danger
                  onClick={() => void remove()}
                >
                  <TrashIcon />
                </IconButton>
              )}
            </div>
            {error && <div className="alert alert--error">{error}</div>}
            <label className="field">
              <span className="field__label">Название</span>
              <input
                className="input"
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
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <div className="diary-albums__events">
              <span className="field__label">События</span>
              {events.map((event) => (
                <label className="diary-albums__event" key={event.id}>
                  <input
                    type="checkbox"
                    checked={eventIds.includes(event.id)}
                    onChange={() =>
                      setEventIds((current) =>
                        current.includes(event.id)
                          ? current.filter((id) => id !== event.id)
                          : [...current, event.id],
                      )
                    }
                  />
                  {event.title}
                </label>
              ))}
            </div>
            <div className="vps-form__actions">
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? 'Сохранение…' : 'Сохранить'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}

export default DiaryAlbumsModal;
