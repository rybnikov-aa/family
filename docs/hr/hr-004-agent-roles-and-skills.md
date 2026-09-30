# HR-004: Роли агентов и skills

- **Статус:** действует
- **Источники:** `AGENTS.md`, `.github/agents/`, `.github/skills/`.

## Требования

- **HR-004.1** Backend Dev владеет `backend/**`; Frontend Dev — `frontend/**`; Fullstack Dev координирует cross-layer contract и остаётся владельцем интеграции.
- **HR-004.2** Agent profiles задают роль, область файлов и доступ к инструментам; общие правила принадлежат AGENTS/guardrails, доменные знания — domain docs.
- **HR-004.3** Skills описывают процедуры по запросу (например, VPS, deploy, project import); не копируют shared rules и acceptance criteria.
- **HR-004.4** Cross-layer изменения сначала фиксируют API contract, затем согласуют backend/frontend types и docs.
- **HR-004.5** Не использовать архивированные agents/skills из `projects/**` как активные instructions; исторические документы остаются только архивом.

## Проверка

Для новой области выбрать минимальную роль/skill, определить scope, добавить ссылки на authoritative docs и исключить неиспользуемые шаблоны.
