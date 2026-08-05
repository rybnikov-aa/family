/* ==========================================================================
   Тема для страниц проектов (раздел «Проекты»).
   Подключается в конце <body> каждого проекта: <script src="/projects/theme.js" defer></script>

   Читает/пишет выбор темы в localStorage['theme'] (light|dark|system) — общий
   для всего домена, поэтому тема сохраняется при переходе между приложением
   и проектами. Светлая/тёмная тема — через атрибут data-theme на <html>.

   Рендерит переключатель темы в элемент <div data-theme-toggle>…</div>.
   Чтобы не было «мигания» при загрузке, страница дополнительно применяет
   тему inline-скриптом в <head> (см. шаблон проекта).
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'theme';
  var DARK_QUERY = '(prefers-color-scheme: dark)';

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
  }

  function getMode() {
    try {
      var saved = localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    } catch (e) {
      /* localStorage недоступен — используем системную тему */
    }
    return 'system';
  }

  function apply(mode) {
    var dark = mode === 'dark' || (mode === 'system' && getSystemTheme() === 'dark');
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  function highlight(mode) {
    var root = document.querySelector('[data-theme-toggle]');
    if (!root) return;
    root.querySelectorAll('.theme-toggle__option').forEach(function (btn) {
      btn.classList.toggle('theme-toggle__option--active', btn.getAttribute('data-mode') === mode);
    });
  }

  function setMode(mode) {
    try {
      localStorage.setItem(KEY, mode);
    } catch (e) {
      /* ignore */
    }
    apply(mode);
    highlight(mode);
  }

  function mount(mode) {
    var root = document.querySelector('[data-theme-toggle]');
    if (!root) return;

    var options = [
      { mode: 'light', label: 'светлая', icon: '☀️' },
      { mode: 'dark', label: 'тёмная', icon: '🌙' },
      { mode: 'system', label: 'система', icon: '🖥️' },
    ];

    options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'theme-toggle__option';
      btn.setAttribute('data-mode', opt.mode);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', String(opt.mode === mode));
      btn.title = opt.label;
      btn.setAttribute('aria-label', opt.label);

      var icon = document.createElement('span');
      icon.className = 'theme-toggle__icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = opt.icon;
      btn.appendChild(icon);

      var label = document.createElement('span');
      label.className = 'theme-toggle__label';
      label.textContent = opt.label;
      btn.appendChild(label);

      btn.addEventListener('click', function () {
        setMode(opt.mode);
      });

      root.appendChild(btn);
    });

    highlight(mode);
  }

  var mode = getMode();
  apply(mode);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      mount(mode);
    });
  } else {
    mount(mode);
  }

  // Следим за системной темой (для режима «система»).
  if (window.matchMedia) {
    var query = window.matchMedia(DARK_QUERY);
    var onSystemChange = function () {
      apply(getMode());
    };
    if (query.addEventListener) {
      query.addEventListener('change', onSystemChange);
    } else if (query.addListener) {
      query.addListener(onSystemChange);
    }
  }
})();
