import { useTheme, type ThemeMode } from '../hooks/useTheme';

const options: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: 'light', label: 'светлая', icon: '☀️' },
  { mode: 'dark', label: 'тёмная', icon: '🌙' },
  { mode: 'system', label: 'система', icon: '🖥️' },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Тема оформления">
      {options.map((option) => {
        const active = theme === option.mode;
        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.label}
            className={`theme-toggle__option${active ? ' theme-toggle__option--active' : ''}`}
            onClick={() => setTheme(option.mode)}
          >
            <span className="theme-toggle__icon" aria-hidden="true">
              {option.icon}
            </span>
            <span className="theme-toggle__label">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;
