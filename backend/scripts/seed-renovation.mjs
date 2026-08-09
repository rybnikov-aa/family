#!/usr/bin/env node
/**
 * Seed проекта «Ремонт»: перенос данных из статичных HTML-документов
 * `projects/renovation/` в **отдельную БД** `data/renovation.sqlite`.
 *
 * Это разовое действие миграции (этап 1 плана переноса): после наполнения БД
 * новые данные попадают в неё через приложение (импорт PDF), а не из HTML.
 * Скрипт идемпотентен: при запуске очищает таблицы модуля и наполняет заново.
 *
 * Схема БД описана здесь (в `CREATE TABLE IF NOT EXISTS`) и будет источником
 * для `db/renovationDatabase.ts` на этапе API. Каноническая логика денег —
 * `src/services/renovation/domain/money.ts`; здесь продублирована, чтобы
 * скрипт работал без сборки (как `scripts/users.mjs`).
 *
 * Запуск (из папки backend/):
 *   node scripts/seed-renovation.mjs
 *
 * Переменные окружения:
 *   RENOVATION_DB_PATH        — путь к БД (по умолчанию data/renovation.sqlite)
 *   RENOVATION_PROJECTS_DIR   — папка проекта «Ремонт» (по умолчанию ../projects/renovation)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url)); // backend/scripts
const BACKEND_DIR = join(SCRIPT_DIR, '..');
const DEFAULT_DB = join(BACKEND_DIR, 'data', 'renovation.sqlite');
const DEFAULT_PROJECTS = join(BACKEND_DIR, '..', 'projects', 'renovation');

const DB_PATH = process.env.RENOVATION_DB_PATH ?? DEFAULT_DB;
const RENOVATION_DIR = process.env.RENOVATION_PROJECTS_DIR ?? DEFAULT_PROJECTS;

// ── Деньги и количества (канон — src/services/renovation/domain/money.ts) ────

const DECIMAL_RE = /^(-?\d+)[.,](\d{1,2})$/;
const INTEGER_RE = /^-?\d+$/;

function parseDecimal(text) {
  if (text == null) return null;
  let s = String(text)
    .replace(/₽/g, '')
    .replace(/руб(?:\.)?(?:лей)?/gi, '')
    .replace(/−/g, '-') // U+2212 «минус» (в PDF/HTML) → ASCII '-'
    .replace(/\s/g, '')
    .trim();
  if (s === '' || s === '—' || s === '–' || s === '-') return null;
  const dec = s.match(DECIMAL_RE);
  if (dec) {
    // Знак относится к модулю: -22 832,80 → -(22832 + 0.80), а не -22832 + 0.80.
    const sign = dec[1].startsWith('-') ? -1 : 1;
    const intPart = Math.abs(Number(dec[1]));
    const frac = Number(dec[2].padEnd(2, '0')) / 100;
    return sign * (intPart + frac);
  }
  if (INTEGER_RE.test(s)) return Number(s);
  return null;
}

function toKopecks(v) {
  if (v == null) return null;
  return Math.round(v * 100);
}

function parseKopecks(text) {
  return toKopecks(parseDecimal(text));
}

function parseIntOrNull(text) {
  if (text == null) return null;
  const s = String(text).trim();
  if (s === '' || s === '—' || s === '–' || s === '-') return null;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

function sumKopecks(values) {
  let has = false;
  let sum = 0;
  for (const v of values) {
    if (v != null) {
      has = true;
      sum += v;
    }
  }
  return has ? sum : null;
}

function formatKopecks(k) {
  if (k == null) return '—';
  const sign = k < 0 ? '-' : '';
  const abs = Math.abs(k);
  const rub = Math.floor(abs / 100);
  const kop = String(abs % 100).padStart(2, '0');
  const rubStr = String(rub).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return `${sign}${rubStr},${kop}`;
}

// ── HTML-хелперы (регулярки по регулярной разметке документов) ──────────────

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»');
}

function stripTags(s) {
  return decodeEntities(s.replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Первый текст по регулярке (с удалением тегов и схлопыванием пробелов). */
function textOf(html, re) {
  const m = re.exec(html);
  return m ? stripTags(m[1]) : null;
}

/**
 * Разбор всех `<tr>` документа в `{ trClass, isHeader, cells: [{cls, text}] }`.
 * `isHeader` — строка с `<th>` (шапка таблицы), в данные не идёт.
 */
function parseRows(html) {
  const rows = [];
  const trRe = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
  let m;
  while ((m = trRe.exec(html)) !== null) {
    const trClass = /class="([^"]*)"/.exec(m[1])?.[1] ?? '';
    const isHeader = /<th\b/i.test(m[2]);
    const cells = [];
    const tdRe = /<td\b([^>]*)>([\s\S]*?)<\/td>/gi;
    let cm;
    while ((cm = tdRe.exec(m[2])) !== null) {
      const cls = /class="([^"]*)"/.exec(cm[1])?.[1] ?? '';
      cells.push({ cls, text: stripTags(cm[2]) });
    }
    rows.push({ trClass, isHeader, cells });
  }
  return rows;
}

/**
 * Таблицы документа с названием раздела.
 * Раздел таблицы — ближайший `section-title` перед ней (работает и для
 * `<div class="section">` в смете, и для обычного `<div>` + `section-title`
 * в актах/доп. соглашениях, и для таблиц без раздела в заказах материалов).
 */
function parseTablesWithSections(html) {
  const titles = [...html.matchAll(/<div class="section-title">([\s\S]*?)<\/div>/gi)].map((m) => ({
    index: m.index,
    title: stripTags(m[1]),
  }));
  const tables = [];
  const tableRe = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;
  let m;
  while ((m = tableRe.exec(html)) !== null) {
    let section = '';
    for (const t of titles) if (t.index < m.index) section = t.title;
    tables.push({ section, rows: parseRows(m[1]) });
  }
  return tables;
}

/** Ячейка по CSS-классу (например `col-sum`); без класса — пустая строка. */
function cellText(cells, cls) {
  const c = cells.find((x) => x.cls.includes(cls));
  return c ? c.text : '';
}

/** Карта значений строки сметы/акта/заказа по классам колонок. */
function mapCells(cells) {
  const out = {};
  for (const c of cells) {
    if (c.cls.includes('col-num')) out.num = c.text;
    else if (c.cls.includes('col-unit')) out.unit = c.text;
    else if (c.cls.includes('col-price')) out.price = c.text;
    else if (c.cls.includes('col-qty')) out.qty = c.text;
    else if (c.cls.includes('col-sum')) out.sum = c.text;
    else if (c.cls.includes('col-date')) out.date = c.text;
    else if (c.cls.includes('col-desc')) out.desc = c.text;
    else if (c.cls.includes('col-amount')) out.amount = c.text;
    else if (c.cls.includes('col-used')) out.used = c.text;
    else if (c.cls.includes('col-balance')) out.balance = c.text;
    else if (c.cls === '') out.name = c.text; // колонка наименования без класса
  }
  return out;
}

/** Число после двоеточия в тексте вида «Итого по всем разделам: 134 407.50 ₽». */
function numberAfterColon(text) {
  const idx = text.indexOf(':');
  return parseKopecks(idx >= 0 ? text.slice(idx + 1) : text);
}

/** URL исходного PDF из блока `.doc-sources`. */
function pdfPath(html) {
  const m = /<div class="doc-sources">[\s\S]*?<a\s+href="([^"]+\.pdf)"/i.exec(html);
  return m ? m[1] : null;
}

/** Дата `yyyy-MM-dd` из имени файла (например `act_2026-07-26.html`). */
function dateFromName(name) {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(name);
  return m ? m[1] : null;
}

/** Дата `yyyy-MM-dd` из имени сметы (`estimate_2026-08-05_1.html` → 2026-08-05). */
function dateFromEstimateName(name) {
  const m = /estimate_(?:add_)?(\d{4}-\d{2}-\d{2})/.exec(name);
  return m ? m[1] : null;
}

/** `30.06.2026` → `2026-06-30`. */
function toIsoDate(text) {
  if (!text) return null;
  const m = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(text.trim());
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
}

// ── Схема БД (эталон для db/renovationDatabase.ts на этапе API) ──────────────

const SCHEMA = `
  -- Проект «Ремонт»: реквизиты (одна строка, id=1)
  CREATE TABLE IF NOT EXISTS renovation_meta (
    id            INTEGER PRIMARY KEY CHECK (id = 1),
    object        TEXT NOT NULL DEFAULT '',
    contract_no   TEXT,
    contract_date TEXT,
    contractor    TEXT,
    start_date    TEXT,
    deadline_days INTEGER,
    area          TEXT
  );

  -- Версии сметы: seed / current / history / addendum
  CREATE TABLE IF NOT EXISTS estimate_versions (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    kind              TEXT    NOT NULL,  -- 'seed'|'current'|'history'|'addendum'
    date              TEXT,              -- дата версии (history/addendum), иначе NULL
    label             TEXT    NOT NULL DEFAULT '',
    total             INTEGER,           -- Итого с накладными, копейки
    total_no_overhead INTEGER,           -- Итого по всем разделам, копейки
    overhead          INTEGER,           -- Накладные 5%, копейки
    addendum_ref      TEXT,              -- ссылки на доп. соглашения (для current)
    source_path       TEXT,              -- относительный путь исходного HTML
    pdf_path          TEXT,              -- URL исходного PDF
    created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Позиции сметы (снапшот на версию — неизменяемо)
  CREATE TABLE IF NOT EXISTS estimate_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    version_id INTEGER NOT NULL REFERENCES estimate_versions(id) ON DELETE CASCADE,
    position   INTEGER,                  -- номер позиции; NULL — «—»
    section    TEXT    NOT NULL DEFAULT '',
    name       TEXT    NOT NULL,
    unit       TEXT,
    price      INTEGER,                  -- копейки
    qty        INTEGER,                  -- копейки (×100)
    sum        INTEGER,                  -- копейки
    change     TEXT    NOT NULL DEFAULT 'none'  -- 'none'|'changed'|'new'
  );
  CREATE INDEX IF NOT EXISTS idx_estimate_items_version ON estimate_items(version_id);

  -- Документы: акты работ (work_act) и заказы материалов (material_order)
  CREATE TABLE IF NOT EXISTS renovation_docs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    type                TEXT    NOT NULL,  -- 'work_act'|'material_order'
    number              TEXT,
    date                TEXT    NOT NULL,  -- yyyy-MM-dd (из имени файла)
    title               TEXT    NOT NULL DEFAULT '',
    total               INTEGER,           -- Итого по всем разделам, копейки
    overhead            INTEGER,           -- Накладные 5%, копейки
    total_with_overhead INTEGER,           -- Итого с накладными, копейки
    source_path         TEXT,
    pdf_path            TEXT,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS renovation_doc_items (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id   INTEGER NOT NULL REFERENCES renovation_docs(id) ON DELETE CASCADE,
    position INTEGER,
    section  TEXT    NOT NULL DEFAULT '',
    name     TEXT    NOT NULL,
    unit     TEXT,
    price    INTEGER,
    qty      INTEGER,
    sum      INTEGER,
    kind     TEXT    NOT NULL DEFAULT 'row'  -- 'row'|'total'
  );
  CREATE INDEX IF NOT EXISTS idx_doc_items_doc ON renovation_doc_items(doc_id);

  -- Акты взаиморасчётов (кумулятивные): works / materials
  CREATE TABLE IF NOT EXISTS settlement_acts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT NOT NULL,  -- 'works'|'materials'
    date        TEXT NOT NULL,
    source_path TEXT,
    pdf_path    TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS settlement_rows (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    act_id   INTEGER NOT NULL REFERENCES settlement_acts(id) ON DELETE CASCADE,
    position INTEGER,
    kind     TEXT NOT NULL DEFAULT 'row',  -- 'row'|'subtotal'|'total'
    row_date TEXT,
    reason   TEXT,
    paid_in  INTEGER,  -- копейки; NULL — «—»
    used     INTEGER,
    balance  INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_settlement_rows_act ON settlement_rows(act_id);
`;

// ── Обход файлов и классификация ─────────────────────────────────────────────

function collectFiles() {
  const files = [];
  for (const name of readdirSync(RENOVATION_DIR).sort()) {
    if (name.endsWith('.html')) files.push({ file: name, rel: name, dir: '' });
  }
  for (const sub of ['Works', 'Materials']) {
    const dir = join(RENOVATION_DIR, sub);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).sort()) {
      if (name.endsWith('.html')) files.push({ file: name, rel: `${sub}/${name}`, dir: sub });
    }
  }
  return files;
}

function classify(file, dir) {
  if (dir === '' && file === 'estimates.html') return { type: 'skip' }; // навигационная страница
  if (dir === '' && file === 'estimate_seed.html') return { type: 'estimate', kind: 'seed' };
  if (dir === '' && file.includes('estimate_add_'))
    return { type: 'estimate', kind: 'addendum', date: dateFromEstimateName(file) };
  if (dir === '' && file === 'estimate.html') return { type: 'estimate', kind: 'current' };
  if (dir === '' && file.startsWith('estimate_'))
    return { type: 'estimate', kind: 'history', date: dateFromEstimateName(file) };
  if (dir === 'Works' && file.endsWith('_settlement.html'))
    return { type: 'settlement', sub: 'works' };
  if (dir === 'Materials' && file.endsWith('_settlement.html'))
    return { type: 'settlement', sub: 'materials' };
  if (dir === 'Works') return { type: 'work_act' };
  if (dir === 'Materials') return { type: 'material_order' };
  return { type: 'skip' };
}

// ── Парсеры типов документов ─────────────────────────────────────────────────

/** Смета/доп. соглашение: секции → позиции, итоги. */
function parseEstimate(html, rel, kind, date) {
  const title = textOf(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? '';
  const h1 = textOf(html, /<h1[^>]*class="doc-head-title"[^>]*>([\s\S]*?)<\/h1>/i);
  const label = (h1 || title).trim();
  const number = /№\s*(\d+)/.exec(h1 || title)?.[1] ?? null;

  const sections = [];
  const items = [];
  for (const table of parseTablesWithSections(html)) {
    let sectionTotal = null;
    for (const row of table.rows) {
      if (row.isHeader) continue;
      const c = mapCells(row.cells);
      if (row.trClass.includes('row-total')) {
        sectionTotal = parseKopecks(c.sum);
        continue;
      }
      const change = row.trClass.includes('row-new')
        ? 'new'
        : row.trClass.includes('row-changed')
          ? 'changed'
          : 'none';
      items.push({
        position: parseIntOrNull(c.num),
        section: table.section,
        name: c.name ?? '',
        unit: c.unit || null,
        price: parseKopecks(c.price),
        qty: parseKopecks(c.qty),
        sum: parseKopecks(c.sum),
        change,
      });
    }
    sections.push({ title: table.section, total: sectionTotal });
  }

  // Итоги: doc-summary (Итого по всем разделам / Накладные / Итого) + total-big + grand.
  let total = null;
  let totalNoOverhead = null;
  let overhead = null;
  const summary = /<div class="doc-summary">([\s\S]*?)<div class="grand-total-block">/.exec(html);
  if (summary) {
    for (const m of summary[1].matchAll(/<div[^>]*>([\s\S]*?)<\/div>/g)) {
      const t = stripTags(m[1]);
      if (t.includes('Итого по всем разделам')) totalNoOverhead = numberAfterColon(t);
      else if (t.includes('Накладные')) overhead = numberAfterColon(t);
      else if (t.includes('Итого:')) total = numberAfterColon(t);
    }
  }
  if (total == null)
    total = parseKopecks(textOf(html, /<div class="total-big">([\s\S]*?)<\/div>/i));
  const grand = parseKopecks(textOf(html, /<span class="grand-total-number">([\s\S]*?)<\/span>/i));

  // Ссылки на доп. соглашения (для current) — все estimate_add_*.html из документа.
  const addendumRef =
    [...new Set([...html.matchAll(/estimate_add_[^"']+\.html/g)].map((m) => m[0]))].join(', ') ||
    null;

  return {
    kind,
    date: date ?? null,
    label,
    number,
    total,
    totalNoOverhead,
    overhead,
    grand,
    addendumRef,
    sourcePath: rel,
    pdfPath: pdfPath(html),
    sections,
    items,
  };
}

/** Документ с таблицей «№/Наименование/Ед./Цена/Объём/Сумма» (акт работ, заказ материалов). */
function parseItemDoc(html, rel, type) {
  const title = textOf(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ?? '';
  const h1 = textOf(html, /<h1[^>]*class="doc-head-title"[^>]*>([\s\S]*?)<\/h1>/i);
  const head = h1 || title;
  const number = /№\s*(\d+)/.exec(head)?.[1] ?? null;
  const date = dateFromName(rel);

  const items = [];
  let rowTotalSum = null;
  for (const table of parseTablesWithSections(html)) {
    for (const row of table.rows) {
      if (row.isHeader) continue;
      const c = mapCells(row.cells);
      if (row.trClass.includes('row-total')) {
        rowTotalSum = parseKopecks(c.sum);
        continue;
      }
      items.push({
        position: parseIntOrNull(c.num),
        section: table.section,
        name: c.name ?? '',
        unit: c.unit || null,
        price: parseKopecks(c.price),
        qty: parseKopecks(c.qty),
        sum: parseKopecks(c.sum),
        kind: 'row',
      });
    }
  }

  // Итоги для актов работ — из totals-block; для заказов материалов — из row-total.
  let total = null;
  let overhead = null;
  let totalWithOverhead = null;
  if (type === 'work_act') {
    const tb = /<div class="totals-block">([\s\S]*?)<\/div>/.exec(html);
    if (tb) {
      const block = tb[1];
      for (const span of block.matchAll(/<span class="item">([\s\S]*?)<\/span>/g)) {
        const t = stripTags(span[1]);
        if (t.includes('Итого по всем разделам')) total = numberAfterColon(t);
        else if (t.includes('Накладные')) overhead = numberAfterColon(t);
      }
      const grand = /<span class="grand">([\s\S]*?)<\/span>/.exec(block);
      if (grand) totalWithOverhead = parseKopecks(stripTags(grand[1]));
    }
  } else {
    // material_order: «Итого, с учетом накладных расходов» — итог заказа.
    // Накладные отдельной строкой в документе не выведены, поэтому вычисляем
    // как разность итога и суммы позиций (10% у заказов №1–№3, 0% у №4).
    total = rowTotalSum ?? parseKopecks(textOf(html, /<div class="total-big">([\s\S]*?)<\/div>/i));
    const sumAll = sumKopecks(items.map((i) => i.sum));
    overhead = total != null && sumAll != null ? total - sumAll : null;
  }

  return {
    type,
    number,
    date,
    title: h1 || title,
    total,
    overhead,
    totalWithOverhead,
    sourcePath: rel,
    pdfPath: pdfPath(html),
    items,
  };
}

/** Ведомость взаиморасчётов (works/materials). */
function parseSettlement(html, rel, type) {
  const rows = [];
  let position = 0;
  for (const row of parseRows(html)) {
    if (row.isHeader) continue;
    const c = mapCells(row.cells);
    const kind = row.trClass.includes('row-subtotal')
      ? 'subtotal'
      : row.trClass.includes('row-total')
        ? 'total'
        : 'row';
    position += 1;
    rows.push({
      position,
      kind,
      rowDate: c.date || null,
      reason: c.desc || null,
      paidIn: parseKopecks(c.amount),
      used: parseKopecks(c.used),
      balance: parseKopecks(c.balance),
    });
  }
  return { type, date: dateFromName(rel), sourcePath: rel, pdfPath: pdfPath(html), rows };
}

// ── Проверка (верификация) ───────────────────────────────────────────────────

const issues = [];
function check(ok, message) {
  if (!ok) issues.push(message);
  return ok;
}

function sumOfItems(items) {
  return sumKopecks(items.map((i) => i.sum));
}

/** Сводка по файлу; возвращает строку с результатом и флагом ошибки. */
function verifyEstimate(res, est) {
  const parts = [];
  // Пораздельные итоги.
  const bySection = new Map();
  for (const item of est.items) {
    if (!bySection.has(item.section)) bySection.set(item.section, []);
    bySection.get(item.section).push(item.sum);
  }
  let sectionOk = true;
  for (const sec of est.sections) {
    if (sec.total == null) continue;
    const sum = sumKopecks(bySection.get(sec.title) ?? []);
    const ok = sum === sec.total;
    sectionOk &&= check(
      ok,
      `${res}: раздел «${sec.title}»: сумма ${formatKopecks(sum)} ≠ итог ${formatKopecks(sec.total)}`,
    );
  }
  // Общие итоги.
  const sumAll = sumOfItems(est.items);
  const ok1 = est.totalNoOverhead == null || sumAll === est.totalNoOverhead;
  check(
    ok1,
    `${res}: сумма позиций ${formatKopecks(sumAll)} ≠ «Итого по всем разделам» ${formatKopecks(est.totalNoOverhead)}`,
  );
  const ok2 =
    est.totalNoOverhead == null ||
    est.overhead == null ||
    est.total == null ||
    est.totalNoOverhead + est.overhead === est.total;
  check(ok2, `${res}: «Итого по всем разделам» + накладные ≠ «Итого»`);
  const ok3 = est.grand == null || est.total == null || est.grand === est.total;
  check(ok3, `${res}: grand ${formatKopecks(est.grand)} ≠ total ${formatKopecks(est.total)}`);
  const ok = sectionOk && ok1 && ok2 && ok3;
  return `${ok ? '✓' : '✗'} ${res} [${est.kind}] ${est.label || ''} итого=${formatKopecks(est.total, true)} поз=${est.items.length}`;
}

function verifyDoc(res, doc) {
  const sumAll = sumOfItems(doc.items);
  let ok = true;
  if (doc.type === 'material_order') {
    // Итог заказа включает неявные накладные (накладные = итог − сумма позиций).
    const overhead = doc.total != null && sumAll != null ? doc.total - sumAll : null;
    ok &&= check(
      doc.total == null || (overhead != null && overhead >= 0),
      `${res}: сумма позиций ${formatKopecks(sumAll)} превышает итог ${formatKopecks(doc.total)}`,
    );
    if (overhead != null && overhead > 0 && sumAll != null && sumAll > 0) {
      // Ожидаемая неявная накладная — ровно 10% от суммы позиций (копейки).
      const expectedOverhead = Math.round((sumAll * 10) / 100);
      const isTenPercent = overhead === expectedOverhead;
      if (!isTenPercent) {
        ok = false;
        check(
          false,
          `${res}: нестандартная накладная ${formatKopecks(overhead, true)} (ожидалось ${formatKopecks(expectedOverhead, true)})`,
        );
      }
    }
  } else {
    ok &&= check(
      doc.total == null || sumAll === doc.total,
      `${res}: сумма позиций ${formatKopecks(sumAll)} ≠ «Итого по всем разделам» ${formatKopecks(doc.total)}`,
    );
    // Для акта работ итог с накладными обязан присутствовать и равняться
    // «Итого по всем разделам» + накладные (иначе grand не распознан).
    const hasTotals = doc.total != null && doc.overhead != null;
    ok &&= check(
      !hasTotals ||
        (doc.totalWithOverhead != null && doc.total + doc.overhead === doc.totalWithOverhead),
      `${res}: итого с накладными ${formatKopecks(doc.totalWithOverhead)} ≠ ${formatKopecks(doc.total)} + накладные ${formatKopecks(doc.overhead)}`,
    );
  }
  return `${ok ? '✓' : '✗'} ${res} [${doc.type}] ${doc.title || ''} итого=${formatKopecks(doc.totalWithOverhead ?? doc.total, true)} поз=${doc.items.length}`;
}

function verifySettlement(res, act) {
  // Проверка ведомости:
  // 1) каждая строка-операция: накопленное «внесено − использовано» = баланс строки;
  // 2) строка «Всего»: внесено − использовано = баланс (собственная арифметика документа).
  // Строка-подсумма «Подотчетные прораба» пропускается: её знак в колонке баланса
  // непоследователен (17.07: +50 000,00; 06.08: −50 000,00 — оба уменьшают баланс на 50 000).
  let bal = 0;
  let ok = true;
  for (const r of act.rows) {
    if (r.kind === 'total' || r.kind === 'subtotal') continue;
    bal += (r.paidIn ?? 0) - (r.used ?? 0);
    if (r.balance != null && bal !== r.balance) ok = false;
  }
  const totalRow = act.rows.find((r) => r.kind === 'total');
  if (!totalRow) {
    ok = false;
  } else if (
    totalRow.paidIn != null &&
    totalRow.used != null &&
    totalRow.balance != null &&
    totalRow.paidIn - totalRow.used !== totalRow.balance
  ) {
    ok = false;
  }
  check(ok, `${res}: накопленный баланс не сходится`);
  return `${ok ? '✓' : '✗'} ${res} [settlement ${act.type}] строк=${act.rows.length}`;
}

// ── Вставка в БД ─────────────────────────────────────────────────────────────

function reset(db) {
  for (const t of [
    'settlement_rows',
    'settlement_acts',
    'renovation_doc_items',
    'renovation_docs',
    'estimate_items',
    'estimate_versions',
  ]) {
    db.exec(`DELETE FROM ${t}`);
  }
}

function insertEstimate(db, est) {
  const ver = db
    .prepare(
      `INSERT INTO estimate_versions
         (kind, date, label, total, total_no_overhead, overhead, addendum_ref, source_path, pdf_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      est.kind,
      est.date,
      est.label,
      est.total,
      est.totalNoOverhead,
      est.overhead,
      est.addendumRef,
      est.sourcePath,
      est.pdfPath,
    );
  const versionId = Number(ver.lastInsertRowid);
  const ins = db.prepare(
    `INSERT INTO estimate_items (version_id, position, section, name, unit, price, qty, sum, change)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const item of est.items) {
    ins.run(
      versionId,
      item.position,
      item.section,
      item.name,
      item.unit,
      item.price,
      item.qty,
      item.sum,
      item.change,
    );
  }
  return versionId;
}

function insertDoc(db, doc) {
  const d = db
    .prepare(
      `INSERT INTO renovation_docs
         (type, number, date, title, total, overhead, total_with_overhead, source_path, pdf_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      doc.type,
      doc.number,
      doc.date,
      doc.title,
      doc.total,
      doc.overhead,
      doc.totalWithOverhead,
      doc.sourcePath,
      doc.pdfPath,
    );
  const docId = Number(d.lastInsertRowid);
  const ins = db.prepare(
    `INSERT INTO renovation_doc_items (doc_id, position, section, name, unit, price, qty, sum, kind)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const item of doc.items) {
    ins.run(
      docId,
      item.position,
      item.section,
      item.name,
      item.unit,
      item.price,
      item.qty,
      item.sum,
      item.kind,
    );
  }
  return docId;
}

function insertSettlement(db, act) {
  const a = db
    .prepare(`INSERT INTO settlement_acts (type, date, source_path, pdf_path) VALUES (?, ?, ?, ?)`)
    .run(act.type, act.date, act.sourcePath, act.pdfPath);
  const actId = Number(a.lastInsertRowid);
  const ins = db.prepare(
    `INSERT INTO settlement_rows (act_id, position, kind, row_date, reason, paid_in, used, balance)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const row of act.rows) {
    ins.run(
      actId,
      row.position,
      row.kind,
      row.rowDate,
      row.reason,
      row.paidIn,
      row.used,
      row.balance,
    );
  }
  return actId;
}

function insertMeta(db, meta) {
  db.prepare(
    `INSERT INTO renovation_meta
       (id, object, contract_no, contract_date, contractor, start_date, deadline_days, area)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       object=excluded.object, contract_no=excluded.contract_no, contract_date=excluded.contract_date,
       contractor=excluded.contractor, start_date=excluded.start_date,
       deadline_days=excluded.deadline_days, area=excluded.area`,
  ).run(
    meta.object,
    meta.contractNo,
    meta.contractDate,
    meta.contractor,
    meta.startDate,
    meta.deadlineDays,
    meta.area,
  );
}

// ── Главная ──────────────────────────────────────────────────────────────────

function parseMeta(estimateHtml, indexHtml) {
  const item = (label) =>
    textOf(
      estimateHtml,
      new RegExp(`<span class="meta-item"[^>]*><strong>${label}:</strong>\\s*([^<]*)`, 'i'),
    ) ?? null;
  const sub = textOf(indexHtml, /<p class="page__sub">([\s\S]*?)<\/p>/i) ?? '';
  const contractM = /Договор\s+(№?\s*[\w.-]+)\s+от\s+([\d.]+)/.exec(sub);
  const contractorM = /Подрядчик:\s*([^·]+)/.exec(sub);
  const deadlineM = item('Срок') ? /\d+/.exec(item('Срок'))?.[0] : null;
  return {
    object: item('Объект') ?? '',
    contractNo: contractM ? contractM[1].trim() : null,
    contractDate: contractM ? toIsoDate(contractM[2]) : null,
    contractor: contractorM ? contractorM[1].trim() : null,
    startDate: toIsoDate(item('Дата старта')),
    deadlineDays: deadlineM ? Number.parseInt(deadlineM, 10) : null,
    area: item('Площадь'),
  };
}

function main() {
  if (!existsSync(RENOVATION_DIR)) {
    console.error(`Папка проекта не найдена: ${RENOVATION_DIR}`);
    process.exit(1);
  }
  // Папка БД может отсутствовать (свежий сервер без data/) — создать её заранее,
  // иначе `new DatabaseSync(DB_PATH)` упадёт («unable to open database file»).
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);

  const indexHtml = existsSync(join(RENOVATION_DIR, 'index.html'))
    ? readFileSync(join(RENOVATION_DIR, 'index.html'), 'utf8')
    : '';
  const estimateHtml = existsSync(join(RENOVATION_DIR, 'estimate.html'))
    ? readFileSync(join(RENOVATION_DIR, 'estimate.html'), 'utf8')
    : '';

  console.log(`БД: ${DB_PATH}`);
  console.log(`Проект: ${RENOVATION_DIR}\n`);

  db.exec('BEGIN');
  try {
    reset(db);
    const lines = [];
    let count = { estimate: 0, docs: 0, settlements: 0, skip: 0 };

    for (const f of collectFiles()) {
      const cls = classify(f.file, f.dir);
      if (cls.type === 'skip') {
        count.skip += 1;
        continue;
      }
      const html = readFileSync(join(RENOVATION_DIR, f.rel), 'utf8');

      if (cls.type === 'estimate') {
        const est = parseEstimate(html, f.rel, cls.kind, cls.date ?? null);
        insertEstimate(db, est);
        count.estimate += 1;
        lines.push(verifyEstimate(f.rel, est));
      } else if (cls.type === 'work_act' || cls.type === 'material_order') {
        const doc = parseItemDoc(html, f.rel, cls.type);
        insertDoc(db, doc);
        count.docs += 1;
        lines.push(verifyDoc(f.rel, doc));
      } else {
        const act = parseSettlement(html, f.rel, cls.sub);
        insertSettlement(db, act);
        count.settlements += 1;
        lines.push(verifySettlement(f.rel, act));
      }
    }

    if (estimateHtml && indexHtml) insertMeta(db, parseMeta(estimateHtml, indexHtml));

    db.exec('COMMIT');
    console.log(lines.join('\n'));
    console.log(
      `\nИмпортировано: смет ${count.estimate}, документов ${count.docs}, ведомостей ${count.settlements}, пропущено ${count.skip}.`,
    );
    if (issues.length === 0) {
      console.log('\nВерификация: все суммы сходятся ✓');
    } else {
      console.log(`\nВерификация: найдено расхождений — ${issues.length}:`);
      for (const i of issues) console.log(`  - ${i}`);
    }
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.close();
  }
}

main();
