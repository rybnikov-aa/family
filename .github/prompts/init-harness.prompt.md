---
name: 'Init Harness'
description: 'Инициализировать репозиторный харнесс и стартовую спецификацию в монорепозитории: AGENTS.md, docs/specification*.md, docs/adr.md, .github/skills, .github/agents, .github/harness/repo-memory.md, README, .env.example. Use when: нужен каркас правил/спецификации с нуля, «создай/инициализируй харнесс», «заведи спецификацию как в family», онбординг нового монорепо в Spec-Driven Development, «нет AGENTS.md и docs — сделай как в проекте family».'
argument-hint: 'Монореп: стек и модули (или пусто — определю по коду)'
agent: 'agent'
---

# Инициализация харнесса и спецификации (монорепозиторий)

Загрузи и выполни навык **`.github/skills/harness-init/SKILL.md`** — там процедура (шаги 0–7),
принципы и готовые шаблоны в `references/`:

| Шаблон                                            | Куда копируется                                               |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `references/agents-md.md`                         | `AGENTS.md`                                                   |
| `references/specification.md`                     | `docs/specification.md`                                       |
| `references/module-spec-and-adr.md`               | `docs/specification-<модуль>.md`, `docs/adr.md`               |
| `references/skill-and-agent.md`                   | `.github/skills/*/SKILL.md`, `.github/agents/*.agent.md`      |
| `references/repo-memory-readme-env.md`            | `.github/harness/repo-memory.md`, `README.md`, `.env.example` |
| `references/recon.md`, `references/validation.md` | разведка (шаг 0) и проверка (шаг 7)                           |

Ключевые требования к результату:

- всё содержимое документов подтверждено файлами репозитория или выполнением команд; непроверяемое —
  `TODO(verify): ...`, без выдуманных команд, путей, портов и скриптов;
- `AGENTS.md` — **единственный** источник конвенций; навыки и агенты ссылаются на него, не дублируют;
- существующие `AGENTS.md`, `docs/**`, `.github/**`, `README.md` не перезаписываются молча — сначала
  читать, дополнять, при правке показывать, что меняется;
- после шага 1 (`AGENTS.md`) — остановка на подтверждение пользователем, дальше спецификация, навыки,
  агенты, память репозитория, README и `.env.example`;
- в конце — чек-лист приёмки (`references/validation.md`) и отчёт: созданное, изменённое, оставшиеся
  `TODO(verify)`, что не тронуто и почему.

Аргумент после команды — стек и модули; если пусто, определи на шаге 0 и подтверди списком.
