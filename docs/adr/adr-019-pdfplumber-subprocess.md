# ADR-019: Run pdfplumber through a Python subprocess

- **Статус:** принято

## Контекст

PDF импортируется в Node backend, но выбранный парсер pdfplumber реализован на Python.

## Решение

Запускать `backend/scripts/extract_pdf.py` как subprocess и обмениваться JSON через stdout; interpreter и script настраиваются через `RENOVATION_PYTHON` и `RENOVATION_EXTRACT_SCRIPT`.

## Альтернативы

Node PDF-библиотеки или MCP-сервер.

## Обоснование и последствия

Используется выбранный pdfplumber. Python-скрипт принудительно пишет UTF-8, чтобы stdout одинаково читался в Windows и production Linux.
