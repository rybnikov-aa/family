---
description: 'Use when changing frontend code in frontend/src/**: React компоненты, страницы, хуки, API-клиент, CSS, index.html. Покрывает hash-роутинг (react-router), тему (CSS-переменные, useTheme), поток данных (api/client.ts + хуки), инлайн SVG-иконки, доступность, конвенции TypeScript/Prettier.'
name: 'Frontend Conventions'
applyTo:
  [
    'frontend/src/**',
    'frontend/index.html',
    'frontend/vite.config.ts',
    'frontend/tsconfig.json',
    'frontend/.env.example',
  ]
---

# Frontend Conventions (family)

## Роутинг

- Только `react-router-dom` v7 + `createHashRouter` (в `App.tsx`). **Hash-роутинг обязателен** — nginx без SPA-fallback (`try_files ... =404`). Не менять на history-роутинг.
- Пути — константы `ROUTES` в `routes.ts`. Внутренние ссылки — `Link`/`NavLink` (авто-класс `active`); внешние (например `/renovation/`) — обычный `<a>`.

## Тема

- Режимы light/dark/system через `hooks/useTheme.ts` (ключ `localStorage['theme']`, `data-theme` на `<html>`).
- Цвета — **только** CSS-переменные в `index.css` (`:root` — светлая, `[data-theme='dark']` — тёмная). Не хардкодить hex в компонентах/стилях.
- Не ломать инлайн-скрипт темы в `index.html` (применяет тему до отрисовки, без «мигания»).

## Поток данных

- Fetch — только через `frontend/src/api/client.ts` (база `VITE_API_BASE_URL ?? '/api'`).
- Состояние — через хуки в `hooks/` (`useServices`, `useVps`, `useProjects`, `useHealth`, `useTheme`).
- Принудительная перепроверка (GET-кэш бэкенда 30с): `fetchVps(true)` (`?refresh=1`).

## Иконки

- Инлайн SVG-компоненты в `components/icons.tsx` с `stroke="currentColor"`. Внешние библиотеки иконок не добавлять.

## Доступность / интерактив

- Карточка с вложенной кнопкой — `<div role="button" tabIndex={0}>`; вложенная кнопка вызывает `event.stopPropagation()`, чтобы не открывать карточку (паттерн кликабельной карточки VPS).

## TypeScript и форматирование

- `noUnusedLocals`/`noUnusedParameters` включены → неиспользуемые переменные/параметры — ошибки (TS6133); неиспользуемые параметры называть `_req`/`_next`.
- Prettier: singleQuote, semi, printWidth 100, trailingComma all.

## Язык

- Комментарии и строки UI — на русском.

## Конфигурация (frontend/)

- `vite.config.ts`: dev-порт 5173, proxy `/api` → `http://localhost:3000` — не менять без явной задачи.
- `tsconfig.json`: расширяет `tsconfig.base.json`; `strict`, `noUnusedLocals`, `noUnusedParameters` не ослаблять.
- `.env.example`: только переменные с префиксом `VITE_` (например, `VITE_API_BASE_URL`); реальный `.env` в git не попадает.
