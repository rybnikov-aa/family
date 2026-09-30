# Non-functional Requirements

Сквозные качества, ограничения и измеримые свойства приложения. Доменная логика остается в `docs/domains/`, а здесь фиксируются требования, действующие между несколькими доменами или слоями.

| ID                                                    | Категория                             | Основные источники                                                        |
| ----------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------- |
| [NFR-001](nfr-001-security-and-privacy.md)            | Безопасность и приватность            | `docs/layers/middleware.md`, `docs/domains/auth.md`, guardrails           |
| [NFR-002](nfr-002-availability-and-degradation.md)    | Доступность и деградация              | `docs/layers/backend.md`, `docs/layers/frontend.md`, `docs/layers/api.md` |
| [NFR-003](nfr-003-performance.md)                     | Производительность                    | `docs/domains/vps.md`, `docs/domains/diary.md`, `docs/immich.md`          |
| [NFR-004](nfr-004-accessibility-and-responsive-ui.md) | Доступность интерфейса и адаптивность | `docs/frontend-design.md`, `docs/layers/frontend.md`                      |
| [NFR-005](nfr-005-data-durability-and-recovery.md)    | Сохранность и восстановление данных   | `docs/layers/backend.md`, `docs/backup.md`, domain specs                  |
| [NFR-006](nfr-006-runtime-and-compatibility.md)       | Runtime и совместимость               | `AGENTS.md`, `docs/layers/backend.md`, `docs/server.md`                   |

Каждая запись содержит формулировки `NFR-xxx.n`, область проверки и наблюдаемое подтверждение либо явно помеченную проверку, которой пока нет.
