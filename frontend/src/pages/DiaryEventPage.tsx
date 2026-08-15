import { useState } from 'react';
import { useParams } from 'react-router-dom';
import PageLayout from '../components/PageLayout';
import DiaryEventModal from '../components/DiaryEventModal';
import IconButton from '../components/IconButton';
import { DiaryIcon, EditIcon, ImageIcon } from '../components/icons';
import { diaryImageUrl } from '../api/client';
import { useDiaryEvent } from '../hooks/useDiaryEvent';
import { useAuth } from '../hooks/useAuth';
import { renderMarkdown } from '../utils/markdown';
import { formatDateIso } from '../utils/money';

/**
 * Страница события «Дневника» (`#/diary/:id`): обложка, название, дата (pill),
 * краткое описание, подробное описание (markdown) и галерея всех фотографий.
 * Редактирование — кнопка «карандашик» (admin).
 */
function DiaryEventPage() {
  const params = useParams();
  const rawId = Number(params.id);
  const id = Number.isInteger(rawId) && rawId > 0 ? rawId : null;
  const { event, error, loading, reload } = useDiaryEvent(id);
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [editOpen, setEditOpen] = useState(false);

  const dateLabel = event
    ? event.dateEnd
      ? `${formatDateIso(event.dateStart)} – ${formatDateIso(event.dateEnd)}`
      : formatDateIso(event.dateStart)
    : '';

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
                <div className="page__sub">
                  <span className="diary-pill">{dateLabel}</span>
                </div>
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
                </div>
              )}
            </div>

            {event.cover && (
              <div className="diary-event__cover">
                <img src={diaryImageUrl(event.folder, event.cover)} alt="" />
              </div>
            )}

            <p className="diary-event__summary">{event.summary}</p>

            {event.content.trim() === '' ? (
              <div className="news-empty">Подробное описание пока не добавлено.</div>
            ) : (
              <div className="markdown diary-event__content">{renderMarkdown(event.content)}</div>
            )}

            {event.images.length > 0 && (
              <div className="diary-event__gallery">
                {event.images.map((name) => (
                  <a
                    key={name}
                    className="diary-event__photo"
                    href={diaryImageUrl(event.folder, name)}
                    target="_blank"
                    rel="noreferrer"
                    title="Открыть в полном размере"
                  >
                    <img src={diaryImageUrl(event.folder, name)} alt={event.title} loading="lazy" />
                  </a>
                ))}
              </div>
            )}
            {event.images.length === 0 && !event.cover && (
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
    </PageLayout>
  );
}

export default DiaryEventPage;
