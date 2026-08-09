import type { RenovationDraft } from './draft';

/**
 * Хранилище черновиков импорта PDF (этап 3).
 *
 * Черновик — результат «PDF → извлечение → классификация», живёт в памяти
 * до подтверждения (`POST /api/renovation/pdf/:id/confirm`) либо истечения TTL
 * (30 мин). Это транзиентное состояние сессии пользователя, БД не засоряем.
 */

const TTL_MS = 30 * 60 * 1000;

const drafts = new Map<string, { draft: RenovationDraft; expiresAt: number }>();

function cleanup(): void {
  const now = Date.now();
  for (const [id, entry] of drafts) {
    if (entry.expiresAt < now) drafts.delete(id);
  }
}

export function storeDraft(draft: RenovationDraft): void {
  cleanup();
  drafts.set(draft.id, { draft, expiresAt: Date.now() + TTL_MS });
}

export function getDraft(id: string): RenovationDraft | null {
  cleanup();
  const entry = drafts.get(id);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    drafts.delete(id);
    return null;
  }
  return entry.draft;
}
