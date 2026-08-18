import type { SVGProps } from 'react';

export type IconProps = SVGProps<SVGSVGElement>;

const base: IconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

/** Семья — два человека */
export function UsersIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** Профиль — один человек */
export function UserIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/** Ремонт — дом с малярным валиком (ремонт/отделка жилья) */
export function RenovationIcon(props: IconProps) {
  return (
    <svg {...base} strokeWidth={1.5} {...props}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      {/* Валик внутри дома: stroke 3 компенсирует scale 0.5 → визуально 1.5 */}
      <g transform="translate(12 15) scale(0.5) translate(-12 -12)" strokeWidth={3}>
        <rect width="16" height="6" x="2" y="2" rx="2" />
        <path d="M10 16v-2a2 2 0 0 1 2-2h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect width="4" height="6" x="8" y="16" rx="1" />
      </g>
    </svg>
  );
}

/** Дневник — книга */
export function DiaryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

/** Новости — газета */
export function NewsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
      <path d="M18 14h-8" />
      <path d="M15 18h-5" />
      <path d="M10 6h8v4h-8V6Z" />
    </svg>
  );
}

/** Фотоархив — фотография */
export function PhotoIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

/**
 * Immich — официальный логотип. viewBox обрезан до области логотипа (96×96),
 * чтобы по размеру иконка соответствовала остальным (CSS задаёт размер).
 */
export function ImmichIcon(props: IconProps) {
  return (
    <svg viewBox="15 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <g clipPath="url(#immich-clip)">
        <path
          d="M110.5 48C110.5 21.7665 89.2335 0.5 63 0.5C36.7665 0.5 15.5 21.7665 15.5 48C15.5 74.2335 36.7665 95.5 63 95.5C89.2335 95.5 110.5 74.2335 110.5 48Z"
          fill="#070915"
        />
        <path
          d="M110.5 48C110.5 21.7665 89.2335 0.5 63 0.5C36.7665 0.5 15.5 21.7665 15.5 48C15.5 74.2335 36.7665 95.5 63 95.5C89.2335 95.5 110.5 74.2335 110.5 48Z"
          stroke="#222326"
        />
        <path
          d="M60.4161 33.5746C65.122 37.7636 68.9145 42.2527 71.3552 46.4834C75.5471 38.9453 78.3483 29.988 78.3836 24.283C78.3836 24.2426 78.3836 24.2059 78.3836 24.1716C78.3836 15.7298 70.0082 12.4445 62.7934 12.4445C55.5786 12.4445 47.2032 15.7298 47.2032 24.1716C47.2032 24.2867 47.2032 24.441 47.2032 24.6271C51.2247 26.4247 55.9915 29.6366 60.4161 33.5746Z"
          fill="#E93832"
        />
        <path
          d="M34.7453 56.5954C37.6865 53.3052 42.1988 49.7394 47.2908 46.7247C52.708 43.5189 58.1264 41.2793 62.8822 40.2543C57.0473 33.9163 49.4404 28.4697 44.0536 26.6733C44.0159 26.6611 43.9806 26.6501 43.9489 26.639C35.9632 24.0308 30.2671 31.024 28.0384 37.9229C25.8096 44.8218 26.3285 53.8464 34.3142 56.4546C34.4226 56.4901 34.5687 56.5379 34.7453 56.5954Z"
          fill="#ED79B5"
        />
        <path
          d="M97.6335 37.8066C95.4047 30.9077 89.7086 23.9145 81.7229 26.5227C81.6133 26.5582 81.4672 26.606 81.2918 26.6635C80.8351 31.0632 79.2701 36.6151 76.9123 42.063C74.4046 47.8573 71.3295 52.8717 68.0814 56.5122C76.5067 58.1922 85.8455 58.1016 91.2529 56.3726C91.2907 56.3603 91.326 56.3481 91.3577 56.3383C99.3434 53.7289 99.8622 44.7042 97.6335 37.8066Z"
          fill="#E8AB17"
        />
        <path
          d="M55.6736 63.34C54.3157 57.1697 53.8712 51.2958 54.3705 46.432C46.5723 50.0529 39.0701 55.644 35.7051 60.2396C35.682 60.2714 35.6601 60.302 35.6406 60.329C30.7057 67.1593 35.5602 74.7672 41.3975 79.0297C47.2337 83.2934 55.9306 85.5857 60.8667 78.7554C60.9349 78.6623 61.0251 78.5374 61.1334 78.3868C58.9303 74.5578 56.95 69.1405 55.6736 63.34Z"
          fill="#2383F2"
        />
        <path
          d="M89.8999 59.888C85.5971 60.8113 79.862 61.0305 73.9796 60.4587C67.7233 59.8513 62.0309 58.4603 57.5832 56.479C58.5977 65.0542 61.5693 73.9564 64.8759 78.5936C64.8991 78.6255 64.921 78.6561 64.9405 78.683C69.8754 85.5133 78.5723 83.2211 84.4096 78.9573C90.2458 74.6936 95.1015 67.0857 90.1666 60.2566C90.0984 60.1636 90.0083 60.0387 89.8999 59.888Z"
          fill="#1FBB4C"
        />
      </g>
      <defs>
        <clipPath id="immich-clip">
          <rect width="96" height="96" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}

/** Планы — мишень */
export function PlansIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

/** Дом */
export function HomeIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

/** Папка */
export function FolderIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

/** Проекты — портфель */
export function ProjectsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </svg>
  );
}

/** Молния */
export function BoltIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  );
}

/** Сервер */
export function ServerIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <line x1="6" x2="6.01" y1="6" y2="6" />
      <line x1="6" x2="6.01" y1="18" y2="18" />
    </svg>
  );
}

/** Солнце — светлая тема */
export function SunIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

/** Луна — тёмная тема */
export function MoonIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

/** Монитор — системная тема */
export function MonitorIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect width="20" height="14" x="2" y="3" rx="2" ry="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

/** Внешняя ссылка */
export function ExternalLinkIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

/** Шестерёнка — настройки/панель управления */
export function SettingsIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Копировать */
export function CopyIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

/** Галочка */
export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/** Крест — ошибка/закрыть */
export function CrossIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

/** Обновить */
export function RefreshIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </svg>
  );
}

/** Плюс — добавить */
export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

/** Троеточие — редактировать сервисы */
export function EllipsisIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </svg>
  );
}

/** Загрузка из файла — импорт */
export function UploadIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  );
}

/** Удалить */
export function TrashIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

/** Карандаш — редактировать */
export function EditIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

/** Документ — лист с загнутым углом */
export function DocIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

/** Выход — стрелка из двери */
export function LogoutIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

/** Замок — вход в приватную зону */
export function LockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/** Список — строки (макет «список на всю ширину» в «Дневнике») */
export function ListViewIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <line x1="8" x2="21" y1="6" y2="6" />
      <line x1="8" x2="21" y1="12" y2="12" />
      <line x1="8" x2="21" y1="18" y2="18" />
      <line x1="3" x2="3.01" y1="6" y2="6" />
      <line x1="3" x2="3.01" y1="12" y2="12" />
      <line x1="3" x2="3.01" y1="18" y2="18" />
    </svg>
  );
}

/** Карточки — сетка (макет «карточки на 3 столбца» в «Дневнике») */
export function GridViewIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  );
}

/** Изображение — картинка в рамке (заглушка без обложки) */
export function ImageIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}
