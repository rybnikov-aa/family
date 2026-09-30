# Решения и обоснования (ADR-lite)

Каждое решение подробно описано в отдельном файле `adr-xxx-short-name.md`. Номера последовательны
и не переиспользуются; имя после номера — короткий английский slug.

## Отдельные записи

- [ADR-001: VPS configuration in SQLite](adr-001-vps-sqlite-storage.md)
- [ADR-002: Check VPS availability on the backend](adr-002-backend-vps-checks.md)
- [ADR-003: Render country flags from ISO codes](adr-003-country-flag-assets.md)
- [ADR-004: Separate host probes from service probes](adr-004-vps-port-probes.md)
- [ADR-005: Probe ocserv over TCP and DTLS](adr-005-ocserv-dtls-probes.md)
- [ADR-006: Use an accessible clickable VPS card](adr-006-clickable-vps-card.md)
- [ADR-007: Place refresh beside the VPS metric](adr-007-inline-vps-refresh.md)
- [ADR-008: Force VPS refresh with a query parameter](adr-008-forced-vps-refresh.md)
- [ADR-009: Manage VPS from the application](adr-009-vps-runtime-management.md)
- [ADR-010: Import VPS from JSON in batches](adr-010-vps-json-import.md)
- [ADR-011: Store application projects in a registry and database](adr-011-database-backed-projects.md)
- [ADR-012: Use cookie sessions for authentication](adr-012-cookie-session-auth.md)
- [ADR-013: Isolate renovation data in its own database](adr-013-renovation-database.md)
- [ADR-014: Represent money and quantities as scaled integers](adr-014-integer-money-values.md)
- [ADR-015: Derive implicit overhead for material orders](adr-015-material-overhead.md)
- [ADR-016: Use only the latest cumulative settlement act](adr-016-cumulative-settlements.md)
- [ADR-017: Keep the renovation schema in one source](adr-017-single-schema-source.md)
- [ADR-018: Exclude generated directories from formatting](adr-018-prettier-ignore.md)
- [ADR-019: Run pdfplumber through a Python subprocess](adr-019-pdfplumber-subprocess.md)
- [ADR-020: Review PDF drafts before database import](adr-020-reviewed-pdf-import.md)
- [ADR-021: Apply estimate addenda through a proposal and versioning](adr-021-versioned-estimate-addenda.md)
- [ADR-022: Build renovation reports from database records](adr-022-database-derived-reports.md)
- [ADR-023: Open the renovation project in the application](adr-023-renovation-spa-route.md)
- [ADR-024: Persist imported renovation PDFs](adr-024-persisted-pdf-documents.md)
- [ADR-025: Match duplicate work items by section and position](adr-025-positional-report-matching.md)
