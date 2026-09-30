# ADR-018: Exclude generated directories from formatting

- **Статус:** принято

## Контекст

Форматирование всего репозитория затрагивало содержимое локального Python virtualenv и generated output.

## Решение

Исключить `.venv/`, `dist/`, `node_modules/` и `temp/` в `.prettierignore`.

## Альтернативы

Не настраивать ignore-файл и форматировать все найденные файлы.

## Обоснование и последствия

`npm run format` больше не обрабатывает HTML из `.venv`; форматировать следует только изменяемые файлы, чтобы не создавать CRLF/LF шум на Windows.
