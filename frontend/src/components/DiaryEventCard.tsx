import { Link, useNavigate } from 'react-router-dom';
import IconButton from './IconButton';
import { DocIcon, EditIcon, ImageIcon, ImagesIcon, TrashIcon } from './icons';
import { diaryImageUrl, type DiaryEventSummary } from '../api/client';
import { formatDateIso } from '../utils/money';
import { ROUTES } from '../routes';

interface DiaryEventCardProps {
  event: DiaryEventSummary;
  /** Макет отображения: список (на всю ширину) или карточки (сетка). */
  layout: 'list' | 'cards';
  /** Показывать ли действия администратора (событие/описание/фотографии/корзина). */
  isAdmin: boolean;
  onEdit: (event: DiaryEventSummary) => void;
  onEditPhotos: (event: DiaryEventSummary) => void;
  onDelete: (event: DiaryEventSummary) => void;
}

/** Надпись даты события: одна дата или период «дата1 – дата2». */
function dateLabel(event: DiaryEventSummary): string {
  const start = formatDateIso(event.dateStart);
  return event.dateEnd ? `${start} – ${formatDateIso(event.dateEnd)}` : start;
}

/**
 * Блок события «Дневника»: обложка, название, дата (pill) и краткое описание.
 * Клик по блоку открывает страницу события (`#/diary/<id>`). Действия admin — поверх блока,
 * вне ссылки (вложенные кнопки внутри `<a>` недопустимы), по порядку: «Редактировать событие»
 * (карандаш), «Редактировать описание» (документ), «Редактировать фотографии» (иконка
 * фотографий), «Удалить» (корзина). Макет — `list` (на всю ширину) или `cards` (сетка).
 */
function DiaryEventCard({
  event,
  layout,
  isAdmin,
  onEdit,
  onEditPhotos,
  onDelete,
}: DiaryEventCardProps) {
  const navigate = useNavigate();
  // Обложка в карточке — всегда превью (уменьшенная копия).
  const coverUrl = event.cover ? diaryImageUrl(event.folder, event.cover, true) : null;

  const actions = isAdmin ? (
    <div className="diary-card__actions">
      <IconButton
        label={`Редактировать событие «${event.title}»`}
        tooltip="Редактировать событие"
        size="sm"
        plain
        onClick={() => onEdit(event)}
      >
        <EditIcon />
      </IconButton>
      <IconButton
        label={`Редактировать описание «${event.title}»`}
        tooltip="Редактировать описание"
        size="sm"
        plain
        onClick={() => navigate(`/diary/${event.id}/edit`)}
      >
        <DocIcon />
      </IconButton>
      <IconButton
        label={`Редактировать фотографии «${event.title}»`}
        tooltip="Редактировать фотографии"
        size="sm"
        plain
        onClick={() => onEditPhotos(event)}
      >
        <ImagesIcon />
      </IconButton>
      <IconButton
        label={`Удалить «${event.title}»`}
        tooltip="Удалить"
        size="sm"
        plain
        danger
        onClick={() => onDelete(event)}
      >
        <TrashIcon />
      </IconButton>
    </div>
  ) : null;

  return (
    <div className="diary-card-wrap">
      <Link
        to={`${ROUTES.diary}/${event.id}`}
        className={`diary-card diary-card--${layout}`}
        aria-label={`Открыть событие «${event.title}»`}
      >
        <div className="diary-card__media">
          {coverUrl ? (
            <img src={coverUrl} alt="" loading="lazy" />
          ) : (
            <span className="diary-card__placeholder" aria-hidden="true">
              <ImageIcon />
            </span>
          )}
        </div>
        <div className="diary-card__body">
          <h3 className="diary-card__title">{event.title}</h3>
          <span className="diary-pill">{dateLabel(event)}</span>
          <p className="diary-card__summary">{event.summary}</p>
        </div>
      </Link>
      {actions && <div className="diary-card__actions-pos">{actions}</div>}
    </div>
  );
}

export default DiaryEventCard;
