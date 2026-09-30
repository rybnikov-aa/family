# Harness Requirements

Требования к репозиторию, агентам и процессу изменений. Это проектные правила, а не требования пользовательского продукта. Абсолютные ограничения и их приоритет задаются [guardrails](../../.github/harness/guardrails.md); здесь они каталогизируются и связываются с проверяемым поведением.

| ID                                                      | Категория                                            | Владелец/источник                                      |
| ------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| [HR-001](hr-001-document-ownership-and-traceability.md) | Нормативные документы и source-of-truth              | `AGENTS.md`, `docs/specification.md`                   |
| [HR-002](hr-002-artifact-naming-and-ids.md)             | Именование, структура и трассировка артефактов       | `AGENTS.md`, `docs/adr/index.md`, индексы CJ/FR/NFR/HR |
| [HR-003](hr-003-agent-safety-and-guardrails.md)         | Безопасность изменений и рабочие ограничения агентов | `.github/harness/guardrails.md`                        |
| [HR-004](hr-004-agent-roles-and-skills.md)              | Роли агентов и применение навыков                    | `.github/agents/`, `.github/skills/`                   |
| [HR-005](hr-005-validation-and-completion.md)           | Проверки, завершение задачи и отчетность             | `AGENTS.md`, package scripts, layer/domain specs       |
| [HR-006](hr-006-environment-and-change-control.md)      | Зависимости, среда и production-действия             | `AGENTS.md`, `docs/server.md`                          |

HR-записи описывают актуальное состояние repo harness, а не универсальные ограничения платформы.
