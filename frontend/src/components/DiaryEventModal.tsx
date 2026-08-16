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
import { CheckIcon, TrashIcon, UploadIcon } from './icons';
import { useEscapeClose } from '../hooks/useEscapeClose';

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
  const contentRef = useRef<HTMLTextAreaElement>(null);
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
  const [error, setError] = useState<string | null>(null);

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
    const files = Array.from(list);
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

  const insertImage = (image: FormImage) => {
    const textarea = contentRef.current;
    const marker = `![Фото](diary-image://${image.id})`;
    const start = textarea?.selectionStart ?? content.length;
    const end = textarea?.selectionEnd ?? content.length;
    const nextContent = `${content.slice(0, start)}${marker}${content.slice(end)}`;
    setContent(nextContent);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + marker.length, start + marker.length);
    });
  };

  const insertedImageIds = new Set(
    Array.from(
      content.matchAll(/!\[[^\]]*\]\(diary-image:\/\/([a-z0-9._-]+)\)/g),
      (match) => match[1],
    ),
  );
  const availableImages = images.filter((image) => !insertedImageIds.has(image.id));

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
    try {
      if (event) {
        await updateDiaryEvent(event.id, formData);
      } else {
        await createDiaryEvent(formData);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить событие');
      setSubmitting(false);
    }
  };

  return (
    <Modal title={event ? 'Редактировать событие' : 'Добавить событие'} onClose={onClose} wide>
      <form className="vps-form" onSubmit={handleSubmit}>
        <label className="field">
          <span className="field__label">Фотографии</span>
          <div className="diary-photos">
            {images.length === 0 && (
              <div className="diary-photos__empty">Фотографии ещё не добавлены</div>
            )}
            {images.map((img) => (
              <div
                key={img.id}
                className={`diary-photo${cover === img.id ? ' diary-photo--cover' : ''}`}
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
            ))}
          </div>
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
          <span className="field__hint">
            Клик по фотографии — выбрать основную («Обложка»). JPG, PNG, WebP, GIF.
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
        </label>

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

        <label className="field">
          <span className="field__label">Подробное описание (markdown)</span>
          <textarea
            ref={contentRef}
            className="input input--area"
            rows={8}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="## День первый&#10;&#10;Подробный рассказ о событии: заголовки, списки, ссылки."
          />
          <span className="field__hint">
            Markdown: ## заголовки, **жирный**, *курсив*, - списки, [ссылки](url). Фотографии
            вставляются кнопками выше.
          </span>
        </label>

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
    </Modal>
  );
}

export default DiaryEventModal;
