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
 *   подтверждает либо отменяет импорт);
 * - суммы — копейки (×100), см. `domain/money.ts`.
 */

export interface DraftItem {
  position: number | null;
  /** Раздел документа («Раздел 5. Электрика») — из строки «Раздел N. …». */
  section: string | null;
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
  /**
   * Абсолютный путь к pending-файлу PDF (сохранён при загрузке в
   * `docs/.pending/`; при подтверждении переносится в каталог документов).
   */
  pendingPdf: string | null;
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
  let currentSection: string | null = null;

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

      // Строка «Раздел N. …» в колонке наименования задаёт раздел следующих позиций.
      if (SECTION_RE.test(name)) {
        currentSection = name;
        continue;
      }

      items.push({
        position: parsePosition(row[0]),
        section: currentSection,
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

/** Регэксп шапки таблицы (как в `findHeaderRow`): после неё идут позиции. */
const HEADER_RE =
  /наименование|сумма|количество|объем|объём|цена|внесено|использовано|остаток|обоснование|единиц/i;

/** Одна строка: «2. Провод ПВС 4х0.75 мм ГОСТ ККЗ м.п. 71,40 45,00 3 213,00». */
const SINGLE_LINE_ITEM = /^(\d+)\.?\s+(.+?)\s+(\S+)\s+([\d\s.,]+)$/;

/** Продолжение многострочной позиции: «1 м.п. 91,00 60,00 5 460,00» (номер+ед+числа). */
const CONTINUATION_ROW = /^(\d+)\.?\s+(\S+)\s+([\d\s.,]+)$/;

/** Строка «11 Доставка - - - 6 000,00» (без цены/количества). */
const DASH_ROW =
  /^(\d+)\s+(Доставка|Подъем|Подъём|доставка|подъем|подъём)\s+-?\s+-?\s+-?\s+([\d\s.,]+)$/;

const ITEM_START_RE = /^\d+\.?\s+/;

/** Подзаголовок раздела («Раздел 5. Электрика») — не позиция и не имя. */
const SECTION_RE = /^раздел\s*\d/i;

/** Строка накладных расходов («Накладные расходы 5%: …») — не позиция. */
const OVERHEAD_RE = /^накладные/i;

function appendWrappedLine(line: string, continuation: string): string {
  if (continuation.startsWith('.') || (line.endsWith('.') && /^\d/.test(continuation))) {
    return line + continuation;
  }
  if (/[а-яё]{4}$/i.test(line) && /^[а-яё]/i.test(continuation)) {
    return line + continuation;
  }
  return `${line} ${continuation}`;
}

function isCompleteItemLine(line: string): boolean {
  const match = line.match(CONTINUATION_ROW) ?? line.match(SINGLE_LINE_ITEM);
  if (!match) return false;
  const fields = parseNumFields(match[match.length - 1]);
  return fields.price != null && fields.qty != null && fields.sum != null;
}

/** Склеивает переносы, попавшие внутрь строки позиции при извлечении текста PDF. */
function joinWrappedItemLines(text: string): string[] {
  const lines: string[] = [];
  let itemLine: string | null = null;

  const flush = () => {
    if (itemLine) lines.push(itemLine);
    itemLine = null;
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line === '') continue;
    // Шапка таблицы и подзаголовки разделов — отдельными строками: их текст
    // не должен склеиваться с именем позиции (иначе в имя попадает «Цена за…»).
    if (HEADER_RE.test(line) || SECTION_RE.test(line)) {
      flush();
      lines.push(line);
      continue;
    }
    if (ITEM_START_RE.test(line)) {
      flush();
      itemLine = line;
    } else if (itemLine && isCompleteItemLine(itemLine)) {
      flush();
      lines.push(line);
    } else if (itemLine && !/^итого|^подписи|^страница/i.test(line)) {
      itemLine = appendWrappedLine(itemLine, line);
    } else {
      flush();
      lines.push(line);
    }
  }
  flush();
  return lines;
}

/**
 * Разбор числового хвоста позиции «цена кол-во сумма». Три поля, но в сумме
 * (реже — в цене/количестве) возможен пробел-разделитель тысяч («5 460,00»),
 * поэтому токенов бывает больше трёх. Жадный regex с `[\d\s.,]+` тут неверно
 * склеивает поля («735,00 153,00 112 455,00»), поэтому перебираем границы
 * трёх полей и выбираем вариант, где цена×кол-во = сумма.
 */
function parseNumFields(tail: string): {
  price: number | null;
  qty: number | null;
  sum: number | null;
} {
  const toks = tail.trim().split(/\s+/).filter(Boolean);
  const candidates: { price: number | null; qty: number | null; sum: number | null }[] = [];

  for (let priceEnd = 1; priceEnd <= toks.length - 2; priceEnd += 1) {
    for (let qtyEnd = priceEnd + 1; qtyEnd <= toks.length - 1; qtyEnd += 1) {
      candidates.push({
        price: parseKopecks(toks.slice(0, priceEnd).join(' ')),
        qty: parseKopecks(toks.slice(priceEnd, qtyEnd).join(' ')),
        sum: parseKopecks(toks.slice(qtyEnd).join(' ')),
      });
    }
  }

  // Сверка «цена × кол-во = сумма» (в копейках: price*qty/100) — верный вариант.
  const verified = candidates.find(
    (c) =>
      c.price != null &&
      c.qty != null &&
      c.sum != null &&
      Math.abs((c.price * c.qty) / 100 - c.sum) < 2,
  );
  return (
    verified ?? {
      price: parseKopecks(toks[0]),
      qty: parseKopecks(toks[1]),
      sum: parseKopecks(toks.slice(2).join(' ')),
    }
  );
}

/** Числовая строка позиции: «1 ед. 735.00 153.00 112 455.00» (CONTINUATION_ROW),
 * «2. Монтаж… ед. 890.00 44.00 39 160.00» (SINGLE_LINE_ITEM) или «11 Доставка …». */
function isItemNumberLine(line: string): boolean {
  return CONTINUATION_ROW.test(line) || SINGLE_LINE_ITEM.test(line) || DASH_ROW.test(line);
}

/** Построчный разбор заказа/акта из текста (для PDF без линий таблицы). */
function parseItemText(
  text: string,
  warnings: string[],
): { items: DraftItem[]; total: number | null; needsReview: boolean } {
  const items: DraftItem[] = [];
  let total: number | null = null;
  let needsReview = false;
  let pending: string | null = null; // копим многострочное наименование
  let seenHeader = false; // прошли шапку таблицы — дальше строки позиций
  let seenTotal = false; // встретили «Итого…» — дальше проза документа
  let currentSection: string | null = null; // «Раздел N. …» для следующих позиций

  const lines = joinWrappedItemLines(text);
  const totalRe = /итого[^\d]*([\d\s.,]+)/i;
  const num = (s: string) => {
    const n = Number.parseInt(s.replace(/[^\d]/g, ''), 10);
    return Number.isNaN(n) ? null : n;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const line = raw.trim();
    if (line === '') continue;
    // Метка «[стр. N]» и подвал «Страница: N / M» — НЕ конец документа: в
    // многостраничных PDF позиции продолжаются на следующих страницах, поэтому
    // такие строки пропускаем. Концом документа считаем блок подписей.
    if (/^подписи/i.test(line)) break;
    if (line.startsWith('[') || /^страница/i.test(line)) continue;

    // Подзаголовок раздела задаёт раздел следующих позиций; строка накладных —
    // не позиция и не продолжение имени. Новый раздел после «Итого» сбрасывает
    // seenTotal (дальше снова могут идти позиции).
    if (SECTION_RE.test(line)) {
      currentSection = line;
      seenTotal = false;
      continue;
    }
    if (OVERHEAD_RE.test(line)) continue;

    const totalMatch = line.match(totalRe);
    if (totalMatch) {
      const t = parseKopecks(totalMatch[1]);
      if (t != null) total = t;
      seenTotal = true;
      continue;
    }

    if (HEADER_RE.test(line)) {
      seenHeader = true;
      pending = null; // всё до шапки — проза документа («1. Подрядчик выполнил…»), не имя позиции
      continue;
    }

    const dash = line.match(DASH_ROW);
    if (dash) {
      items.push({
        position: num(dash[1]),
        section: currentSection,
        name: dash[2],
        unit: null,
        price: null,
        qty: null,
        sum: parseKopecks(dash[3]),
      });
      pending = null;
      continue;
    }

    const cont = line.match(CONTINUATION_ROW);
    if (cont) {
      // Продолжение многострочной позиции: имя — накопленное pending.
      const fields = parseNumFields(cont[3]);
      const name = pending ? pending : `позиция ${cont[1]}`;
      items.push({
        position: num(cont[1]),
        section: currentSection,
        name: name.trim(),
        unit: cont[2],
        price: fields.price,
        qty: fields.qty,
        sum: fields.sum,
      });
      pending = null;
      continue;
    }

    const single = line.match(SINGLE_LINE_ITEM);
    if (single) {
      const fields = parseNumFields(single[4]);
      items.push({
        position: num(single[1]),
        section: currentSection,
        name: single[2].trim(),
        unit: single[3],
        price: fields.price,
        qty: fields.qty,
        sum: fields.sum,
      });
      pending = null;
      continue;
    }

    // Строка с номером: до шапки — проза акта («1. Подрядчик выполнил…»), после
    // «Итого» — тоже проза («2. Всего выполнено…»); только после шапки и до итога
    // это начало многострочной позиции.
    if (ITEM_START_RE.test(line)) {
      if (seenTotal || !seenHeader) continue;
      needsReview = true;
      warnings.push(`Строка «${line.slice(0, 60)}…» не разобрана как позиция`);
      pending = line;
      continue;
    }

    // Строка без номера. После «Итого» это проза документа («Всего выполнено…»).
    if (seenTotal) continue;

    // Продолжение имени последней позиции, если:
    //  - строка идёт сразу после строки-продолжения («толщиной до 25мм» после
    //    «3 м2+м.п. 580.00 …» — имя позиции переносится и ПОСЛЕ цифр), либо
    //  - следующая строка не числовая («до 10 см», за которой идёт имя следующей
    //    позиции).
    // НО: если предыдущая строка — ПОЛНАЯ однострочная позиция (SINGLE_LINE_ITEM),
    // то её имя уже целиком в ней, и следующая строка имени — это НАЧАЛО имени новой
    // позиции (в PDF подрядчика номер позиции печатается на строке с цифрами, а имя
    // переносится перед ней: «2 Установка маяков …» → «Оштукатуривание … |» → «3 м2+м.п. …»).
    // Такую строку копим в pending, а не приклеиваем к предыдущей позиции.
    //
    // Внимание: SINGLE_LINE_ITEM матчит и строки-продолжения («3 м2+м.п. 580.00 …»,
    // где «м2+м.п.» принимается за имя, а «580.00» — за единицу), поэтому «полную
    // однострочную позицию» определяем как SINGLE_LINE_ITEM, НЕ совпавший с
    // CONTINUATION_ROW/DASH_ROW.
    const prevLine = i > 0 ? lines[i - 1].trim() : '';
    const prevIsCont =
      prevLine !== '' && (CONTINUATION_ROW.test(prevLine) || DASH_ROW.test(prevLine));
    const prevIsSingle = prevLine !== '' && SINGLE_LINE_ITEM.test(prevLine) && !prevIsCont;
    const prevWasNumber = prevLine !== '' && isItemNumberLine(prevLine);
    const nextIsNumber = i + 1 < lines.length && isItemNumberLine(lines[i + 1].trim());
    if (pending) pending = appendWrappedLine(pending, line);
    else if (items.length > 0 && prevWasNumber && !prevIsSingle) {
      items[items.length - 1].name += ' ' + line;
    } else if (items.length > 0 && !nextIsNumber && !prevIsSingle) {
      items[items.length - 1].name += ' ' + line;
    } else if (seenHeader) pending = line;
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
    pendingPdf: null,
  };
}
