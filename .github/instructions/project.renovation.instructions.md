---
description: 'Use when working in projects/renovation/**: HTML-подстраницы проекта «Ремонт», конвертация PDF в HTML, формирование отчётности по ремонту (смета estimate.html, акты Works/, материалы Materials/, взаиморасчёты Settlement/), конвенции оформления (styles.css, тема, акцент #e8872e), публикация /renovation/ через npm run deploy.'
name: 'Renovation Project Conventions'
applyTo: ['projects/renovation/**']
---

# Project Renovation (family)

Проект «Ремонт» — статичный HTML-проект семейного приложения, лежит в `projects/renovation/`.
Деплоится в `/renovation/` через `npm run deploy` (`scripts/deploy.mjs`).

## Структура

- `index.html` — главная проекта (шаблон конвенций: тема, каркас).
- `estimate.html` — смета (план).
- `Works/` — акты выполненных работ (`act_*.html`).
- `Materials/` — отчёты о закупке материалов (`report_*.html`).
- `Settlement/` — акты взаиморасчётов (`sm_works_*.html`, `sm_materials_*.html`).
- `Reports/` — формируемые отчёты (`report_work.html`, `report_materials.html`, `report_final.html`).

## Навыки для этого проекта

- **project-renovation-build-reports** — формирование отчётности из HTML-документов проекта.
  Триггеры: «сформируй отчёты», «отчёт о ходе работ», «сводный отчёт по материалам»,
  «итоговый отчёт», «сводка по ремонту», «отчёт по материалам», «составь отчётность».
- **parse-pdf** — конвертация PDF в HTML (пользователь дал PDF-файл: смету, акт, счёт, таблицу).
  Результаты класть в смысловую подпапку (`Works/`, `Materials/`, `Settlement/`, `estimate.html`).

## Синхронизация документации и навыков

- Любое изменение макета/структуры подстраниц и отчётов `projects/renovation/**` сопровождать
  синхронной правкой: `.github/skills/project-renovation-build-reports/SKILL.md` (шапка, блоки,
  таблицы, статусы) и `docs/specification.md` (раздел «Проекты»).
- После правки проверять `grep` по документации, что не осталось устаревших маркеров старого
  макета (старые классы, удалённые подписи/поля).
- `README.md` и этот файл обновлять, если меняется перечень файлов/структура проекта.

## Конвенции оформления подстраниц

- Каркас: `<link href="/projects/styles.css">` + `<script src="/projects/theme.js" defer>`,
  акцент `--project-accent: #e8872e` (`--project-accent-soft: rgba(232,135,46,.14)`),
  тема light/dark/system, inline-скрипт применения темы в `<head>` (без «мигания»).
- Разметка: `<div class="container">` → `<header class="header">` → `<main class="page">` →
  `<footer class="footer">`; контент документа — в `<div class="doc">`; ссылка возврата —
  `<a class="doc-back" href="/renovation/">← К отчётам проекта</a>`.
- Табличные стили — локальные `<style>` в `<head>` (гибридный подход); не использовать классы
  каркаса (`.container`, `.header`, `.footer`, `.card`, `.stats`, `.stat`) внутри документа.
- Обязательна тёмная тема: `[data-theme='dark'] .doc { ... }`.
- Числа: суммы через неразрывный пробел, запятая как десятичный разделитель (`141 127,88 ₽`).
- Иконки — только SVG из общего спрайта `/projects/icon-sprite.svg`
  (`<svg class="picon" aria-hidden="true"><use href="/projects/icon-sprite.svg#имя"></use></svg>`);
  цвет сохранён от исходной эмодзи, бренд в шапке — `#users`. Эмодзи как иконки не использовать.
