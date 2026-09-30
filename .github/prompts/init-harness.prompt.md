---
name: 'Init Harness'
description: 'Инициализировать репозиторный харнесс и документы: guardrails.md, AGENTS.md, docs/layers, docs/domains, docs/adr, docs/cj, docs/fr, docs/nfr, docs/hr, traceability, integrations/operations/policies (если применимо), .github/skills, .github/agents, README, .env.example. Use when: нужен каркас с нуля, «создай харнесс», «сделай как в family», онбординг нового монорепо в Spec-Driven Development.'
argument-hint: 'Монореп: стек и модули (или пусто — определю по коду)'
agent: 'agent'
---

# Инициализация харнесса и спецификации (монорепозиторий)

Загрузи и выполни навык **`.github/skills/harness-init/SKILL.md`** — там процедура (шаги 0–7),
принципы и готовые шаблоны в `references/`:

| Шаблон                                            | Куда копируется                                               |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `references/guardrails.md`                        | `docs/guardrails.md`                                          |
| `references/agents-md.md`                         | `AGENTS.md`                                                   |
| `references/specification.md`                     | `docs/specification.md` (карта всех владельцев и документов)  |
| `references/layer-spec.md`                        | `docs/layers/<слой>.md`                                       |
| `references/module-spec-and-adr.md`               | `docs/domains/<домен>.md`, `docs/adr/adr-xxx-short-name.md`, `docs/adr/index.md` |
| `references/requirements-records.md`              | `docs/cj/`, `docs/fr/`, `docs/nfr/`, `docs/hr/`                |
| `references/skill-and-agent.md`                   | `.github/skills/*/SKILL.md`, `.github/agents/*.agent.md`      |
| `references/repo-memory-readme-env.md`            | `.github/harness/repo-memory.md`, `README.md`, `.env.example` |
| `references/recon.md`, `references/validation.md` | разведка (шаг 0) и проверка (шаг 7)                           |

Ключевые требования к результату:

- всё содержимое документов подтверждено файлами репозитория или выполнением команд; непроверяемое —
  `TODO(verify): ...`, без выдуманных команд, путей, портов и скриптов;
- `AGENTS.md` — источник общих конвенций; `docs/guardrails.md` — обязательных ограничений;
  спецификации — поведения и критериев приемки; навыки и агенты ссылаются на них, не дублируя;
- необходимый следующему агенту проектный контекст хранится в Git; память вне репозитория не является
  каноном; `repo-memory.md`, если нужен, также отслеживается Git и не дублирует владельцев;
- существующие `AGENTS.md`, `docs/**`, `.github/**`, `README.md` не перезаписываются молча — сначала
  читать, дополнять, при правке показывать, что меняется;
- подтверждение нужно только при расширении согласованного объема или перезаписи существующих файлов;
  согласованные этапы выполняются последовательно без повторных запросов одобрения;
- в конце — чек-лист приёмки (`references/validation.md`) и отчёт: созданное, изменённое, оставшиеся
  `TODO(verify)`, что не тронуто и почему.

Аргумент после команды — стек и модули; если пусто, определи на шаге 0 и подтверди списком.
