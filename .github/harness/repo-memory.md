# Repo memory

This file is the versioned repo memory. It is intentionally stored in Git so that every clone contains the same critical harness context, even when local memory under `/memories/` is absent.

## Non-negotiable rules

- Rule 15 remains active: before processing a user request with a DeepSeek model, check the current DeepSeek pricing window and confirm whether peak/off-peak pricing is active.
- If the active window is peak pricing, warn the user and wait for explicit confirmation before continuing.
- The pricing snapshot in [docs/pricing.md](../../docs/pricing.md) must be refreshed when the upstream docs change.

## Project context

- This repository is a monorepo with frontend and backend workspaces.
- The main project instructions live in [AGENTS.md](../../AGENTS.md).
- Local runtime memory under `/memories/` is a convenience mirror only and not the canonical source of truth.
- If a fact is important enough to survive across machines or sessions, it must be copied into this repository-backed memory.

## Cross-machine rule

When working from different PCs:

1. keep repo-level instructions and memory in tracked files
2. avoid relying on local-only memory to preserve project context
3. sync important notes from local memory to this folder before finishing a task
4. confirm the repo memory reflects the current constraints and recent findings

## Session note

This repository-backed memory is the default mechanism for cross-device continuity. It is intended to replace silent dependence on local-only memory.

## Operational notes (synced from local repo memory, 2026-08-18)

- **Renovation: server DB row ids ≠ local** (auto-increment, e.g. addendum №2 is id=123 locally but id=11 on the server). When fixing renovation data directly on the server, find rows by `label`/`pdf_path`/type+date, NOT by id. Re-import of an already-imported document is blocked by idempotency (type+date → 409) and there is no delete endpoint — fix wrong imported data via direct `UPDATE` on `server/data/renovation.sqlite` (`renovation_docs`, `renovation_doc_items`, `estimate_versions`). Details: `docs/specification-renovation.md`.
- **Server diagnostics for protected routes without an account** — temporary session row in the auth DB `sessions` (`token_hash` = SHA-256 hex, admin `user_id`, future `expires_at`) + `curl -b "sid=<token>"`. Details: `docs/server.md`.
- **pdf.js v6 API gotchas** — `render()` needs a `<canvas>`; `destroy()` lives on `PDFDocumentLoadingTask`, not `PDFDocumentProxy` (TS2339). Details: `docs/frontend-design.md`.
