---
description: 'Use when working in projects/**: общие конвенции статичных страниц проектов family — каркас (/projects/styles.css, theme.js, icon-sprite.svg), мета-теги (project-title, description, project-accent, project-icon, project-order), структура проекта (index.html, многодокументные подстраницы .cards/.doc), гибридные таблицы с тёмной темой, иконки только SVG из спрайта, формат чисел, публикация через npm run deploy. Не для проекта «Ремонт» — у него свои конвенции (project.renovation.instructions.md).'
name: 'Project Pages Conventions'
applyTo: ['projects/**']
---

# Project Pages Conventions (family)

Общие конвенции статичных HTML-страниц проектов в `projects/`. Проект = подпапка
`projects/<slug>/` с файлом `index.html`. **Для «Ремонта» (`projects/renovation/**`) действуют
свои конвенции — см. `project.renovation.instructions.md`** (акцент `#e8872e`, структура
`Works/`/`Materials/`/`Settlement/`/`Reports/`); общие правила ниже применимы и к нему, если не
оговорено иное.

## Как бэкенд видит проект

- `GET /api/projects` сканирует подпапки `PROJECTS_DIR` с `index.html` (кэш 60 с). Папки,
  начинающиеся с `_` или `.`, проектами не считаются (поэтому `projects/_template` — это заготовка,
  а не проект, и не деплоится).
- URL проекта на сервере — `/projects/<slug>/` (например, `https://family.rybnikov.su/projects/dacha/`).

## Мета-теги в `index.html`

| Мета-тег         | Назначение                                                               | Пример           |
| ---------------- | ------------------------------------------------------------------------ | ---------------- |
| `project-title`  | Короткое название для карточки (приоритетнее `<title>`)                  | `Дача`           |
| `description`    | Подпись в карточке списка                                                | `План и стройка` |
| `project-accent` | Акцентный цвет карточки (hex, по умолчанию `#3b82f6`)                    | `#16a34a`        |
| `project-icon`   | Иконка в списке: `renovation` \| `folder` \| `projects` (иначе fallback) | `folder`         |
| `project-order`  | Порядок в списке (сортировка по `order`, затем по названию, ru)          | `2`              |

`<title>` — `Название • family.rybnikov.su`. Акцент переопределяется CSS-переменной
`--project-accent` в `<style>` в `<head>` (задаёт акценты иконок/ховеров) — должен совпадать с
мета-тегом `project-accent`.

## Каркас страницы

- Подключение: `<link href="/projects/styles.css">`, inline-скрипт применения темы в `<head>`
  (без «мигания»), `<script src="/projects/theme.js" defer></script>` в конце `<body>`.
- Разметка: `<div class="container">` → `<header class="header">` → `<main class="page">` →
  `<footer class="footer">`; контент документа — в `<div class="doc">`; ссылка возврата —
  `<a class="doc-back" href="...">← …</a>`.
- Ссылки на приложение — hash-роутинг: `/#/`, `/#/news`, `/#/projects` (в шаблоне уже есть).

## Многодокументный проект

- Главная проекта — сетка карточек: `<div class="cards">` → `<a class="card" href="sub.html">`
  с `<div class="icon">`, `<div class="body">` (`.title`, `.desc`) и `<div class="arrow">→</div>`.
  Образец — блок `.cards` в `projects/renovation/index.html`.
- Подстраницы — отдельные HTML в той же папке проекта (`<slug>/sub.html`), по образцу подстраниц
  `projects/renovation/` (каркас + `<div class="doc">` + `doc-back`).
- Вложенные смысловые папки — по необходимости (`Works/`, `Materials/`, `Settlement/` и т.п.).

## Таблицы и документы

- Табличные стили — локальные `<style>` в `<head>` (гибридный подход); **не использовать классы
  каркаса** (`.container`, `.header`, `.footer`, `.card`, `.stats`, `.stat`) внутри документа.
- Обязательна тёмная тема: `[data-theme='dark'] .doc { ... }` (и для таблиц).
- Числа: суммы через неразрывный пробел, запятая как десятичный разделитель (`141 127,88 ₽`).

## Иконки — только SVG

- Эмодзи как иконки не использовать. Общий цветной спрайт — `/projects/icon-sprite.svg`.
  Подключение: `<svg class="picon" aria-hidden="true"><use href="/projects/icon-sprite.svg#имя"></use></svg>`.
- Размер задаёт класс `.picon` (1em, масштабируется под контекст: в карточках `.card .icon` —
  34px, в ячейках таблиц ~13px).
- Новой иконки нет в спрайте — добавь `<symbol id="...">` в `/projects/icon-sprite.svg`,
  сохранив цвет исходной эмодзи, которую она заменяет. Бренд в шапке — `#users`
  (контурный, наследует `currentColor`).

## Публикация

- `npm run deploy` зеркалит папку `projects/` репозитория в `public_html/projects/` (и подпапки
  проектов — `projects/<slug>/` → `/projects/<slug>/`, и общие файлы `styles.css`/`theme.js`/
  `icon-sprite.svg`); папки `_*` не деплоятся.
- **Удаление папки проекта из репозитория НЕ удаляет её с сервера** — если проект нужно снять,
  удалить его надо вручную на сервере.
- Перед деплоем — подтверждение пользователя; после — проверка `curl -i
https://family.rybnikov.su/api/projects` (кэш 60 с) и открытие `https://family.rybnikov.su/projects/<slug>/`.

## Ссылки

- Создание/импорт нового проекта — навык `project-import` (`.github/skills/project-import/SKILL.md`).
- Отчётность по ремонту — навык `project-renovation-build-reports`
  (`.github/skills/project-renovation-build-reports/SKILL.md`).
- Конвертация PDF в HTML — навык `parse-pdf` (`.github/skills/parse-pdf/SKILL.md`).
- Деплой и диагностика — навык `deploy` (`.github/skills/deploy/SKILL.md`), `README.md` «Деплой».
- Детали проекта «Ремонт» — `project.renovation.instructions.md`.
