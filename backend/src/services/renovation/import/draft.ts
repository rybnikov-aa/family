import { randomUUID } from 'node:crypto';
import { parseKopecks, sumKopecks } from '../domain/money';
import type { PdfClass } from './classify';
import type { PdfExtraction, PdfTable } from './pdfExtractor';

/**
 * Черновик импортированного документа «Ремонта» (этап 3: PDF → draft → confirm).
 *
 * Извлечение из PDF — автоматическое (таблицы через pdfplumber, при их отсутствии —
 * построчный разбор текста). Автоматика может ошибаться на «рваных» PDF, поэтому:
 * - `needsReview: true` — строки/итоги не удалось разобрать достоверно (пользователь
 *   подтверждает либо отменяет импорт; fallback — навык `project-renovation-update-from-pdf`);
 * - суммы — копейки (×100), см. `domain/money.ts`.
 */

export interface DraftItem {
  position: number | null;
  name: string;
  unit: string | null;
  price: number | null;
  qty: number | null;
  sum: number | null;
}

export interface DraftSettlementRow {
  position: number | null;
  kind: 'row' | 'subtotal' | 'total';
  rowDate: string | null;
  reason: string | null;
  paidIn: number | null;
  used: number | null;
  balance: number | null;
}

export interface RenovationDraft {
  id: string;
  createdAt: number;
  fileName: string;
  cls: PdfClass;
  items: DraftItem[];
  settlementRows: DraftSettlementRow[];
  /** Итог (копейки): для заказов/актов — «Итого…», для ведомостей — «Всего». */
  total: number | null;
  needsReview: boolean;
  warnings: string[];
}

const ITEM_TYPES = new Set(['work_act', 'material_order']);

function cellText(value: string | undefined): string {
  return (value ?? '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRowEmpty(row: string[]): boolean {
  return row.every((c) => cellText(c) === '');
}

function findHeaderRow(table: PdfTable): number {
  const re =
    /наименование|сумма|количество|объем|объём|цена|внесено|использовано|остаток|обоснование|единиц/i;
  for (let i = 0; i < table.rows.length; i += 1) {
    if (table.rows[i].some((c) => re.test(c))) return i;
  }
  return 0;
}

interface ColMap {
  name: number;
  unit: number;
  price: number;
  qty: number;
  sum: number;
  date: number;
  reason: number;
  paid: number;
  used: number;
  balance: number;
}

function colIndex(header: string[], re: RegExp, fallback = -1): number {
  const i = header.findIndex((h) => re.test(h));
  return i >= 0 ? i : fallback;
}

/** Карта колонок по шапке таблицы (шапка может быть с заглавных букв — флаг `i`). */
function mapColumns(header: string[]): ColMap {
  return {
    name: colIndex(header, /наименование/i),
    unit: colIndex(header, /ед/i),
    price: colIndex(header, /цена/i),
    qty: colIndex(header, /кол-во|количество|объем|объём/i),
    sum: colIndex(header, /сумма/i),
    date: colIndex(header, /дата/i),
    reason: colIndex(header, /обоснование/i),
    paid: colIndex(header, /внесено/i),
    used: colIndex(header, /использовано/i),
    balance: colIndex(header, /остаток/i),
  };
}

function cell(row: string[], idx: number): string {
  return idx >= 0 && idx < row.length ? cellText(row[idx]) : '';
}

/** Разбор документа-таблицы (акт работ / заказ материалов) из pdfplumber-таблиц. */
function parseItemTables(
  extraction: PdfExtraction,
  _warnings: string[],
): { items: DraftItem[]; total: number | null; needsReview: boolean } {
  const items: DraftItem[] = [];
  let total: number | null = null;
  let needsReview = false;
  let seenHeader = false;

  for (const table of extraction.tables) {
    const headerIdx = findHeaderRow(table);
    if (table.rows.length <= headerIdx) continue;
    const cols = mapColumns(table.rows[headerIdx]);
    seenHeader = true;

    for (let r = headerIdx + 1; r < table.rows.length; r += 1) {
      const row = table.rows[r];
      if (isRowEmpty(row)) continue;
      const name = cell(row, cols.name);
      const sumText = cell(row, cols.sum);
      const lower = (name + ' ' + sumText).toLowerCase();

      if (lower.includes('итого')) {
        const t = parseKopecks(sumText);
        if (t != null) total = t;
        continue;
      }
      if (name === '' && sumText === '') continue;

      items.push({
        position: parsePosition(row[0]),
        name: name || (row[0] ?? ''),
        unit: cell(row, cols.unit) || null,
        price: parseKopecks(cell(row, cols.price)),
        qty: parseKopecks(cell(row, cols.qty)),
        sum: parseKopecks(sumText),
      });
    }
  }

  if (!seenHeader) needsReview = true;
  return { items, total, needsReview };
}

/** Номер позиции из первой ячейки (или `null`). */
function parsePosition(first: string | undefined): number | null {
  const n = Number.parseInt((first ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isNaN(n) ? null : n;
}

const SINGLE_LINE_ITEM = /^(\d+)\s+(.+?)\s+([^\s]+?)\s+([\d\s.,]+)\s+([\d\s.,]+)\s+([\d\s.,]+)$/;

/** Продолжение многострочной позиции: «9 шт. 358,80 1,00 358,80» (номер+ед+3 числа). */
const CONTINUATION_ROW = /^(\d+)\s+(\S+)\s+([\d\s.,]+)\s+([\d\s.,]+)\s+([\d\s.,]+)$/;

/** Строка «11 Доставка - - - 6 000,00» (без цены/количества). */
const DASH_ROW =
  /^(\d+)\s+(Доставка|Подъем|Подъём|доставка|подъем|подъём)\s+-?\s+-?\s+-?\s+([\d\s.,]+)$/;

/** Построчный разбор заказа/акта из текста (для PDF без линий таблицы). */
function parseItemText(
  text: string,
  warnings: string[],
): { items: DraftItem[]; total: number | null; needsReview: boolean } {
  const items: DraftItem[] = [];
  let total: number | null = null;
  let needsReview = false;
  let pending: string | null = null; // копим многострочное наименование

  const lines = text.split('\n');
  const totalRe = /итого[^\d]*([\d\s.,]+)/i;
  const num = (s: string) => {
    const n = Number.parseInt(s.replace(/[^\d]/g, ''), 10);
    return Number.isNaN(n) ? null : n;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') continue;
    if (/^подписи|^страница/i.test(line)) break;
    if (line.startsWith('[')) continue; // метка «[стр. N]»

    const totalMatch = line.match(totalRe);
    if (totalMatch) {
      const t = parseKopecks(totalMatch[1]);
      if (t != null) total = t;
      continue;
    }

    const cont = line.match(CONTINUATION_ROW);
    if (cont) {
      // Продолжение многострочной позиции: имя — накопленное pending.
      const name = pending ? pending : `позиция ${cont[1]}`;
      items.push({
        position: num(cont[1]),
        name: name.trim(),
        unit: cont[2],
        price: parseKopecks(cont[3]),
        qty: parseKopecks(cont[4]),
        sum: parseKopecks(cont[5]),
      });
      pending = null;
      continue;
    }

    const dash = line.match(DASH_ROW);
    if (dash) {
      items.push({
        position: num(dash[1]),
        name: dash[2],
        unit: null,
        price: null,
        qty: null,
        sum: parseKopecks(dash[3]),
      });
      pending = null;
      continue;
    }

    const single = line.match(SINGLE_LINE_ITEM);
    if (single) {
      items.push({
        position: num(single[1]),
        name: single[2],
        unit: single[3],
        price: parseKopecks(single[4]),
        qty: parseKopecks(single[5]),
        sum: parseKopecks(single[6]),
      });
      pending = null;
      continue;
    }

    if (/^\d+\.?\s/.test(line)) {
      // Строка начинается с номера, но не разобралась — вероятно многострочная позиция.
      needsReview = true;
      warnings.push(`Строка «${line.slice(0, 60)}…» не разобрана как позиция`);
      pending = line;
      continue;
    }

    // Строка без номера: продолжение многострочного наименования.
    if (pending) pending += ' ' + line;
    else if (items.length > 0) items[items.length - 1].name += ' ' + line;
  }

  if (items.length === 0) needsReview = true;
  return { items, total, needsReview };
}

/** Разбор ведомости взаиморасчётов из pdfplumber-таблиц. */
function parseSettlementTables(
  extraction: PdfExtraction,
  _warnings: string[],
): { rows: DraftSettlementRow[]; needsReview: boolean } {
  const rows: DraftSettlementRow[] = [];
  let needsReview = false;
  let pos = 0;

  for (const table of extraction.tables) {
    const headerIdx = findHeaderRow(table);
    if (table.rows.length <= headerIdx) continue;
    const cols = mapColumns(table.rows[headerIdx]);
    const hasSettlementCols = cols.date >= 0 || cols.paid >= 0 || cols.balance >= 0;
    if (!hasSettlementCols) continue;

    for (let r = headerIdx + 1; r < table.rows.length; r += 1) {
      const row = table.rows[r];
      if (isRowEmpty(row)) continue;
      const reason = cell(row, cols.reason) || (cols.name >= 0 ? cell(row, cols.name) : '');
      const rowDate = cell(row, cols.date);
      const paid = parseKopecks(cell(row, cols.paid));
      const used = parseKopecks(cell(row, cols.used));
      const balance = parseKopecks(cell(row, cols.balance));
      // Строки с одним номером без данных (пустые номера ведомости) — пропускаем.
      if (reason === '' && rowDate === '' && paid == null && used == null && balance == null)
        continue;

      const lower = reason.toLowerCase();
      let kind: DraftSettlementRow['kind'] = 'row';
      if (lower.includes('всего')) kind = 'total';
      else if (lower.includes('подотчет') || lower.includes('подотчёт')) kind = 'subtotal';

      pos += 1;
      rows.push({
        position: kind === 'row' ? pos : null,
        kind,
        rowDate: rowDate || null,
        reason: reason || null,
        paidIn: paid,
        used,
        balance,
      });
    }
  }

  if (rows.length === 0) needsReview = true;
  return { rows, needsReview };
}

/** Построчный разбор ведомости из текста (без таблицы). */
function parseSettlementText(
  text: string,
  _warnings: string[],
): { rows: DraftSettlementRow[]; needsReview: boolean } {
  const rows: DraftSettlementRow[] = [];
  let needsReview = false;
  let pos = 0;
  const dateRe = /^\s*(\d{1,2}\.\d{1,2}\.\d{4})\s+(.+)$/;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    if (line.startsWith('[')) continue;

    if (/^всего/i.test(line)) {
      const nums = line.match(/([\d\s.,-]+)/g) ?? [];
      rows.push({
        position: null,
        kind: 'total',
        rowDate: null,
        reason: 'Всего',
        paidIn: parseKopecks(nums[0]),
        used: parseKopecks(nums[1]),
        balance: parseKopecks(nums[2]),
      });
      continue;
    }
    if (/подотчет|подотчёт/i.test(line)) {
      const num = line.match(/([\d\s.,-]+)/)?.[1];
      rows.push({
        position: null,
        kind: 'subtotal',
        rowDate: null,
        reason: 'Подотчетные прораба',
        paidIn: null,
        used: null,
        balance: parseKopecks(num),
      });
      continue;
    }

    const m = line.match(dateRe);
    if (m) {
      const nums = line.slice(m[1].length).match(/([\d\s.,-]+)/g) ?? [];
      pos += 1;
      rows.push({
        position: pos,
        kind: 'row',
        rowDate: m[1],
        reason:
          line
            .slice(m[1].length)
            .replace(/([\d\s.,-]+)/g, '')
            .trim() || null,
        paidIn: parseKopecks(nums[0]),
        used: parseKopecks(nums[1]),
        balance: parseKopecks(nums[2]),
      });
      continue;
    }
  }

  if (rows.length === 0) needsReview = true;
  return { rows, needsReview };
}

/** Строит черновик документа из извлечённого содержимого и классификации. */
export function buildDraft(
  fileName: string,
  extraction: PdfExtraction,
  cls: PdfClass,
): RenovationDraft {
  const warnings: string[] = [];
  const items: DraftItem[] = [];
  const settlementRows: DraftSettlementRow[] = [];
  let total: number | null = null;
  let needsReview = false;

  if (cls.type === 'settlement') {
    const hasTables = extraction.tables.length > 0;
    const res = hasTables
      ? parseSettlementTables(extraction, warnings)
      : parseSettlementText(extraction.text, warnings);
    settlementRows.push(...res.rows);
    needsReview = res.needsReview;
    if (!cls.subtype) {
      needsReview = true;
      warnings.push('Тип ведомости не определён (работы/материалы) — уточнить');
    }
  } else if (cls.type && ITEM_TYPES.has(cls.type)) {
    const hasTables = extraction.tables.length > 0;
    const res = hasTables
      ? parseItemTables(extraction, warnings)
      : parseItemText(extraction.text, warnings);
    items.push(...res.items);
    total = res.total ?? sumKopecks(res.items.map((i) => i.sum));
    needsReview = res.needsReview;
    if (cls.type === 'material_order' && !/итого/i.test(extraction.text)) {
      needsReview = true;
      warnings.push('Не найдена строка «Итого» — сумма заказа может быть неполной');
    }
  } else {
    needsReview = true;
    warnings.push('Тип документа не распознан');
  }

  return {
    id: randomUUID(),
    createdAt: Date.now(),
    fileName,
    cls,
    items,
    settlementRows,
    total,
    needsReview,
    warnings,
  };
}
