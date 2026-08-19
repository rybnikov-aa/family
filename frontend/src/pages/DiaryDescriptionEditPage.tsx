import { useEffect, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import Button from '../components/Button';
import IconButton from '../components/IconButton';
import ImmichPickerModal from '../components/ImmichPickerModal';
import { DiaryIcon, ImagePlusIcon, ImageUpIcon } from '../components/icons';
import { useImmichSettings } from '../hooks/useImmichSettings';
import {
  buildDiaryFormData,
  diaryImageUrl,
  updateDiaryEvent,
  type DiaryEventDetail,
} from '../api/client';
import { useDiaryEvent } from '../hooks/useDiaryEvent';
import { renderMarkdown } from '../utils/markdown';

/** Ключ localStorage для черновика описания события. */
function draftKey(id: number): string {
  return `diary-draft:${id}`;
}

/**
 * Редактор подробного описания события «Дневника» (`#/diary/:id/edit`, admin).
 *
 * Фокусная форма: markdown-текст слева + живой предпросмотр с фото справа
 * (desktop; на мобильном — стеком). Фото события, ещё не использованные в
 * тексте, вставляются кликом по миниатюре; новые фото загружаются кнопками
 * «Добавить фото с диска»/«Добавить фото из Immich» — попадают в фотосет
 * события и сразу вставляются у курсора.
 * «Сохранить» пишет контент сразу на сервер (`PATCH /api/diary/:id`): форма
 * независима от формы события, двухступенчатого сохранения нет. Черновик
 * автосохраняется в localStorage; при уходе с несохранёнными правками —
 * подтверждение (SPA-навигация и закрытие вкладки).
 */
function DiaryDescriptionEditPage() {
  const params = useParams();
  const rawId = Number(params.id);
  const id = Number.isInteger(rawId) && rawId > 0 ? rawId : null;
  const { event, error, loading } = useDiaryEvent(id);
  const navigate = useNavigate();

  // Текущее известное состояние события (для сборки PATCH) и текст описания.
  const [detail, setDetail] = useState<DiaryEventDetail | null>(null);
  const [draft, setDraft] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedInfo, setSavedInfo] = useState<string | null>(null);
  const [restoreHint, setRestoreHint] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const initializedRef = useRef(false);
  const newIdRef = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const immichUrl = useImmichSettings();

  // При смене id события (переход между событиями без размонтирования) —
  // сбрасываем состояние, чтобы инициализация прошла заново.
  useEffect(() => {
    initializedRef.current = false;
    setDetail(null);
    setDraft('');
    setSavedContent('');
    setRestoreHint(false);
    setSaveError(null);
    setSavedInfo(null);
  }, [id]);

  // Инициализация из загруженного события: восстановление черновика из localStorage.
  useEffect(() => {
    if (!event || initializedRef.current) return;
    initializedRef.current = true;
    setDetail(event);
    setSavedContent(event.content);
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(draftKey(event.id));
    } catch {
      /* localStorage недоступен — игнорируем */
    }
    if (stored !== null && stored !== event.content) {
      setDraft(stored);
      setRestoreHint(true);
    } else {
      setDraft(event.content);
      if (stored !== null) {
        try {
          localStorage.removeItem(draftKey(event.id));
        } catch {
          /* ignore */
        }
      }
    }
  }, [event]);

  const dirty = draft !== savedContent;

  /** Изменение текста: обновляет состояние и автосохраняет черновик. */
  const handleDraftChange = (value: string) => {
    setDraft(value);
    setSavedInfo(null);
    if (detail) {
      try {
        localStorage.setItem(draftKey(detail.id), value);
      } catch {
        /* ignore */
      }
    }
  };

  /** Вставляет фото (маркер `diary-image://`) в текст у курсора. */
  const insertMarker = (name: string) => {
    const textarea = textareaRef.current;
    const marker = `![Фото](diary-image://${name})\n`;
    const start = textarea?.selectionStart ?? draft.length;
    const end = textarea?.selectionEnd ?? draft.length;
    handleDraftChange(`${draft.slice(0, start)}${marker}${draft.slice(end)}`);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + marker.length, start + marker.length);
    });
  };

  /** Собирает FormData из текущих полей события и переданного контента/файлов. */
  const buildFormData = (content: string, extra: { id: string; file: File }[]): FormData => {
    if (!detail) throw new Error('Событие ещё не загружено');
    return buildDiaryFormData({
      title: detail.title,
      dateStart: detail.dateStart,
      dateEnd: detail.dateEnd,
      summary: detail.summary,
      content,
      cover: detail.cover,
      images: [
        ...detail.images.map((name) => ({ id: name, file: null })),
        ...extra.map((item) => ({ id: item.id, file: item.file })),
      ],
      keep: detail.images,
    });
  };

  /** Сохранение контента (PATCH; существующие фото сохраняются). */
  const handleSave = async () => {
    if (!detail || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await updateDiaryEvent(detail.id, buildFormData(draft, []));
      setDetail(updated);
      setSavedContent(updated.content);
      setDraft(updated.content);
      try {
        localStorage.removeItem(draftKey(detail.id));
      } catch {
        /* ignore */
      }
      setSavedInfo(
        `Сохранено в ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`,
      );
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Не удалось сохранить описание');
    } finally {
      setSaving(false);
    }
  };

  /** Загрузка новых фото (с диска или из Immich): в фотосет события и в текст у курсора. */
  const addFilesToDraft = async (files: File[]) => {
    if (!detail || saving) return;
    if (files.length === 0) return;
    setSaving(true);
    setSaveError(null);
    const previousDraft = draft;
    try {
      const newFiles: { id: string; file: File }[] = [];
      let next = previousDraft;
      for (const file of files) {
        const newId = `new-${newIdRef.current++}`;
        const marker = `![Фото](diary-image://${newId})\n`;
        const textarea = textareaRef.current;
        const start = textarea?.selectionStart ?? next.length;
        const end = textarea?.selectionEnd ?? next.length;
        next = `${next.slice(0, start)}${marker}${next.slice(end)}`;
        newFiles.push({ id: newId, file });
      }
      const updated = await updateDiaryEvent(detail.id, buildFormData(next, newFiles));
      setDetail(updated);
      setSavedContent(updated.content);
      setDraft(updated.content);
      try {
        localStorage.removeItem(draftKey(detail.id));
      } catch {
        /* ignore */
      }
      setSavedInfo('Фотографии загружены и вставлены в описание.');
    } catch (err) {
      setDraft(previousDraft);
      setSaveError(err instanceof Error ? err.message : 'Не удалось загрузить фотографии');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadFiles = (list: FileList | null) => {
    if (!list) return;
    void addFilesToDraft(Array.from(list));
  };

  /** Отменить восстановление черновика: вернуть сохранённый контент события. */
  const discardDraft = () => {
    if (!detail) return;
    try {
      localStorage.removeItem(draftKey(detail.id));
    } catch {
      /* ignore */
    }
    setDraft(detail.content);
    setSavedContent(detail.content);
    setRestoreHint(false);
  };

  // Подтверждение при уходе с несохранёнными изменениями (навигация по SPA).
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && nextLocation.pathname !== currentLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    const proceed = window.confirm(
      'В описании есть несохранённые изменения. Покинуть страницу без сохранения?',
    );
    if (proceed) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  // Подтверждение при закрытии/перезагрузке вкладки (beforeunload).
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Фото, ещё не использованные в тексте (для полоски вставки).
  const draftImageNames = new Set(
    Array.from(
      draft.matchAll(/!\[[^\]]*\]\(diary-image:\/\/([a-z0-9._-]+)\)/g),
      (match) => match[1],
    ),
  );
  const availableImages = detail ? detail.images.filter((name) => !draftImageNames.has(name)) : [];

  const resolvePreview = (name: string) => {
    if (!detail?.folder) return null;
    return {
      src: diaryImageUrl(detail.folder, name, true),
      href: diaryImageUrl(detail.folder, name),
    };
  };

  if (loading) {
    return (
      <PageLayout>
        <section className="page">
          <div className="news-empty">Загрузка события…</div>
        </section>
      </PageLayout>
    );
  }

  if (error || !detail) {
    return (
      <PageLayout>
        <section className="page">
          <div className="news-empty">Не удалось загрузить событие: {error}</div>
          <div className="vps-form__actions">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Назад
            </Button>
          </div>
        </section>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <section className="page">
        <div className="page__head">
          <span className="page__icon page__icon--diary">
            <DiaryIcon />
          </span>
          <div>
            <h2>Редактировать описание</h2>
            <div className="page__sub">{detail.title}</div>
          </div>
          <div className="page__head-actions">
            <Button variant="secondary" onClick={() => navigate(`/diary/${detail.id}`)}>
              Назад
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} disabled={!dirty || saving}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        </div>

        {restoreHint && (
          <div className="alert">
            <span>Восстановлен несохранённый черновик описания.</span>
            <Button variant="secondary" onClick={discardDraft}>
              Сбросить черновик
            </Button>
          </div>
        )}

        <div className="diary-editor">
          <div className="diary-editor__pane diary-editor__pane--edit">
            <div className="diary-editor__toolbar">
              <IconButton
                label="Добавить фото с диска"
                tooltip="Добавить фото с диска"
                onClick={() => photoInputRef.current?.click()}
              >
                <ImageUpIcon />
              </IconButton>
              {immichUrl && (
                <IconButton
                  label="Добавить фото из Immich"
                  tooltip="Добавить фото из Immich"
                  onClick={() => setPickerOpen(true)}
                >
                  <ImagePlusIcon />
                </IconButton>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(event) => handleUploadFiles(event.target.files)}
              />
              <span className="field__hint">
                Фото попадают в событие и вставляются в текст у курсора.
              </span>
            </div>
            <textarea
              ref={textareaRef}
              className="input input--area diary-editor__textarea"
              rows={16}
              value={draft}
              onChange={(event) => handleDraftChange(event.target.value)}
              placeholder="## День первый&#10;&#10;Подробный рассказ о событии: заголовки, списки, ссылки."
            />
            <span className="field__hint">
              Markdown: ## заголовки, **жирный**, *курсив*, - списки, [ссылки](url).
            </span>

            {availableImages.length > 0 && (
              <div className="diary-photos__insert">
                <span className="field__hint">Вставить фотографию в описание:</span>
                <div className="diary-photos__insert-list">
                  {availableImages.map((name, index) => (
                    <button
                      key={name}
                      type="button"
                      className="diary-photos__insert-item"
                      aria-label={`Вставить Фото ${index + 1} в описание`}
                      onClick={() => insertMarker(name)}
                    >
                      <span className="diary-photos__insert-label">Фото {index + 1}</span>
                      <img src={diaryImageUrl(detail.folder, name, true)} alt="" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {saveError && <div className="alert alert--error">{saveError}</div>}
            {savedInfo && !dirty && <div className="field__hint">{savedInfo}</div>}
          </div>

          <div className="diary-editor__pane diary-editor__pane--preview">
            <div className="diary-editor__pane-title">Предпросмотр</div>
            <div className="markdown diary-editor__preview">
              {draft.trim() ? (
                renderMarkdown(draft, resolvePreview)
              ) : (
                <span className="field__hint">Текст ещё не добавлен.</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {pickerOpen && detail && (
        <ImmichPickerModal
          onClose={() => setPickerOpen(false)}
          onPick={(files) => void addFilesToDraft(files)}
          defaultFrom={detail.dateStart || undefined}
          defaultTo={detail.dateEnd || detail.dateStart || undefined}
        />
      )}
    </PageLayout>
  );
}

export default DiaryDescriptionEditPage;
