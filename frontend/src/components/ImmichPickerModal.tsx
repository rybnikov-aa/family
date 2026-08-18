import { useCallback, useEffect, useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import UploadProgress from './UploadProgress';
import { CheckIcon } from './icons';
import {
  fetchImmichOriginal,
  fetchImmichSearchAssets,
  immichThumbnailUrl,
  type ImmichAssetItem,
  type ImmichDownloadProgress,
  type ImmichSearchResult,
} from '../api/client';

/** Максимальный размер файла для импорта (совпадает с лимитом формы события). */
const MAX_IMPORT_SIZE = 10 * 1024 * 1024;
/** Размер страницы поиска в Immich. */
const PAGE_SIZE = 60;

/** Дата для `<input type="date">` (ГГГГ-ММ-ДД) из Date. */
function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

interface ImmichPickerModalProps {
  /** Закрыть пикер без добавления. */
  onClose: () => void;
  /** Передаёт скачанные файлы для добавления в событие (далее закрывает модалку). */
  onPick: (files: File[]) => void;
  /** Начальная дата фильтра «снято с» (ГГГГ-ММ-ДД); не задана → последние 3 месяца. */
  defaultFrom?: string;
  /** Начальная дата фильтра «по» (ГГГГ-ММ-ДД); не задана → сегодня. */
  defaultTo?: string;
}

/**
 * Пикер фото из инстанса Immich (вариант B2, admin).
 *
 * Поиск фото по диапазону дат съёмки. Начальные даты фильтра — из дат события
 * (если переданы `defaultFrom`/`defaultTo`), иначе — последние 3 месяца;
 * сетка миниатюр (прокси через бэкенд `/api/immich`), множественный выбор.
 * Кнопка «Добавить N фото» скачивает оригиналы и отдаёт их как `File[]` —
 * форма события добавляет их как обычные загруженные файлы.
 */
function ImmichPickerModal({ onClose, onPick, defaultFrom, defaultTo }: ImmichPickerModalProps) {
  // Диапазон дат съёмки: из дат события, если заданы, иначе — последние 3 месяца.
  const [takenAfter, setTakenAfter] = useState(() => {
    if (defaultFrom) return defaultFrom;
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return toDateInput(d);
  });
  const [takenBefore, setTakenBefore] = useState(() => defaultTo ?? toDateInput(new Date()));

  const [items, setItems] = useState<ImmichAssetItem[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<ImmichDownloadProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  /** Поиск по текущему диапазону дат (границы — в локальном времени). */
  const search = useCallback(
    async (page: number, after: string, before: string): Promise<ImmichSearchResult> => {
      const params: {
        takenAfter?: string;
        takenBefore?: string;
        page: number;
        size: number;
      } = { page, size: PAGE_SIZE };
      if (after) params.takenAfter = `${after}T00:00:00.000`;
      if (before) params.takenBefore = `${before}T23:59:59.999`;
      return fetchImmichSearchAssets(params);
    },
    [],
  );

  // Первичная загрузка при открытии (по датам на момент монтирования).
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await search(1, takenAfter, takenBefore);
        if (!mounted) return;
        setItems(result.items);
        setNextPage(result.nextPage);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : 'Не удалось загрузить фото');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [search]);

  const onSearch = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setSelected(new Set());
    try {
      const result = await search(1, takenAfter, takenBefore);
      setItems(result.items);
      setNextPage(result.nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить фото');
    } finally {
      setLoading(false);
    }
  };

  const onLoadMore = async () => {
    if (!nextPage || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await search(nextPage, takenAfter, takenBefore);
      setItems((prev) => [...prev, ...result.items]);
      setNextPage(result.nextPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить фото');
    } finally {
      setLoadingMore(false);
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  /** Скачивает оригиналы выбранных фото и передаёт их в форму события. */
  const handleAdd = async () => {
    if (adding || selected.size === 0) return;
    setAdding(true);
    setMessage(null);
    setDownloadProgress({
      currentIndex: 0,
      currentName: '',
      currentPercent: 0,
      overallPercent: 0,
      totalFiles: 0,
    });
    const files: File[] = [];
    let skipped = 0;
    const chosen = items.filter((item) => selected.has(item.id));
    const totalFiles = chosen.length;
    let completed = 0;
    for (let i = 0; i < chosen.length; i++) {
      const item = chosen[i];
      // Доля завершённых файлов — нижняя граница общего прогресса.
      const baseOverall = totalFiles > 0 ? Math.round((completed / totalFiles) * 100) : 0;
      setDownloadProgress({
        currentIndex: i,
        currentName: item.fileName,
        currentPercent: 0,
        overallPercent: baseOverall,
        totalFiles,
      });
      try {
        const bytes = await fetchImmichOriginal(item.id, (loaded, totalBytes) => {
          const currentPercent =
            totalBytes > 0
              ? Math.min(100, Math.max(0, Math.round((loaded / totalBytes) * 100)))
              : 100;
          const currentFraction = totalBytes > 0 ? Math.min(1, loaded / totalBytes) : 1;
          setDownloadProgress({
            currentIndex: i,
            currentName: item.fileName,
            currentPercent,
            overallPercent:
              totalFiles > 0
                ? Math.min(100, Math.round(((completed + currentFraction) / totalFiles) * 100))
                : 0,
            totalFiles,
          });
        });
        completed += 1;
        if (bytes.byteLength > MAX_IMPORT_SIZE) {
          skipped += 1;
          continue;
        }
        files.push(
          new File([bytes], item.fileName, { type: item.mimeType ?? 'application/octet-stream' }),
        );
      } catch {
        completed += 1;
        skipped += 1;
      }
    }
    setAdding(false);
    setDownloadProgress(null);

    if (files.length === 0) {
      setMessage(
        skipped > 0
          ? 'Выбранные фото больше 10 МБ и не были добавлены'
          : 'Не удалось добавить фото из Immich',
      );
      return;
    }
    onPick(files);
    onClose();
  };

  return (
    <Modal title="Выбрать фото из Immich" onClose={onClose} wide>
      <div className="immich-picker">
        <div className="immich-picker__filters">
          <label className="field">
            <span className="field__label">Снято с</span>
            <input
              className="input"
              type="date"
              value={takenAfter}
              onChange={(event) => setTakenAfter(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">по</span>
            <input
              className="input"
              type="date"
              value={takenBefore}
              onChange={(event) => setTakenBefore(event.target.value)}
            />
          </label>
          <div className="immich-picker__filter-action">
            <Button onClick={() => void onSearch()} disabled={loading}>
              Найти
            </Button>
          </div>
        </div>

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="alert alert--warning" role="status">
            {message}
          </div>
        )}

        {loading ? (
          <p className="immich-picker__empty">Загрузка…</p>
        ) : !error && items.length === 0 ? (
          <p className="immich-picker__empty">Фото за выбранный период не найдены.</p>
        ) : (
          <>
            <div className="immich-picker__grid">
              {items.map((item) => {
                const isSelected = selected.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`immich-picker__item${isSelected ? ' immich-picker__item--selected' : ''}`}
                    aria-pressed={isSelected}
                    title={item.fileName}
                    onClick={() => toggle(item.id)}
                  >
                    <img src={immichThumbnailUrl(item.id)} alt={item.fileName} loading="lazy" />
                    {isSelected && (
                      <span className="immich-picker__check">
                        <CheckIcon />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {nextPage && (
              <div className="immich-picker__more">
                <Button onClick={() => void onLoadMore()} disabled={loadingMore}>
                  {loadingMore ? 'Загрузка…' : 'Показать ещё'}
                </Button>
              </div>
            )}
          </>
        )}

        {adding && downloadProgress !== null && <UploadProgress {...downloadProgress} />}

        <div className="immich-picker__actions">
          <Button
            variant="primary"
            onClick={() => void handleAdd()}
            disabled={adding || selected.size === 0}
          >
            {adding ? 'Добавление…' : `Добавить ${selected.size} фото`}
          </Button>
          <Button onClick={onClose}>Отмена</Button>
        </div>
      </div>
    </Modal>
  );
}

export default ImmichPickerModal;
