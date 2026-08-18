import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  buildDiaryFormData,
  createDiaryEvent,
  diaryImageUrl,
  updateDiaryEvent,
  type DiaryEventDetail,
  type DiaryUploadProgress,
} from '../api/client';
import Modal from './Modal';
import Button from './Button';
import IconButton from './IconButton';
import ImmichPickerModal from './ImmichPickerModal';
import UploadProgress from './UploadProgress';
import { CheckIcon, ImmichIcon, TrashIcon, UploadIcon } from './icons';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useImmichSettings } from '../hooks/useImmichSettings';
import { useNavigate } from 'react-router-dom';

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
  const [uploadProgress, setUploadProgress] = useState<DiaryUploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
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
  const navigate = useNavigate();

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

  /** Открывает расширенный редактор описания: закрывает форму и ведёт на страницу. */
  const handleOpenEditor = () => {
    if (!event) return;
    onClose();
    navigate(`/diary/${event.id}/edit`);
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
    const newFiles = images.filter((img) => img.file !== null);
    setUploadProgress(
      newFiles.length > 0
        ? {
            currentIndex: 0,
            currentName: newFiles[0]?.file?.name ?? '',
            currentPercent: 0,
            overallPercent: 0,
            totalFiles: newFiles.length,
          }
        : null,
    );

    try {
      if (event) {
        await updateDiaryEvent(event.id, formData, (progress) => setUploadProgress(progress));
      } else {
        await createDiaryEvent(formData, (progress) => setUploadProgress(progress));
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
            <div className="diary-form-section__head">
              <button
                type="button"
                className="diary-form-section__header diary-form-section__toggle"
                onClick={() =>
                  setCollapsedSections((prev) => ({ ...prev, description: !prev.description }))
                }
                aria-expanded={!collapsedSections.description}
              >
                <h4 className="diary-form-section__title">Подробное описание</h4>
                <span className="diary-form-section__chevron" aria-hidden="true">
                  {collapsedSections.description ? '＋' : '−'}
                </span>
              </button>
              {event && (
                <Button
                  type="button"
                  variant="secondary"
                  className="diary-description-button"
                  onClick={handleOpenEditor}
                >
                  Открыть расширенный редактор
                </Button>
              )}
            </div>
            {!collapsedSections.description && (
              <div className="diary-form-section__body">
                {event ? (
                  <div className="field__hint">
                    {content.trim()
                      ? 'Подробное описание добавлено. Для вставки фотографий в текст и просмотра результата используйте расширенный редактор.'
                      : 'Подробное описание пока не добавлено. Расширенный редактор позволяет вставлять фотографии в текст и смотреть живой предпросмотр.'}
                  </div>
                ) : (
                  <>
                    <textarea
                      className="input"
                      rows={5}
                      value={content}
                      onChange={(descriptionEvent) => setContent(descriptionEvent.target.value)}
                      placeholder="## День первый&#10;&#10;Подробный рассказ о событии: заголовки, списки, ссылки."
                    />
                    <span className="field__hint">
                      Черновик подробного описания (markdown). Для вставки фотографий в текст после
                      сохранения события откройте расширенный редактор.
                    </span>
                  </>
                )}
              </div>
            )}
          </section>

          {submitting && uploadProgress !== null && <UploadProgress {...uploadProgress} />}

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
    </>
  );
}

export default DiaryEventModal;
