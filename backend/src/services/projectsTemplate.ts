/**
 * Шаблон новой статичной страницы проекта — используется бэкендом по кнопке
 * «Создать проект» (`POST /api/projects`). Зеркалит `projects/_template/index.html`
 * (репозиторий), но с подстановкой параметров: папка `_template` на сервер не
 * деплоится, поэтому шаблон встроен в бэкенд, чтобы endpoint работал одинаково
 * локально и на сервере.
 */

export interface ProjectTemplateParams {
  /** Название проекта (карточка списка, `<title>`, `<h1>`). */
  title: string;
  /** Описание для карточки списка и подзаголовка страницы. */
  description: string;
  /** Акцентный цвет карточки (`#RRGGBB`). */
  accent: string;
  /** Имя иконки из списка: `renovation` | `folder` | `projects`. */
  icon: string;
  /** Порядок в списке (целое ≥ 0); не задано — проект уходит в конец списка. */
  order?: number;
}

/** Экранирует HTML-спецсимволы (вставка в атрибуты и текст страницы). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Собирает `index.html` нового проекта из встроенного шаблона (по образцу
 * `projects/_template/index.html`): общий каркас проектов + мета-теги списка
 * + акцентный цвет проекта.
 */
export function buildProjectHtml(p: ProjectTemplateParams): string {
  const title = escapeHtml(p.title);
  const description = escapeHtml(p.description);
  const orderMeta =
    p.order === undefined ? '' : `    <meta name="project-order" content="${p.order}" />\n`;

  const template = `<!doctype html>
<!--
  ============================================================================
  Страница проекта (раздел «Проекты» family.rybnikov.su).
  Создана автоматически по кнопке «Создать проект» (POST /api/projects)
  из встроенного шаблона бэкенда (аналог projects/_template/index.html).
  Мета-теги для списка проектов (GET /api/projects):
    <meta name="project-title">  — короткое название для карточки
    <meta name="description">    — подпись в карточке
    <meta name="project-accent"> — акцентный цвет карточки
    <meta name="project-icon">   — иконка (renovation | folder | projects)
    <meta name="project-order">  — порядок в списке
  ============================================================================
-->
<html lang="ru" data-theme="light">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- Применяем сохранённую тему до отрисовки, чтобы не было «мигания». -->
    <script>
      (function () {
        try {
          var t = localStorage.getItem('theme');
          var dark =
            t === 'dark' ||
            (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
          document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        } catch (e) {
          document.documentElement.setAttribute('data-theme', 'light');
        }
      })();
    </script>

    <!-- Метаданные для списка проектов (GET /api/projects) -->
    <meta name="project-title" content="{{TITLE}}" />
    <meta name="description" content="{{DESCRIPTION}}" />
    <meta name="project-accent" content="{{ACCENT}}" />
    <meta name="project-icon" content="{{ICON}}" />
{{ORDER_META}}
    <title>{{TITLE}} • family.rybnikov.su</title>

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,300;14..32,400;14..32,600;14..32,700&display=swap"
      rel="stylesheet"
    />

    <!-- Общие стили страниц проектов (дизайн + тема приложения) -->
    <link rel="stylesheet" href="/projects/styles.css" />

    <!-- Акцентный цвет проекта (используется в иконках, ховерах, акцентах) -->
    <style>
      :root {
        --project-accent: {{ACCENT}};
      }
    </style>
  </head>
  <body>
    <div class="container">
      <header class="header">
        <a href="/#/" class="brand">
          <h1>
            <span class="brand-mark"
              ><svg class="picon" aria-hidden="true">
                <use href="/projects/icon-sprite.svg#users"></use></svg></span
            >Семейное пространство
          </h1>
        </a>
        <div class="header-actions">
          <nav class="nav">
            <a href="/#/">Главная</a>
            <a href="/#/news">Новости</a>
            <a href="/#/projects" class="active">Проекты</a>
          </nav>
          <div class="theme-toggle" data-theme-toggle></div>
        </div>
      </header>

      <main class="page">
        <h1>{{TITLE}}</h1>
        <p class="page__sub">{{DESCRIPTION}}</p>

        <!-- Контент проекта: добавьте свои блоки (текст, таблицы, ссылки на подстраницы). -->
        <h2>Раздел проекта</h2>
        <p>
          Текст раздела. Добавляйте свои блоки: текст, таблицы, изображения, ссылки на подстраницы
          проекта.
        </p>
      </main>

      <footer class="footer">
        <span>© 2026 family.rybnikov.su</span>
        <span>
          <a href="/#/">Главная</a>
          <a href="/#/news">Новости</a>
          <a href="/#/projects">Проекты</a>
        </span>
      </footer>
    </div>

    <!-- Тема: рендер переключателя + слежение за системной темой -->
    <script src="/projects/theme.js" defer></script>
  </body>
</html>
`;

  return template
    .replaceAll('{{TITLE}}', title)
    .replaceAll('{{DESCRIPTION}}', description)
    .replaceAll('{{ACCENT}}', p.accent)
    .replaceAll('{{ICON}}', p.icon)
    .replaceAll('{{ORDER_META}}', orderMeta);
}
