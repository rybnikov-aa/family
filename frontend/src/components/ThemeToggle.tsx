import { useTheme, type ThemeMode } from '../hooks/useTheme';
import { MonitorIcon, MoonIcon, SunIcon } from './icons';

const options: { mode: ThemeMode; label: string; Icon: typeof SunIcon }[] = [
  { mode: 'light', label: 'светлая', Icon: SunIcon },
  { mode: 'dark', label: 'тёмная', Icon: MoonIcon },
  { mode: 'system', label: 'система', Icon: MonitorIcon },
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
            aria-label={option.label}
            title={option.label}
            className={`theme-toggle__option${active ? ' theme-toggle__option--active' : ''}`}
            onClick={() => setTheme(option.mode)}
          >
            <span
              className={`theme-toggle__icon theme-toggle__icon--${option.mode}`}
              aria-hidden="true"
            >
              <option.Icon />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;
