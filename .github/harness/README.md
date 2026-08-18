# Harness and repo memory

This directory is part of the repository and must be kept under version control.

The goal is simple:

- keep project-critical context in Git so a fresh clone contains the same harness and memory
- treat local runtime memory under `/memories/` as a convenience mirror only
- sync important findings from local memory into this repo before closing a task

## Rules

1. The source of truth for repo-level instructions is the tracked files in this repository, especially [AGENTS.md](../../AGENTS.md).
2. Local memory files under `/memories/` are not authoritative and must not replace repo-scoped documentation.
3. Any important debugging fact, rule, or migration note must be written into the repo memory docs in this folder.
4. If a fact changes behavior or policy, update the corresponding docs in the repository in the same task.

## Files

- [repo-memory.md](./repo-memory.md) — persistent project memory that is safe to clone and share
