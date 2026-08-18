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
