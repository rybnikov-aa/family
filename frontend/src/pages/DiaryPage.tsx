import { useState } from 'react';
import PageLayout from '../components/PageLayout';
import DiaryEventCard from '../components/DiaryEventCard';
import DiaryEventModal from '../components/DiaryEventModal';
import DiaryPhotosModal from '../components/DiaryPhotosModal';
import ImmichPickerModal from '../components/ImmichPickerModal';
import IconButton from '../components/IconButton';
import { DiaryIcon, GridViewIcon, ListViewIcon, PlusIcon } from '../components/icons';
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
type DiaryLayout = 'list' | 'cards';

/** Варианты макета: кнопки с иконками без подписей (см. `diary-layout-toggle`). */
const LAYOUTS: { value: DiaryLayout; label: string; icon: typeof ListViewIcon }[] = [
  { value: 'list', label: 'Список (на всю ширину)', icon: ListViewIcon },
  { value: 'cards', label: 'Карточки (сетка на 3 столбца)', icon: GridViewIcon },
];

/**
 * Раздел «Дневник»: события семьи в виде блоков. Данные динамические — приходят
 * с бэкенда (`GET /api/diary`, своя БД `diary.sqlite`, изображения — в
 * `images/<folder>/`). Пользователь переключает макет: «список» (по умолчанию,
 * на всю ширину) или «карточки» (сетка на 3 столбца) — кнопки с иконками без
 * подписей. Добавление/редактирование/удаление событий — только admin.
 */
function DiaryPage() {
  const { events, error, loading, refresh } = useDiaryEvents();
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

        {error ? (
          <div className="news-empty">Не удалось загрузить события: {error}</div>
        ) : loading && events.length === 0 ? (
          <div className="news-empty">Загрузка событий…</div>
        ) : events.length === 0 ? (
          <div className="news-empty">Событий пока нет — загляните позже.</div>
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
