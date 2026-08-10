interface TabItem<T extends string> {
  value: T;
  label: string;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Доп. класс контейнера (например, отступы на конкретной странице). */
  className?: string;
}

/**
 * Вкладки страницы — единый таб-примитив. Используется на странице «Ремонт»
 * (Сводка / Ход работ / Материалы). Кнопки сохраняют нативную доступность.
 */
function Tabs<T extends string>({ items, value, onChange, className = '' }: TabsProps<T>) {
  return (
    <div className={`tabs${className ? ` ${className}` : ''}`}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className={`tab${value === item.value ? ' tab--active' : ''}`}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
