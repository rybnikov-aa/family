import type { ComponentType, CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../routes';
import type { IconProps } from './icons';

interface SectionCardProps {
  icon: ComponentType<IconProps>;
  color: string;
  title: string;
  description: string;
  tag: string;
  href?: string;
  highlight?: boolean;
  /** Широкая карточка: занимает две колонки сетки (используется на странице «Проекты»). */
  wide?: boolean;
  /** Кнопки действий (admin), рендерятся поверх карточки (не внутри ссылки). */
  actions?: ReactNode;
}

function SectionCard({
  icon: Icon,
  color,
  title,
  description,
  tag,
  href,
  highlight = false,
  wide = false,
  actions,
}: SectionCardProps) {
  const style = { '--accent': color } as CSSProperties;
  const className = `card${highlight ? ' card-renov' : ''}${wide ? ' card--wide' : ''}`;

  const body = (
    <>
      <span className="card__icon">
        <Icon />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="tag">{tag}</div>
    </>
  );

  // Разделы-заглушки без ссылки (например, «Планы») — не ссылки.
  let card: ReactNode;
  if (!href) {
    card = (
      <div className={className} style={style}>
        {body}
      </div>
    );
  } else {
    // Внутренние маршруты приложения рендерим через Link (hash-форма): известные
    // пути из ROUTES и страницы проектов `/projects/<slug>` (все проекты — прикладные).
    const internal =
      (Object.values(ROUTES) as string[]).includes(href) || href.startsWith('/projects/');
    card = internal ? (
      <Link to={href} className={className} style={style}>
        {body}
      </Link>
    ) : (
      <a href={href} className={className} style={style}>
        {body}
      </a>
    );
  }

  // Действия (например, редактирование/удаление проекта) — отдельно от ссылки,
  // поверх карточки: вложенные кнопки внутри <a> недопустимы.
  if (!actions) {
    return card;
  }
  return (
    <div className="card-actions-wrap" style={style}>
      {card}
      <div className="card-actions">{actions}</div>
    </div>
  );
}

export default SectionCard;
