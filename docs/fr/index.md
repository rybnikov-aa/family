# Functional Requirements

Реестр функциональных требований, восстановленных по реализованному приложению и его domain/API specifications. Старые доменные коды (например, FR-11, FR-13, FR-20) сохранены как traceability aliases; новые стабильные идентификаторы имеют вид `FR-xxx.n`.

| ID                                                  | Область                                          | Источник реализации / уточнения                                            | Journeys       |
| --------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------- | -------------- |
| [FR-001](fr-001-authentication-and-sessions.md)     | Вход, сессии, роли и авторизация                 | [domain auth](../domains/auth.md), [API](../layers/api.md)                 | CJ-001         |
| [FR-002](fr-002-profile-and-user-administration.md) | Профиль и управление пользователями              | [domain auth](../domains/auth.md)                                          | CJ-002         |
| [FR-003](fr-003-vps-monitoring.md)                  | Мониторинг и администрирование VPS               | [domain VPS](../domains/vps.md), [API](../layers/api.md)                   | CJ-003, CJ-004 |
| [FR-004](fr-004-project-catalog.md)                 | Каталог и пользовательские проекты               | [domain projects](../domains/projects.md), [API](../layers/api.md)         | CJ-005         |
| [FR-005](fr-005-renovation-reporting.md)            | Отчетность ремонта, PDF, смета и доп. соглашения | [domain renovation](../domains/renovation.md), [API](../layers/api.md)     | CJ-006–CJ-008  |
| [FR-006](fr-006-family-diary.md)                    | Семейный дневник и управление событиями          | [domain diary](../domains/diary.md), [API](../layers/api.md)               | CJ-009–CJ-011  |
| [FR-007](fr-007-immich-integration.md)              | Подключение Immich и фотоимпорт                  | [Immich guide](../integrations/immich.md), [API](../layers/api.md)         | CJ-011, CJ-012 |
| [FR-008](fr-008-home-news-and-health.md)            | Главная, навигация, новости и health status      | [layer frontend](../layers/frontend.md), `frontend/src/pages/NewsPage.tsx` | CJ-001         |
| [FR-009](fr-009-plans.md)                           | Планы и задачи                                   | [domain plans](../domains/plans.md), [API](../layers/api.md)               | CJ-013         |
| [FR-010](fr-010-global-search.md)                   | Глобальный поиск                                 | [domain search](../domains/search.md), [API](../layers/api.md)             | CJ-014         |
| [FR-011](fr-011-vps-history.md)                     | История доступности VPS                          | [domain VPS](../domains/vps.md), [API](../layers/api.md)                   | CJ-015         |
| [FR-012](fr-012-diary-enrichment.md)                | Расширенный дневник                              | [domain diary](../domains/diary.md), [API](../layers/api.md)               | CJ-016         |
| [FR-013](fr-013-diary-export.md)                    | Экспорт дневника                                 | [domain diary](../domains/diary.md), [API](../layers/api.md)               | CJ-017         |

Нефункциональные требования размещены отдельно в [`docs/nfr/`](../nfr/index.md); требования к процессу разработки и агентскому харнессу — в [`docs/hr/`](../hr/index.md).
