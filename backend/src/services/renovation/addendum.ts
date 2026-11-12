import { sumKopecks } from './domain/money';
import type { EstimateItem, EstimateVersion } from './domain/types';

/**
 * Применение доп. соглашения к смете (этап 4).
 *
 * Модель (из архивного навыка `project-renovation-update-from-pdf`,
 * `projects/skills-archive/`):
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
  return (
    name
      .toLowerCase()
      .replace(/[|,.;:()«»"'`/\\]/g, ' ')
      // «толщиной»/«слоем» — размерные уточнения толщины слоя: в актах подрядчика
      // пишутся то с ними («…толщиной до 25мм»), то без («…до 25мм») — для
      // сопоставления со сметой игнорируем.
      // «на время полимеризации раствора» — уточнение в акте подрядчика к позиции
      // «Укрытие стяжки полиэтиленом, поддержание влажности» (в смете без него).
      // ВАЖНО: JS `\b` не считает кириллицу word-char, поэтому `\bтолщиной\b` не
      // матчит кириллицу — границы слова задаём пробелами/началом/концом строки.
      .replace(/(?:^|\s)(?:толщиной|слоем)(?=\s|$)/g, ' ')
      .replace(/(?:^|\s)на время полимеризации раствора(?=\s|$)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/** Секция сметы, в которую попадают новые позиции из доп. соглашения. */
export function targetSection(section: string): string {
  return section.replace(/\s*[—–-]\s*доп(?:олнительные)?\s*работы$/i, '').trim() || section;
}

export type AddendumDiffKind = 'update' | 'new' | 'keep' | 'remove';

/** Строка доп. соглашения с отрицательным количеством/суммой — удаление работы. */
export function isRemovalItem(item: EstimateItem): boolean {
  return (item.qty ?? 0) < 0 || (item.sum ?? 0) < 0;
}

/** Позиция сметы, которую удаляет строка доп. соглашения с отрицательным количеством. */
export interface AddendumRemoval {
  /** Индекс позиции в `current.items` — точная идентификация (имена могут повторяться). */
  index: number;
  /** Нормализованное имя позиции сметы (для отображения и `key` строки диффа). */
  key: string;
  /** Строка соглашения (отрицательная). */
  addendumItem: EstimateItem;
  /** Найденная позиция актуальной сметы. */
  currentItem: EstimateItem;
}

/** Одно наименование — часть другого (в соглашении добавляются уточнения в скобках). */
function namesOverlap(a: string, b: string): boolean {
  if (a === '' || b === '') return false;
  return a.includes(b) || b.includes(a);
}

/** Единственный кандидат из отфильтрованного списка (или null — если 0 или неоднозначно). */
function only(items: EstimateItem[]): EstimateItem | null {
  return items.length === 1 ? items[0] : null;
}

/**
 * Поиск позиции сметы для удаления по строке соглашения с отрицательным количеством.
 * Порядок: точное имя → цена + |количество| → цена → вхождение наименования.
 * Количество в PDF подрядчика повторяет количество удаляемой позиции сметы, а
 * наименование часто дополнено уточнением («… | в керамограните, керамической плитке»),
 * поэтому одного сопоставления по имени недостаточно.
 */
function matchRemovalTarget(item: EstimateItem, freeItems: EstimateItem[]): EstimateItem | null {
  const key = normalizeName(item.name);
  const byName = freeItems.filter((c) => normalizeName(c.name) === key);
  if (byName.length > 0) {
    const narrowed =
      byName.length > 1 && item.price != null
        ? byName.filter((c) => c.price === item.price)
        : byName;
    return only(narrowed);
  }

  if (item.price == null) return null;
  const samePrice = freeItems.filter((c) => c.price === item.price);
  if (samePrice.length === 0) return null;
  const sameQty = samePrice.filter((c) => Math.abs(c.qty ?? 0) === Math.abs(item.qty ?? 0));
  const pool = sameQty.length > 0 ? sameQty : samePrice;
  const unique = only(pool);
  if (unique) return unique;
  return only(pool.filter((c) => namesOverlap(normalizeName(c.name), key)));
}

/**
 * Строки соглашения с отрицательным количеством → позиции сметы на удаление.
 * `unmatched` — строки, для которых позиция в смете не найдена (требуют проверки).
 */
export function resolveAddendumRemovals(
  current: EstimateVersion,
  addendum: EstimateVersion,
): { removals: AddendumRemoval[]; unmatched: EstimateItem[] } {
  const removals: AddendumRemoval[] = [];
  const unmatched: EstimateItem[] = [];
  const used = new Set<number>();
  for (const item of addendum.items) {
    if (!isRemovalItem(item)) continue;
    const freeItems = current.items.filter((_, idx) => !used.has(idx));
    const target = matchRemovalTarget(item, freeItems);
    const index = target ? current.items.indexOf(target) : -1;
    if (!target || index < 0) {
      unmatched.push(item);
      continue;
    }
    used.add(index);
    removals.push({
      index,
      key: normalizeName(target.name),
      addendumItem: item,
      currentItem: target,
    });
  }
  return { removals, unmatched };
}

/** Индексы позиций сметы, удаляемых самим соглашением (без пользовательских пометок). */
export function addendumRemovalIndexes(
  current: EstimateVersion,
  addendum: EstimateVersion,
): number[] {
  return resolveAddendumRemovals(current, addendum).removals.map((r) => r.index);
}

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
  const warnings: string[] = [];
  const diffs: AddendumDiff[] = [];

  // Строки с отрицательным количеством — удаление работ: они не добавляются в смету,
  // а исключают соответствующие позиции актуальной сметы (по индексу позиции:
  // наименования в смете могут повторяться в разных разделах).
  const { removals, unmatched } = resolveAddendumRemovals(current, addendum);
  const removedIndexes = new Set(removals.map((r) => r.index));
  for (const r of removals) {
    diffs.push({
      key: r.key,
      kind: 'remove',
      section: r.currentItem.section,
      name: r.currentItem.name,
      unit: r.currentItem.unit,
      price: r.currentItem.price,
      qty: r.currentItem.qty,
      // Отрицательная сумма — вклад удаления в итог раздела (в UI «Стало» — «—»).
      sum: r.currentItem.sum == null ? null : -r.currentItem.sum,
      oldPrice: r.currentItem.price,
      oldQty: r.currentItem.qty,
      oldSum: r.currentItem.sum,
    });
  }
  if (removals.length > 0) {
    warnings.push(
      `Строк с отрицательным количеством (удаление работ): ${removals.length} — ` +
        'соответствующие позиции сметы будут удалены',
    );
  }
  if (unmatched.length > 0) {
    warnings.push(
      `Строки с отрицательным количеством без пары в смете (${unmatched.length}): ` +
        unmatched.map((i) => `«${i.name}»`).join(', '),
    );
  }

  const updatedIndexes = new Set<number>();
  for (const item of addendum.items) {
    if (isRemovalItem(item)) continue;
    const key = normalizeName(item.name);
    if (key === '') {
      warnings.push('Пустое наименование позиции доп. соглашения');
      continue;
    }
    const idx = current.items.findIndex(
      (c, i) => !removedIndexes.has(i) && !updatedIndexes.has(i) && normalizeName(c.name) === key,
    );
    if (idx >= 0) {
      updatedIndexes.add(idx);
      const existing = current.items[idx];
      diffs.push(itemDiff({ ...item, section: existing.section }, 'update', existing));
    } else {
      diffs.push(itemDiff(item, 'new'));
    }
  }

  // Позиции сметы, не затронутые доп. соглашением — сохраняются (по умолчанию).
  current.items.forEach((item, idx) => {
    if (removedIndexes.has(idx) || updatedIndexes.has(idx)) return;
    diffs.push(itemDiff(item, 'keep'));
  });

  const totals = totalsAfter(current, addendum, new Set<string>(), removedIndexes);

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

/**
 * Новые позиции после применения (перенумерованные). Удаляются позиции из
 * `removeKeys` (пометки пользователя по нормализованному имени) и `removedIndexes`
 * (удаления самим соглашением — точные индексы позиций `current.items`).
 */
export function newItemsAfter(
  current: EstimateVersion,
  addendum: EstimateVersion,
  removeKeys: ReadonlySet<string>,
  removedIndexes: ReadonlySet<number> = new Set<number>(),
): EstimateItem[] {
  const addendumByKey = new Map<string, EstimateItem>();
  // Строки с отрицательным количеством — удаление работ: в смету они не попадают
  // (их влияние — через `removedIndexes`), поэтому в сопоставление/добавление не идут.
  for (const item of addendum.items) {
    if (isRemovalItem(item)) continue;
    addendumByKey.set(normalizeName(item.name), item);
  }

  const matched = new Set<string>();
  const result: EstimateItem[] = [];

  // 1) Позиции сметы в исходном порядке: обновлённые из доп. соглашения / сохранённые.
  for (const [idx, item] of current.items.entries()) {
    const key = normalizeName(item.name);
    if (removedIndexes.has(idx) || removeKeys.has(key)) continue;
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
    (i) =>
      !isRemovalItem(i) &&
      !matched.has(normalizeName(i.name)) &&
      !removeKeys.has(normalizeName(i.name)),
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
  removedIndexes: ReadonlySet<number> = new Set<number>(),
): EstimateItem[] {
  return current.items.map((item, idx) =>
    removedIndexes.has(idx) || removeKeys.has(normalizeName(item.name))
      ? { ...item, change: 'removed' as const }
      : item,
  );
}

/** Итоги после применения (без записи): «Итого по всем разделам» + накладные = «Итого». */
export function totalsAfter(
  current: EstimateVersion,
  addendum: EstimateVersion,
  removeKeys: ReadonlySet<string>,
  removedIndexes: ReadonlySet<number> = new Set<number>(),
): { totalNoOverhead: number | null; overhead: number | null; total: number | null } {
  const items = newItemsAfter(current, addendum, removeKeys, removedIndexes);
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
