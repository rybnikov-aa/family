import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import DiaryEventCard from '../components/DiaryEventCard';
import DiaryEventModal from '../components/DiaryEventModal';
import DiaryPhotosModal from '../components/DiaryPhotosModal';
import ImmichPickerModal from '../components/ImmichPickerModal';
import IconButton from '../components/IconButton';
import { DiaryIcon, GridViewIcon, ListViewIcon, PlusIcon, TimelineIcon } from '../components/icons';
import {
  deleteDiaryEvent,
  fetchDiaryEvent,
  type DiaryEventDetail,
  type DiaryEventSummary,
} from '../api/client';
import { useDiaryEvents } from '../hooks/useDiaryEvents';
import { useDiaryPhotosEditor } from '../hooks/useDiaryPhotosEditor';
import { useAuth } from '../hooks/useAuth';
import { useImmichSettings } from '../hooks/useImmichSettings';

/** Макет отображения событий. */
type DiaryLayout = 'list' | 'cards' | 'timeline';

/** Варианты макета: кнопки с иконками без подписей (см. `diary-layout-toggle`). */
const LAYOUTS: { value: DiaryLayout; label: string; icon: typeof ListViewIcon }[] = [
  { value: 'list', label: 'Список (на всю ширину)', icon: ListViewIcon },
  { value: 'cards', label: 'Карточки (сетка на 3 столбца)', icon: GridViewIcon },
  { value: 'timeline', label: 'Временная шкала', icon: TimelineIcon },
];

/**
 * Раздел «Дневник»: события семьи в виде блоков. Данные динамические — приходят
 * с бэкенда (`GET /api/diary`, своя БД `diary.sqlite`, изображения — в
 * `images/<folder>/`). Пользователь переключает макет: «список» (по умолчанию,
 * на всю ширину) или «карточки» (сетка на 3 столбца) — кнопки с иконками без
 * подписей. Добавление/редактирование/удаление событий — только admin.
 */
function DiaryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const year = searchParams.get('year') ?? '';
  const tag = searchParams.get('tag') ?? '';
  const query = searchParams.get('q') ?? '';
  const filterOptions = {
    year: year || undefined,
    tag: tag || undefined,
    query: query.length >= 2 ? query : undefined,
  };
  const { events, error, loading, refresh } = useDiaryEvents(filterOptions);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const immichUrl = useImmichSettings();
  const [layout, setLayout] = useState<DiaryLayout>('list');
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DiaryEventDetail | null>(null);
  // Мгновенный редактор фотосета (модалка «Фотографии») — из карточки списка.
  const [photosEvent, setPhotosEvent] = useState<DiaryEventDetail | null>(null);
  const { pickerOpen, setPickerOpen, photosProps } = useDiaryPhotosEditor(
    photosEvent,
    (updated) => {
      setPhotosEvent(updated);
      refresh();
    },
  );
  const years = useMemo(
    () => [...new Set(events.map((event) => event.dateStart.slice(0, 4)))].sort().reverse(),
    [events],
  );
  const tags = useMemo(
    () =>
      [...new Set(events.flatMap((event) => event.tags))].sort((a, b) => a.localeCompare(b, 'ru')),
    [events],
  );
  const timeline = useMemo(() => {
    const groups = new Map<string, DiaryEventSummary[]>();
    for (const event of events) {
      const key = event.dateStart.slice(0, 4);
      groups.set(key, [...(groups.get(key) ?? []), event]);
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [events]);
  const updateFilter = (key: 'year' | 'tag' | 'q', value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  // Редактирование: нужны полные данные (контент) — запрашиваем отдельно.
  const handleEdit = async (entry: DiaryEventSummary) => {
    try {
      setEditing(await fetchDiaryEvent(entry.id));
    } catch {
      /* модалка не откроется — список не трогаем */
    }
  };

  // Редактирование фотографий: нужны полные данные (контент для маркеров) — отдельный запрос.
  const handleEditPhotos = async (entry: DiaryEventSummary) => {
    try {
      setPhotosEvent(await fetchDiaryEvent(entry.id));
    } catch {
      /* модалка не откроется — список не трогаем */
    }
  };

  const handleDelete = async (entry: DiaryEventSummary) => {
    if (!window.confirm(`Удалить событие «${entry.title}»? Действие необратимо.`)) return;
    await deleteDiaryEvent(entry.id);
    refresh();
  };

  return (
    <PageLayout>
      <section className="page">
        <div className="page__head">
          <span className="page__icon page__icon--diary">
            <DiaryIcon />
          </span>
          <div>
            <h2>Дневник</h2>
            <div className="page__sub">События, даты, маршруты — хронология семьи</div>
          </div>
          <div className="page__head-actions">
            <div className="diary-layout-toggle" role="group" aria-label="Макет отображения">
              {LAYOUTS.map((option) => {
                const Icon = option.icon;
                return (
                  <IconButton
                    key={option.value}
                    label={option.label}
                    tooltip={option.label}
                    size="sm"
                    plain={layout !== option.value}
                    active={layout === option.value}
                    onClick={() => setLayout(option.value)}
                  >
                    <Icon />
                  </IconButton>
                );
              })}
            </div>
            {isAdmin && (
              <IconButton
                label="Добавить событие"
                tooltip="Добавить событие"
                onClick={() => setCreateOpen(true)}
              >
                <PlusIcon />
              </IconButton>
            )}
          </div>
        </div>

        <div className="diary-filters">
          <input
            className="input"
            value={query}
            onChange={(event) => updateFilter('q', event.target.value)}
            placeholder="Поиск по дневнику"
            aria-label="Поиск по дневнику"
          />
          <select
            className="input"
            value={year}
            onChange={(event) => updateFilter('year', event.target.value)}
            aria-label="Год"
          >
            <option value="">Все годы</option>
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select
            className="input"
            value={tag}
            onChange={(event) => updateFilter('tag', event.target.value)}
            aria-label="Тег"
          >
            <option value="">Все теги</option>
            {tags.map((value) => (
              <option key={value} value={value}>
                #{value}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <div className="news-empty">Не удалось загрузить события: {error}</div>
        ) : loading && events.length === 0 ? (
          <div className="news-empty">Загрузка событий…</div>
        ) : events.length === 0 ? (
          <div className="news-empty">Событий пока нет — загляните позже.</div>
        ) : layout === 'timeline' ? (
          <div className="diary-timeline">
            {timeline.map(([timelineYear, yearEvents]) => (
              <section className="diary-timeline__year" key={timelineYear}>
                <h3>{timelineYear}</h3>
                <div className="diary-blocks diary-blocks--list">
                  {yearEvents.map((entry) => (
                    <DiaryEventCard
                      key={entry.id}
                      event={entry}
                      layout="list"
                      isAdmin={isAdmin}
                      onEdit={(e) => void handleEdit(e)}
                      onEditPhotos={(e) => void handleEditPhotos(e)}
                      onDelete={(e) => void handleDelete(e)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className={`diary-blocks diary-blocks--${layout}`}>
            {events.map((entry) => (
              <DiaryEventCard
                key={entry.id}
                event={entry}
                layout={layout}
                isAdmin={isAdmin}
                onEdit={(e) => void handleEdit(e)}
                onEditPhotos={(e) => void handleEditPhotos(e)}
                onDelete={(e) => void handleDelete(e)}
              />
            ))}
          </div>
        )}
      </section>

      {createOpen && <DiaryEventModal onClose={() => setCreateOpen(false)} onSaved={refresh} />}
      {editing && (
        <DiaryEventModal event={editing} onClose={() => setEditing(null)} onSaved={refresh} />
      )}

      {photosEvent && photosProps && (
        <DiaryPhotosModal
          {...photosProps}
          immichAvailable={Boolean(immichUrl)}
          onClose={() => setPhotosEvent(null)}
          onOpenImmich={() => setPickerOpen(true)}
          isForeground={!pickerOpen}
        />
      )}

      {pickerOpen && photosEvent && photosProps && (
        <ImmichPickerModal
          onClose={() => setPickerOpen(false)}
          onPick={photosProps.onAddFiles}
          defaultFrom={photosEvent.dateStart || undefined}
          defaultTo={photosEvent.dateEnd || photosEvent.dateStart || undefined}
        />
      )}
    </PageLayout>
  );
}

export default DiaryPage;
