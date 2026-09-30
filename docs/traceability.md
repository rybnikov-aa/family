# Матрица трассировки требований

Документ связывает reverse-engineered пользовательские пути (CJ), функциональные требования (FR), нефункциональные требования (NFR), требования к harness (HR), домены, технические слои и источники проверок. Он индексирует связи, но не заменяет критерии приемки в domain specifications.

## Модель трассировки

```text
CJ (пользовательский путь) -> FR (поведение продукта) -> domain spec + implementation -> API/layer -> acceptance/verification
NFR (качество/ограничение) -> применимые FR/CJ -> source controls -> method of verification
HR (правило разработки/репозитория) -> normative owner -> check/evidence
```

Идентификаторы и filenames определяются правилом 17 в `AGENTS.md`. Каталоги категорий содержат `index.md` и записи; исходные domain FR labels (например `FR-11`, `FR-13`, `FR-20`) пока сохраняются как legacy references внутри domain specs.

## CJ → FR → домен/слой

| CJ                                                | FR             | Domain source                                                     | Layer/API source                                                                         |
| ------------------------------------------------- | -------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [CJ-001](cj/cj-001-login-and-navigate.md)         | FR-001, FR-008 | [auth](domains/auth.md); news/home описаны в FR-008               | [frontend](layers/frontend.md), [middleware](layers/middleware.md), [API](layers/api.md) |
| [CJ-002](cj/cj-002-profile-and-user-admin.md)     | FR-002         | [auth](domains/auth.md)                                           | [middleware](layers/middleware.md), [API](layers/api.md)                                 |
| [CJ-003](cj/cj-003-monitor-vps.md)                | FR-003         | [VPS](domains/vps.md)                                             | [backend](layers/backend.md), [frontend](layers/frontend.md), [API](layers/api.md)       |
| [CJ-004](cj/cj-004-administer-vps.md)             | FR-003         | [VPS](domains/vps.md)                                             | [middleware](layers/middleware.md), [API](layers/api.md)                                 |
| [CJ-015](cj/cj-015-review-vps-history.md)         | FR-003, FR-011 | [VPS](domains/vps.md)                                             | [backend](layers/backend.md), [frontend](layers/frontend.md), [API](layers/api.md)       |
| [CJ-005](cj/cj-005-browse-projects.md)            | FR-004         | [Projects](domains/projects.md)                                   | [backend](layers/backend.md), [frontend](layers/frontend.md), [API](layers/api.md)       |
| [CJ-006](cj/cj-006-review-renovation.md)          | FR-005         | [Renovation](domains/renovation.md)                               | [backend](layers/backend.md), [frontend](layers/frontend.md), [API](layers/api.md)       |
| [CJ-007](cj/cj-007-import-renovation-document.md) | FR-005         | [Renovation](domains/renovation.md)                               | [middleware](layers/middleware.md), [backend](layers/backend.md), [API](layers/api.md)   |
| [CJ-008](cj/cj-008-apply-estimate-addendum.md)    | FR-005         | [Renovation](domains/renovation.md)                               | [backend](layers/backend.md), [API](layers/api.md)                                       |
| [CJ-009](cj/cj-009-browse-diary.md)               | FR-006         | [Diary](domains/diary.md)                                         | [frontend](layers/frontend.md), [API](layers/api.md)                                     |
| [CJ-010](cj/cj-010-manage-diary-event.md)         | FR-006         | [Diary](domains/diary.md)                                         | [middleware](layers/middleware.md), [API](layers/api.md)                                 |
| [CJ-011](cj/cj-011-edit-diary-description.md)     | FR-006, FR-007 | [Diary](domains/diary.md), [Immich guide](integrations/immich.md) | [frontend](layers/frontend.md), [API](layers/api.md)                                     |
| [CJ-012](cj/cj-012-connect-immich-and-import.md)  | FR-007         | [Immich guide](integrations/immich.md), [Diary](domains/diary.md) | [backend](layers/backend.md), [middleware](layers/middleware.md), [API](layers/api.md)   |
| [CJ-013](cj/cj-013-manage-plans.md)               | FR-009         | [Plans](domains/plans.md)                                         | [backend](layers/backend.md), [frontend](layers/frontend.md), [API](layers/api.md)       |
| [CJ-014](cj/cj-014-global-search.md)              | FR-010         | [Search](domains/search.md)                                       | [backend](layers/backend.md), [frontend](layers/frontend.md), [API](layers/api.md)       |

## FR → реализация и проверка

| FR                                                     | Покрывающие CJ | Domain/feature owner                                        | Основные implementation/contract points                                  | Проверка                                                                               |
| ------------------------------------------------------ | -------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| [FR-001](fr/fr-001-authentication-and-sessions.md)     | CJ-001         | [Auth](domains/auth.md)                                     | `authService`, `middlewares/auth.ts`, `hooks/useAuth.tsx`, `AuthGate`    | Login/me/logout, 401/403 в [API](layers/api.md); domain acceptance                     |
| [FR-002](fr/fr-002-profile-and-user-administration.md) | CJ-002         | [Auth](domains/auth.md)                                     | `authController`, `ProfilePage`, `AdminUsersPage`, `users.mjs`           | Profile validation, admin CRUD и CLI сценарии в domain/API specs                       |
| [FR-003](fr/fr-003-vps-monitoring.md)                  | CJ-003, CJ-004 | [VPS](domains/vps.md)                                       | `vpsChecker`, `vpsRepository`, `VpsDetailsModal`, `availability.ts`      | Проверка типов/формул/cache, CRUD/import и domain acceptance                           |
| [FR-011](fr/fr-011-vps-history.md)                     | CJ-015         | [VPS](domains/vps.md)                                       | `vpsHistoryRepository`, `vpsHistoryService`, `VpsHistoryModal`           | Хранение точек, расчёт инцидентов, API и UI smoke/typecheck                            |
| [FR-004](fr/fr-004-project-catalog.md)                 | CJ-005         | [Projects](domains/projects.md)                             | `appProjects.ts`, `projectsService`, `ProjectsPage`, `ProjectPage`       | Registry+DB list, validation/conflict CRUD, project routes                             |
| [FR-005](fr/fr-005-renovation-reporting.md)            | CJ-006–CJ-008  | [Renovation](domains/renovation.md)                         | renovation repositories/services, PDF subprocess, reports and addenda UI | Import draft/confirm, idempotency, totals, PDF access, acceptance criteria             |
| [FR-006](fr/fr-006-family-diary.md)                    | CJ-009–CJ-011  | [Diary](domains/diary.md)                                   | `diaryService`, `imageStore`, Diary pages/editor/photo modal             | CRUD, sorting, image lifecycle, markdown/editor and domain criteria                    |
| [FR-007](fr/fr-007-immich-integration.md)              | CJ-011, CJ-012 | [Immich](integrations/immich.md), [Diary](domains/diary.md) | `immichService`, settings controller, `ImmichPickerModal`                | Credentials not exposed, admin proxy, search, download/progress and import constraints |
| [FR-008](fr/fr-008-home-news-and-health.md)            | CJ-001         | [Frontend](layers/frontend.md)                              | `HomePage`, `NewsPage`, `PageLayout`, health router                      | Nav links, static news rendering, public health status; unavailable routes redirect    |
| [FR-009](fr/fr-009-plans.md)                           | CJ-013         | [Plans](domains/plans.md)                                   | `plansService`, `PlansPage`, `PlanTaskModal`                             | CRUD, filters, role checks, typecheck/build                                            |
| [FR-010](fr/fr-010-global-search.md)                   | CJ-014         | [Search](domains/search.md)                                 | `searchService`, `SearchPage`, `PageLayout`                              | Search API auth, result links, empty/error states, typecheck/build                     |

FR acceptance detail remains in linked domain/API specifications. No claim of automated coverage is made where only documented/manual acceptance checks exist.

## NFR → FR and verification

| NFR                                                       | Applies to                             | Controls / evidence                                                                                 | Verification source                                                                                    |
| --------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| [NFR-001](nfr/nfr-001-security-and-privacy.md)            | FR-001, FR-002, FR-005, FR-006, FR-007 | Auth middleware, server-side role checks, secret handling, file path validation, renovation privacy | [Middleware](layers/middleware.md), auth/renovation domains, [guardrails](guardrails.md), API 401/403  |
| [NFR-002](nfr/nfr-002-availability-and-degradation.md)    | FR-001, FR-003, FR-005–FR-011          | Public health route, UI loading/error states, API 404/500, draft-confirm import boundary            | [Backend](layers/backend.md), [Frontend](layers/frontend.md), [API](layers/api.md), domain error flows |
| [NFR-003](nfr/nfr-003-performance.md)                     | FR-003, FR-006, FR-007, FR-010         | VPS cache/dedup/history sampling, lazy image previews, streamed Immich downloads, lazy chunks       | VPS/Diary/Search domains, [Immich](integrations/immich.md), [Frontend](layers/frontend.md)             |
| [NFR-004](nfr/nfr-004-accessibility-and-responsive-ui.md) | FR-001, FR-003–FR-011                  | Keyboard semantics, modal focus handling, themes, responsive layouts, status labels                 | [Frontend layer](layers/frontend.md), [design system](layers/design-system.md), domain UI acceptance   |
| [NFR-005](nfr/nfr-005-data-durability-and-recovery.md)    | FR-003–FR-006, FR-009, FR-011          | Separate SQLite DBs, persistent PDF/image storage, VPS history retention, deploy preservation       | [Backend](layers/backend.md), [backup](operations/backup.md), [server](operations/server.md), domains  |
| [NFR-006](nfr/nfr-006-runtime-and-compatibility.md)       | All server/client journeys             | Node floor, hash routing, Python/pdfplumber configuration, pm2 startup, env namespaces              | [Backend](layers/backend.md), [Frontend](layers/frontend.md), AGENTS, [server](operations/server.md)   |

## HR → owner and check

| HR                                                         | Normative owner                                                                | Check/evidence                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| [HR-001](hr/hr-001-document-ownership-and-traceability.md) | `AGENTS.md`, [guardrails](guardrails.md), this matrix, `docs/specification.md` | Document ownership, Git-only context and trace links maintained           |
| [HR-002](hr/hr-002-artifact-naming-and-ids.md)             | `AGENTS.md`, category indexes                                                  | Filename regex, sequential IDs, index covers every record                 |
| [HR-003](hr/hr-003-agent-safety-and-guardrails.md)         | [guardrails](guardrails.md)                                                    | Agent/skill instructions do not weaken guardrails                         |
| [HR-004](hr/hr-004-agent-roles-and-skills.md)              | `.github/agents/`, `.github/skills/`                                           | Role scope, owner layers, skill trigger and tool scope                    |
| [HR-005](hr/hr-005-validation-and-completion.md)           | `AGENTS.md`, layer/domain acceptance                                           | Define criteria before implementation; verify implementation against them |
| [HR-006](hr/hr-006-environment-and-change-control.md)      | `AGENTS.md`, server/backup guides                                              | Env ownership, deployment authorization, backup/recovery process          |

## Непокрытая/ограниченная функциональность

- Новости остаются статическими и read-only; создание/публикация новостей не подтверждены кодом.
- Реестр описывает состояние проекта на дату reverse engineering; изменение кода требует обновления trace links и статуса соответствующего требования.
