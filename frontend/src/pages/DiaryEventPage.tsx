import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import DiaryEventModal from '../components/DiaryEventModal';
import DiaryPhotosModal from '../components/DiaryPhotosModal';
import ImmichPickerModal from '../components/ImmichPickerModal';
import IconButton from '../components/IconButton';
import { DiaryIcon, DocIcon, EditIcon, ImageIcon, ImagesIcon } from '../components/icons';
import { buildDiaryFormData, diaryImageUrl, updateDiaryEvent } from '../api/client';
import { useDiaryEvent } from '../hooks/useDiaryEvent';
import { useAuth } from '../hooks/useAuth';
import { useImmichSettings } from '../hooks/useImmichSettings';
import { stripDiaryImage } from '../utils/diaryImages';
import { renderMarkdown } from '../utils/markdown';
import { formatDateIso } from '../utils/money';
import type { FormImage } from '../types/diary';

/**
 * Страница события «Дневника» (`#/diary/:id`): hero-блок (превью обложки,
 * дата и краткое описание), подробное описание (markdown) и галерея фотографий.
 * Действия admin — кнопки-иконки: «карандаш», «описание», «Фотографии».
 */
function DiaryEventPage() {
  const params = useParams();
  const rawId = Number(params.id);
  const id = Number.isInteger(rawId) && rawId > 0 ? rawId : null;
  const { event, error, loading, reload } = useDiaryEvent(id);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const [photosOpen, setPhotosOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);
  const immichUrl = useImmichSettings();

  const dateLabel = event
    ? event.dateEnd
      ? `${formatDateIso(event.dateStart)} – ${formatDateIso(event.dateEnd)}`
      : formatDateIso(event.dateStart)
    : '';

  const contentImageNames = new Set(
    Array.from(
      event?.content.matchAll(/!\[[^\]]*\]\(diary-image:\/\/([a-z0-9._-]+)\)/g) ?? [],
      (match) => match[1],
    ),
  );
  const galleryImages = event ? event.images.filter((name) => !contentImageNames.has(name)) : [];

  /** Сохраняет изменения фотосета события (PATCH): добавление, смена обложки, удаление. */
  const savePhotos = async (changes: {
    extra?: { id: string; file: File }[];
    keep?: string[];
    content?: string;
    cover: string | null;
  }) => {
    if (!event || photoSaving) return;
    setPhotoSaving(true);
    try {
      const formData = buildDiaryFormData({
        title: event.title,
        dateStart: event.dateStart,
        dateEnd: event.dateEnd,
        summary: event.summary,
        content: changes.content ?? event.content,
        cover: changes.cover,
        images: [
          ...(changes.keep ?? event.images).map((name) => ({ id: name, file: null })),
          ...(changes.extra ?? []),
        ],
        keep: changes.keep ?? event.images,
      });
      await updateDiaryEvent(event.id, formData);
      reload();
    } catch {
      window.alert('Не удалось сохранить фотографии. Попробуйте ещё раз.');
    } finally {
      setPhotoSaving(false);
    }
  };

  const handleAddFiles = (files: File[]) => {
    if (!event) return;
    const extra = files.map((file, index) => ({ id: `new-${index}`, file }));
    void savePhotos({ extra, cover: event.cover });
  };

  const handleSelectCover = (id: string) => {
    void savePhotos({ cover: id });
  };

  const handleRemoveImage = (id: string) => {
    if (!event) return;
    // Фото добавлено в текст описания (бейдж «В тексте»): удаление вырежет маркер и из текста.
    if (contentImageNames.has(id)) {
      const proceed = window.confirm(
        'Фотография добавлена в текст описания и будет удалена и из текста. Удалить?',
      );
      if (!proceed) return;
    }
    const keep = event.images.filter((name) => name !== id);
    void savePhotos({
      keep,
      content: stripDiaryImage(event.content, id),
      cover: event.cover === id ? (keep[0] ?? null) : event.cover,
    });
  };

  return (
    <PageLayout>
      <section className="page">
        {loading ? (
          <div className="news-empty">Загрузка события…</div>
        ) : error ? (
          <div className="news-empty">Не удалось загрузить событие: {error}</div>
        ) : event ? (
          <>
            <div className="page__head diary-event__head">
              <span className="page__icon page__icon--diary">
                <DiaryIcon />
              </span>
              <div>
                <h2>{event.title}</h2>
              </div>
              {isAdmin && (
                <div className="page__head-actions">
                  <IconButton
                    label="Редактировать событие"
                    tooltip="Редактировать"
                    onClick={() => setEditOpen(true)}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    label="Редактировать описание"
                    tooltip="Редактировать описание"
                    onClick={() => navigate(`/diary/${event.id}/edit`)}
                  >
                    <DocIcon />
                  </IconButton>
                  <IconButton
                    label="Фотографии"
                    tooltip="Фотографии"
                    onClick={() => setPhotosOpen(true)}
                  >
                    <ImagesIcon />
                  </IconButton>
                </div>
              )}
            </div>

            <div className="diary-event__hero">
              {event.cover && (
                <a
                  className="diary-event__photo diary-event__hero-cover"
                  href={diaryImageUrl(event.folder, event.cover)}
                  target="_blank"
                  rel="noreferrer"
                  title="Открыть в полном размере"
                >
                  {/* Превью обложки; полный размер — по клику (открытие на весь экран). */}
                  <img src={diaryImageUrl(event.folder, event.cover, true)} alt={event.title} />
                </a>
              )}
              <div className="diary-event__hero-info">
                <span className="diary-pill">{dateLabel}</span>
                <p className="diary-event__summary">{event.summary}</p>
              </div>
            </div>

            {event.content.trim() === '' ? (
              <div className="news-empty">Подробное описание пока не добавлено.</div>
            ) : (
              <div className="markdown diary-event__content">
                {renderMarkdown(event.content, (name) => ({
                  src: diaryImageUrl(event.folder, name, true),
                  href: diaryImageUrl(event.folder, name),
                }))}
              </div>
            )}

            {galleryImages.length > 0 && (
              <div className="diary-event__gallery-wrap">
                <div className="diary-event__gallery-header">
                  <h3 className="diary-event__gallery-title">Фотографии</h3>
                  <span className="diary-event__gallery-line" aria-hidden="true" />
                </div>
                <div className="diary-event__gallery">
                  {galleryImages.map((name) => (
                    <a
                      key={name}
                      className="diary-event__photo"
                      href={diaryImageUrl(event.folder, name)}
                      target="_blank"
                      rel="noreferrer"
                      title="Открыть в полном размере"
                    >
                      {/* В галерее — превью; полный размер — только по клику (открытие на весь экран). */}
                      <img
                        src={diaryImageUrl(event.folder, name, true)}
                        alt={event.title}
                        loading="lazy"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {galleryImages.length === 0 && !event.cover && (
              <div className="diary-event__gallery-empty">
                <ImageIcon />
              </div>
            )}
          </>
        ) : null}
      </section>

      {editOpen && event && (
        <DiaryEventModal event={event} onClose={() => setEditOpen(false)} onSaved={reload} />
      )}

      {photosOpen && event && (
        <DiaryPhotosModal
          images={event.images.map((name): FormImage => ({
            id: name,
            file: null,
            preview: diaryImageUrl(event.folder, name, true),
          }))}
          cover={event.cover}
          usedImageNames={contentImageNames}
          immichAvailable={Boolean(immichUrl)}
          onClose={() => setPhotosOpen(false)}
          onAddFiles={handleAddFiles}
          onOpenImmich={() => setPickerOpen(true)}
          onSelectCover={handleSelectCover}
          onRemoveImage={handleRemoveImage}
          isForeground={!pickerOpen}
        />
      )}

      {pickerOpen && event && (
        <ImmichPickerModal
          onClose={() => setPickerOpen(false)}
          onPick={handleAddFiles}
          defaultFrom={event.dateStart || undefined}
          defaultTo={event.dateEnd || event.dateStart || undefined}
        />
      )}
    </PageLayout>
  );
}

export default DiaryEventPage;
