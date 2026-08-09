import { sumKopecks } from './domain/money';
import type { EstimateItem, EstimateVersion } from './domain/types';

/**
 * Применение доп. соглашения к смете (этап 4).
 *
 * Модель (из навыка `project-renovation-update-from-pdf`):
 * - позиции доп. соглашения сопоставляются с позициями актуальной сметы по
 *   нормализованному наименованию: точное совпадение → «обновить» (changed),
 *   отсутствие → «новая» (new); позиции сметы, не затронутые соглашением, по
 *   умолчанию сохраняются (keep), пользователь может пометить их на удаление;
 * - после применения: сквозная перенумерация позиций, пересчёт итогов
 *   («Итого по всем разделам» + накладные 5% = «Итого»);
 * - версионирование: старая `current` замораживается как `history` (удалённые
 *   строки в ней помечаются `removed`), создаётся новая `current`.
 */

/** Накладные расходы — 5% (как в документах проекта). */
export const OVERHEAD_PERCENT = 5;

/** Нормализация наименования для сопоставления (регистр, пунктуация, пробелы). */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[|,.;:()«»"'`/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Секция сметы, в которую попадают новые позиции из доп. соглашения. */
export function targetSection(section: string): string {
  return section.replace(/\s*[—–-]\s*доп(?:олнительные)?\s*работы$/i, '').trim() || section;
}

export type AddendumDiffKind = 'update' | 'new' | 'keep' | 'remove';

/** Строка диффа: что будет с позицией сметы/доп. соглашения. */
export interface AddendumDiff {
  /** Нормализованное имя — стабильный ключ строки. */
  key: string;
  kind: AddendumDiffKind;
  section: string;
  name: string;
  unit: string | null;
  price: number | null;
  qty: number | null;
  sum: number | null;
  oldPrice: number | null;
  oldQty: number | null;
  oldSum: number | null;
}

export interface AddendumProposal {
  addendum: { id: number; date: string | null; label: string; total: number | null };
  current: { id: number; total: number | null };
  diffs: AddendumDiff[];
  newTotalNoOverhead: number | null;
  newOverhead: number | null;
  newTotal: number | null;
  needsReview: boolean;
  warnings: string[];
}

function overheadOf(totalNoOverhead: number): number {
  return Math.round((totalNoOverhead * OVERHEAD_PERCENT) / 100);
}

function itemDiff(
  item: EstimateItem,
  kind: AddendumDiffKind,
  oldItem?: EstimateItem,
): AddendumDiff {
  return {
    key: normalizeName(item.name),
    kind,
    section: item.section,
    name: item.name,
    unit: item.unit,
    price: item.price,
    qty: item.qty,
    sum: item.sum,
    oldPrice: oldItem?.price ?? null,
    oldQty: oldItem?.qty ?? null,
    oldSum: oldItem?.sum ?? null,
  };
}

/** Строит предложение (дифф) применения доп. соглашения к актуальной смете. */
export function buildAddendumProposal(
  current: EstimateVersion,
  addendum: EstimateVersion,
): AddendumProposal {
  const byKey = new Map<string, EstimateItem>();
  for (const item of current.items) byKey.set(normalizeName(item.name), item);

  const warnings: string[] = [];
  const diffs: AddendumDiff[] = [];
  const consumed = new Set<string>();

  for (const item of addendum.items) {
    const key = normalizeName(item.name);
    if (key === '') {
      warnings.push('Пустое наименование позиции доп. соглашения');
      continue;
    }
    const existing = byKey.get(key);
    if (existing) {
      consumed.add(key);
      diffs.push(itemDiff({ ...item, section: existing.section }, 'update', existing));
    } else {
      diffs.push(itemDiff(item, 'new'));
    }
  }

  // Позиции сметы, не затронутые доп. соглашением — сохраняются (по умолчанию).
  for (const item of current.items) {
    if (!consumed.has(normalizeName(item.name))) {
      diffs.push(itemDiff(item, 'keep'));
    }
  }

  const totals = totalsAfter(current, addendum, new Set<string>());

  return {
    addendum: {
      id: addendum.id,
      date: addendum.date,
      label: addendum.label,
      total: addendum.total,
    },
    current: { id: current.id, total: current.total },
    diffs,
    newTotalNoOverhead: totals.totalNoOverhead,
    newOverhead: totals.overhead,
    newTotal: totals.total,
    needsReview: warnings.length > 0,
    warnings,
  };
}

/** Новые позиции после применения (перенумерованные), с учётом `removeKeys`. */
export function newItemsAfter(
  current: EstimateVersion,
  addendum: EstimateVersion,
  removeKeys: ReadonlySet<string>,
): EstimateItem[] {
  const addendumByKey = new Map<string, EstimateItem>();
  for (const item of addendum.items) addendumByKey.set(normalizeName(item.name), item);

  const matched = new Set<string>();
  const result: EstimateItem[] = [];

  // 1) Позиции сметы в исходном порядке: обновлённые из доп. соглашения / сохранённые.
  for (const item of current.items) {
    const key = normalizeName(item.name);
    if (removeKeys.has(key)) continue;
    const add = addendumByKey.get(key);
    if (add) {
      matched.add(key);
      result.push({ ...add, section: item.section, change: 'changed' });
    } else {
      result.push(item);
    }
  }

  // 2) Новые позиции из доп. соглашения — в конец своей секции
  //    (кроме помеченных на удаление — иначе они вернулись бы обратно).
  const newItems = addendum.items.filter(
    (i) => !matched.has(normalizeName(i.name)) && !removeKeys.has(normalizeName(i.name)),
  );
  for (const ni of newItems) {
    const section = targetSection(ni.section);
    const idx = findLastSectionIndex(result, section);
    result.splice(idx + 1, 0, { ...ni, section, change: 'new' });
  }

  // 3) Сквозная перенумерация.
  let pos = 1;
  return result.map((item) => ({ ...item, position: pos++ }));
}

/** Историческая копия старой current: удалённые строки помечаются `removed`. */
export function historyItemsAfter(
  current: EstimateVersion,
  removeKeys: ReadonlySet<string>,
): EstimateItem[] {
  return current.items.map((item) =>
    removeKeys.has(normalizeName(item.name)) ? { ...item, change: 'removed' as const } : item,
  );
}

/** Итоги после применения (без записи): «Итого по всем разделам» + накладные = «Итого». */
export function totalsAfter(
  current: EstimateVersion,
  addendum: EstimateVersion,
  removeKeys: ReadonlySet<string>,
): { totalNoOverhead: number | null; overhead: number | null; total: number | null } {
  const items = newItemsAfter(current, addendum, removeKeys);
  const totalNoOverhead = sumKopecks(items.map((i) => i.sum));
  const overhead = totalNoOverhead == null ? null : overheadOf(totalNoOverhead);
  const total = totalNoOverhead != null && overhead != null ? totalNoOverhead + overhead : null;
  return { totalNoOverhead, overhead, total };
}

function findLastSectionIndex(items: EstimateItem[], section: string): number {
  let idx = -1;
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].section === section) idx = i;
  }
  return idx;
}
