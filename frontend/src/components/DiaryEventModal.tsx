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
import DiaryPhotoUploadActions from './DiaryPhotoUploadActions';
import DiaryPhotosModal from './DiaryPhotosModal';
import ImmichPickerModal from './ImmichPickerModal';
import UploadProgress from './UploadProgress';
import { DocIcon, EditIcon } from './icons';
import { extractDiaryImageNames, stripDiaryImage } from '../utils/diaryImages';
import type { FormImage } from '../types/diary';
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
  // Пикер фото из Immich (вариант B2): доступен, если инстанс настроен.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [photosEditorOpen, setPhotosEditorOpen] = useState(false);
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
    // Фото добавлено в текст описания (бейдж «В тексте»): удаление вырежет маркер и из текста.
    if (contentImageNames.has(id)) {
      const proceed = window.confirm(
        'Фотография добавлена в текст описания и будет удалена и из текста. Удалить?',
      );
      if (!proceed) return;
    }
    if (img.file) {
      URL.revokeObjectURL(img.preview);
      objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== img.preview);
    }
    const next = images.filter((i) => i.id !== id);
    setImages(next);
    setContent((prev) => stripDiaryImage(prev, id));
    if (cover === id) setCover(next[0]?.id ?? null);
  };

  const contentImageNames = extractDiaryImageNames(content);

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
      <Modal
        title={event ? 'Редактировать событие' : 'Добавить событие'}
        onClose={onClose}
        wide
        isForeground={!photosEditorOpen && !pickerOpen}
      >
        <form className="vps-form" onSubmit={handleSubmit}>
          <section className="diary-form-section">
            <div className="diary-form-section__header">
              <h4 className="diary-form-section__title">Основная информация</h4>
            </div>
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
          </section>

          <section className="diary-form-section">
            <div className="diary-form-section__head">
              <div className="diary-form-section__header">
                <h4 className="diary-form-section__title">Подробное описание</h4>
              </div>
              {event && (
                <IconButton
                  label="Открыть расширенный редактор"
                  tooltip="Открыть расширенный редактор"
                  onClick={handleOpenEditor}
                >
                  <DocIcon />
                </IconButton>
              )}
            </div>
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
          </section>

          <section className="diary-form-section">
            <div className="diary-form-section__head">
              <div className="diary-form-section__header">
                <h4 className="diary-form-section__title">Фотографии</h4>
              </div>
              <div className="diary-form-section__actions">
                <IconButton
                  label="Редактировать фотографии"
                  tooltip="Редактировать фотографии"
                  onClick={() => setPhotosEditorOpen(true)}
                >
                  <EditIcon />
                </IconButton>
                <DiaryPhotoUploadActions
                  immichAvailable={Boolean(immichUrl)}
                  onAddFiles={addFiles}
                  onOpenImmich={() => setPickerOpen(true)}
                />
              </div>
            </div>
            <div className="diary-form-section__body">
              {images.length === 0 ? (
                <div className="diary-photos__empty">Фотографии ещё не добавлены</div>
              ) : (
                <div className="diary-photo-filmstrip" aria-label="Добавленные фотографии">
                  {images.map((image) => (
                    <img key={image.id} src={image.preview} alt="" />
                  ))}
                </div>
              )}
            </div>
          </section>

          <div className="vps-form__actions">
            <Button variant="secondary" onClick={onClose}>
              Отмена
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Сохранение…' : event ? 'Сохранить' : 'Добавить'}
            </Button>
          </div>

          {submitting && uploadProgress !== null && <UploadProgress {...uploadProgress} />}

          {error && <div className="alert alert--error">{error}</div>}
        </form>
      </Modal>
      {photosEditorOpen && (
        <DiaryPhotosModal
          images={images}
          cover={cover}
          usedImageNames={contentImageNames}
          immichAvailable={Boolean(immichUrl)}
          onClose={() => setPhotosEditorOpen(false)}
          onAddFiles={addFiles}
          onOpenImmich={() => setPickerOpen(true)}
          onSelectCover={setCover}
          onRemoveImage={removeImage}
          isForeground={!pickerOpen}
        />
      )}
      {/* Пикер фото из Immich (вариант B2): выбранные файлы — как обычные загрузки.
          Даты фильтра по умолчанию — из дат события (для нового события без дат — 3 месяца). */}
      {pickerOpen && (
        <ImmichPickerModal
          onClose={() => setPickerOpen(false)}
          onPick={addFiles}
          defaultFrom={dateStart || undefined}
          defaultTo={dateEnd || dateStart || undefined}
        />
      )}
    </>
  );
}

export default DiaryEventModal;
