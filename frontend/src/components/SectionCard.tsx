import type { ComponentType, CSSProperties } from 'react';
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

  // Разделы-заглушки без ссылки (например, «Дневник», «Планы») — не ссылки.
  if (!href) {
    return (
      <div className={className} style={style}>
        {body}
      </div>
    );
  }

  // Внутренние маршруты приложения рендерим через Link (hash-форма), остальное — обычные ссылки.
  const internal = (Object.values(ROUTES) as string[]).includes(href);

  if (internal) {
    return (
      <Link to={href} className={className} style={style}>
        {body}
      </Link>
    );
  }
  return (
    <a href={href} className={className} style={style}>
      {body}
    </a>
  );
}

export default SectionCard;
