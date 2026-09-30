# HR-006: Окружение и контроль изменений

- **Статус:** действует
- **Источники:** `AGENTS.md`, `.env.example`, `docs/operations/server.md`, `docs/operations/backup.md`, guardrails.

## Требования

- **HR-006.1** Не смешивать три env namespaces: root `.env` для deployment, `backend/.env` для runtime, `frontend/.env` для `VITE_*`.
- **HR-006.2** Backend требует Node.js ≥22.5; проектные npm dependencies не добавляются без явного запроса.
- **HR-006.3** Production target фиксирован `my.rybnikov.su`; изменения production среды, deploy, service restart и данные требуют явного запроса.
- **HR-006.4** Runtime databases, uploaded PDFs, diary images и env сохраняются при deploy и входят в backup/restore ownership как описано в server/backup guides.
- **HR-006.5** Для изменения ADR/CJ/FR/NFR/HR индексы и cross-references поддерживаются в той же задаче; не оставлять висячие ссылки после move/delete.

## Проверка

Подтверждать env readers по коду/примеру, production commands — по server guide, recovery ownership — по backup guide.
