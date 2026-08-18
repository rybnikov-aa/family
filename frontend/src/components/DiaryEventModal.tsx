import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  buildDiaryFormData,
  createDiaryEvent,
  diaryImageUrl,
  updateDiaryEvent,
  type DiaryEventDetail,
} from '../api/client';
import Modal from './Modal';
import Button from './Button';
import IconButton from './IconButton';
import ImmichPickerModal from './ImmichPickerModal';
import { CheckIcon, ImmichIcon, TrashIcon, UploadIcon } from './icons';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useImmichSettings } from '../hooks/useImmichSettings';
import { renderMarkdown } from '../utils/markdown';

interface DiaryEventModalProps {
  /** Редактируемое событие; `null` — создание нового. */
  event?: DiaryEventDetail | null;
  /** Закрыть форму без сохранения. */
  onClose: () => void;
  /** Вызывается после успешного сохранения (для обновления списка). */
  onSaved: () => void;
}

/** Изображение в форме: новое (с файлом) или уже сохранённое. */
interface FormImage {
  /** Клиентский id нового файла (`new-N`) либо имя существующего файла. */
  id: string;
  /** Новый файл для загрузки; `null` — уже сохранённое изображение. */
  file: File | null;
  /** Превью: object URL (новое) либо серверный URL (существующее). */
  preview: string;
}

/**
 * Форма добавления/редактирования события «Дневника» (admin).
 *
 * Поля: фотографии (загрузка нескольких), выбор основной фотографии (клик по
 * превью), название, дата (период дат), краткое описание, подробное описание
 * в markdown. Создание — `POST /api/diary`, редактирование — `PATCH /api/diary/:id`
 * (multipart: поля + новые файлы в `images`, сохраняемые имена — в `keep`,
 * обложка — в `cover`).
 */
function DiaryEventModal({ event = null, onClose, onSaved }: DiaryEventModalProps) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [dateStart, setDateStart] = useState(event?.dateStart ?? '');
  const [dateEnd, setDateEnd] = useState(event?.dateEnd ?? '');
  const [summary, setSummary] = useState(event?.summary ?? '');
  const [content, setContent] = useState(event?.content ?? '');
  // Изображения: существующие — из события, новые — добавляются при загрузке.
  const [images, setImages] = useState<FormImage[]>(() =>
    event
      ? event.images.map((name) => ({
          id: name,
          file: null,
          // Превью существующего изображения — уменьшенная копия с сервера.
          preview: diaryImageUrl(event.folder, name, true),
        }))
      : [],
  );
  const [cover, setCover] = useState<string | null>(() => event?.cover ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [descriptionEditorOpen, setDescriptionEditorOpen] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<
    Record<'info' | 'photos' | 'description', boolean>
  >({
    info: false,
    photos: false,
    description: false,
  });
  // Пикер фото из Immich (вариант B2): доступен, если инстанс настроен.
  const [pickerOpen, setPickerOpen] = useState(false);
  const immichUrl = useImmichSettings();

  // Счётчик клиентских id новых файлов + созданные object URL (для очистки).
  const newIdRef = useRef(0);
  const objectUrlsRef = useRef<string[]>([]);

  useEscapeClose(onClose);

  // Освобождаем object URL при размонтировании.
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);

  const handleFiles = (list: FileList | null) => {
    if (!list) return;
    addFiles(Array.from(list));
  };

  /** Добавляет файлы в список изображений формы (загрузка или пикер Immich). */
  const addFiles = (files: File[]) => {
    if (files.length === 0) return;
    const added: FormImage[] = files.map((file) => {
      const id = `new-${newIdRef.current++}`;
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.push(url);
      return { id, file, preview: url };
    });
    setImages((prev) => [...prev, ...added]);
    setCover((prev) => prev ?? added[0].id);
  };

  const removeImage = (id: string) => {
    const img = images.find((i) => i.id === id);
    if (!img) return;
    if (img.file) {
      URL.revokeObjectURL(img.preview);
      objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== img.preview);
    }
    const next = images.filter((i) => i.id !== id);
    setImages(next);
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    setContent((prev) =>
      prev.replace(new RegExp(`!\\[[^\\]]*\\]\\(diary-image:\\/\\/${escapedId}\\)`, 'g'), ''),
    );
    if (cover === id) setCover(next[0]?.id ?? null);
  };

  const contentImageNames = new Set(
    Array.from(
      content.matchAll(/!\[[^\]]*\]\(diary-image:\/\/([a-z0-9._-]+)\)/g),
      (match) => match[1],
    ),
  );
  const galleryImages = images.filter((img) => !contentImageNames.has(img.id));
  const resolveDiaryPreviewImage = (name: string) => {
    const direct = images.find((img) => img.id === name);
    if (direct) {
      return { src: direct.preview, href: direct.preview };
    }
    if (event?.folder) {
      return {
        src: diaryImageUrl(event.folder, name, true),
        href: diaryImageUrl(event.folder, name),
      };
    }
    return null;
  };

  const handleSubmit = async (eventForm: FormEvent) => {
    eventForm.preventDefault();
    if (submitting) return;

    if (!title.trim()) {
      setError('Укажите название события');
      return;
    }
    if (!dateStart) {
      setError('Укажите дату события');
      return;
    }
    if (dateEnd && dateEnd < dateStart) {
      setError('Дата окончания раньше даты начала');
      return;
    }
    if (!summary.trim()) {
      setError('Укажите краткое описание события');
      return;
    }

    const keep = images.filter((img) => img.file === null).map((img) => img.id);
    const formData = buildDiaryFormData({
      title: title.trim(),
      dateStart,
      dateEnd: dateEnd || null,
      summary: summary.trim(),
      content,
      cover,
      images: images.map((img) => ({ id: img.id, file: img.file })),
      keep,
    });

    setSubmitting(true);
    setError(null);
    const hasNewFiles = images.some((img) => img.file !== null);
    setUploadProgress(hasNewFiles ? 0 : null);

    try {
      if (event) {
        await updateDiaryEvent(event.id, formData, (percent) => {
          setUploadProgress((prev) => (prev === null ? 0 : percent));
        });
      } else {
        await createDiaryEvent(formData, (percent) => {
          setUploadProgress((prev) => (prev === null ? 0 : percent));
        });
      }
      setUploadProgress(null);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить событие');
      setUploadProgress(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Modal title={event ? 'Редактировать событие' : 'Добавить событие'} onClose={onClose} wide>
        <form className="vps-form" onSubmit={handleSubmit}>
          <section className="diary-form-section">
            <button
              type="button"
              className="diary-form-section__header diary-form-section__toggle"
              onClick={() => setCollapsedSections((prev) => ({ ...prev, info: !prev.info }))}
              aria-expanded={!collapsedSections.info}
            >
              <h4 className="diary-form-section__title">Основная информация</h4>
              <span className="diary-form-section__chevron" aria-hidden="true">
                {collapsedSections.info ? '＋' : '−'}
              </span>
            </button>
            {!collapsedSections.info && (
              <div className="diary-form-section__body">
                <label className="field">
                  <span className="field__label">Название события</span>
                  <input
                    className="input"
                    type="text"
                    autoComplete="off"
                    maxLength={120}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="напр. Поездка на дачу"
                    required
                  />
                </label>

                <div className="diary-dates">
                  <label className="field">
                    <span className="field__label">Дата начала</span>
                    <input
                      className="input"
                      type="date"
                      value={dateStart}
                      onChange={(event) => setDateStart(event.target.value)}
                      required
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Дата окончания (необязательно)</span>
                    <input
                      className="input"
                      type="date"
                      value={dateEnd}
                      onChange={(event) => setDateEnd(event.target.value)}
                    />
                  </label>
                </div>

                <label className="field">
                  <span className="field__label">Краткое описание</span>
                  <textarea
                    className="input"
                    rows={3}
                    maxLength={500}
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    placeholder="Краткое описание для карточки в разделе «Дневник»."
                    required
                  />
                </label>
              </div>
            )}
          </section>

          <section className="diary-form-section">
            <button
              type="button"
              className="diary-form-section__header diary-form-section__toggle"
              onClick={() => setCollapsedSections((prev) => ({ ...prev, photos: !prev.photos }))}
              aria-expanded={!collapsedSections.photos}
            >
              <h4 className="diary-form-section__title">Фотографии</h4>
              <span className="diary-form-section__chevron" aria-hidden="true">
                {collapsedSections.photos ? '＋' : '−'}
              </span>
            </button>
            {!collapsedSections.photos && (
              <div className="diary-form-section__body">
                <div className="field">
                  <div className="diary-photos">
                    {images.length === 0 && (
                      <div className="diary-photos__empty">Фотографии ещё не добавлены</div>
                    )}
                    {images.map((img) => {
                      const isInDescription = contentImageNames.has(img.id);
                      return (
                        <div
                          key={img.id}
                          className={`diary-photo${cover === img.id ? ' diary-photo--cover' : ''}${
                            isInDescription ? ' diary-photo--used' : ''
                          }`}
                        >
                          <button
                            type="button"
                            className="diary-photo__select"
                            aria-pressed={cover === img.id}
                            title="Сделать основной фотографией"
                            onClick={() => setCover(img.id)}
                          >
                            <img src={img.preview} alt="" />
                          </button>
                          {cover === img.id && (
                            <span className="diary-photo__badge">
                              <CheckIcon /> Обложка
                            </span>
                          )}
                          {isInDescription && <span className="diary-photo__used">В тексте</span>}
                          <span className="diary-photo__remove">
                            <IconButton
                              label="Удалить фотографию"
                              tooltip="Удалить"
                              size="sm"
                              plain
                              danger
                              onClick={() => removeImage(img.id)}
                            >
                              <TrashIcon />
                            </IconButton>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="diary-photos__actions">
                    <label className="btn btn--secondary diary-photos__add">
                      <span className="btn__icon" aria-hidden="true">
                        <UploadIcon />
                      </span>
                      <span>Добавить фото</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={(event) => handleFiles(event.target.files)}
                      />
                    </label>
                    {immichUrl && (
                      <Button
                        className="diary-photos__add"
                        icon={<ImmichIcon />}
                        onClick={() => setPickerOpen(true)}
                      >
                        Immich
                      </Button>
                    )}
                  </div>
                  <span className="field__hint">
                    Клик по фотографии — выбрать основную («Обложка»). JPG, PNG, WebP, GIF.
                  </span>
                </div>
              </div>
            )}
          </section>

          <section className="diary-form-section">
            <button
              type="button"
              className="diary-form-section__header diary-form-section__toggle"
              onClick={() =>
                setCollapsedSections((prev) => ({ ...prev, description: !prev.description }))
              }
              aria-expanded={!collapsedSections.description}
            >
              <h4 className="diary-form-section__title">Подробное описание</h4>
              <span className="diary-form-section__toggle-group">
                <span className="diary-form-section__chevron" aria-hidden="true">
                  {collapsedSections.description ? '＋' : '−'}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  className="diary-description-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setDescriptionEditorOpen(true);
                  }}
                >
                  Редактировать описание
                </Button>
              </span>
            </button>
            {!collapsedSections.description && (
              <div className="diary-form-section__body">
                {content.trim() ? (
                  <div className="diary-description-preview">
                    <div className="field__hint">
                      Содержимое добавлено и отображается в виде просмотра.
                    </div>
                    <div className="markdown diary-description-preview__content">
                      {renderMarkdown(content, (name) => resolveDiaryPreviewImage(name) ?? null)}
                    </div>
                    {galleryImages.length > 0 && (
                      <div className="diary-event__gallery-wrap diary-description-preview__gallery">
                        <div className="diary-event__gallery-header">
                          <h5 className="diary-event__gallery-title">Дополнительные фотографии</h5>
                          <span className="diary-event__gallery-line" aria-hidden="true" />
                        </div>
                        <div className="diary-event__gallery">
                          {galleryImages.map((img) => (
                            <a
                              key={img.id}
                              className="diary-event__photo"
                              href={img.preview}
                              target="_blank"
                              rel="noreferrer"
                              title="Открыть в полном размере"
                            >
                              <img src={img.preview} alt="" loading="lazy" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="field__hint">Текст ещё не добавлен.</div>
                )}
              </div>
            )}
          </section>

          {submitting && uploadProgress !== null && (
            <div className="diary-upload-progress" aria-live="polite" aria-atomic="true">
              <div className="diary-upload-progress__header">
                <span>Загрузка изображений</span>
                <span>{uploadProgress}%</span>
              </div>
              <div
                className="diary-upload-progress__track"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadProgress}
              >
                <span
                  className="diary-upload-progress__fill"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {error && <div className="alert alert--error">{error}</div>}

          <div className="vps-form__actions">
            <Button variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Сохранение…' : event ? 'Сохранить' : 'Добавить'}
            </Button>
          </div>
        </form>

        {/* Пикер фото из Immich (вариант B2): выбранные файлы — как обычные загрузки.
            Даты фильтра по умолчанию — из дат события (для нового события без дат — 3 месяца). */}
        {pickerOpen && (
          <ImmichPickerModal
            onClose={() => setPickerOpen(false)}
            onPick={(files) => addFiles(files)}
            defaultFrom={dateStart || undefined}
            defaultTo={dateEnd || dateStart || undefined}
          />
        )}
      </Modal>

      {descriptionEditorOpen && (
        <DiaryDescriptionEditorModal
          value={content}
          images={images}
          onClose={() => setDescriptionEditorOpen(false)}
          onSave={(nextContent) => {
            setContent(nextContent);
            setDescriptionEditorOpen(false);
          }}
        />
      )}
    </>
  );
}

interface DiaryDescriptionEditorModalProps {
  value: string;
  images: FormImage[];
  onClose: () => void;
  onSave: (nextContent: string) => void;
}

function DiaryDescriptionEditorModal({
  value,
  images,
  onClose,
  onSave,
}: DiaryDescriptionEditorModalProps) {
  const [draft, setDraft] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertImage = (image: FormImage) => {
    const textarea = textareaRef.current;
    const marker = `![Фото](diary-image://${image.id})\n`;
    const start = textarea?.selectionStart ?? draft.length;
    const end = textarea?.selectionEnd ?? draft.length;
    const nextContent = `${draft.slice(0, start)}${marker}${draft.slice(end)}`;
    setDraft(nextContent);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + marker.length, start + marker.length);
    });
  };

  const availableImages = images.filter(
    (image) =>
      !new RegExp(
        `!\\[[^\\]]*\\]\\(diary-image:\/\\/${image.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`,
      ).test(draft),
  );

  return (
    <Modal title="Подробное описание" onClose={onClose} wide>
      <div className="vps-form">
        <textarea
          ref={textareaRef}
          className="input input--area"
          rows={12}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="## День первый&#10;&#10;Подробный рассказ о событии: заголовки, списки, ссылки."
        />
        <span className="field__hint">
          Markdown: ## заголовки, **жирный**, *курсив*, - списки, [ссылки](url).
        </span>

        {availableImages.length > 0 && (
          <div className="diary-photos__insert">
            <span className="field__hint">Вставить фотографию в описание:</span>
            <div className="diary-photos__insert-list">
              {availableImages.map((img) => {
                const imageNumber = images.indexOf(img) + 1;
                return (
                  <button
                    key={`insert-${img.id}`}
                    type="button"
                    className="diary-photos__insert-item"
                    aria-label={`Вставить Фото ${imageNumber} в описание`}
                    onClick={() => insertImage(img)}
                  >
                    <span className="diary-photos__insert-label">Фото {imageNumber}</span>
                    <img src={img.preview} alt="" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="vps-form__actions">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => onSave(draft)}>
            Сохранить описание
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default DiaryEventModal;
