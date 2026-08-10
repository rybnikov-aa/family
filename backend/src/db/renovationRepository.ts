import { getRenovationDb } from './renovationDatabase';
import type {
  EstimateItem,
  EstimateVersion,
  EstimateVersionKind,
  RenovationDoc,
  RenovationDocItem,
  RenovationDocType,
  RenovationMeta,
  SettlementAct,
  SettlementRow,
  SettlementType,
} from '../services/renovation/domain/types';

/**
 * Репозиторий доступа к данным «Ремонта» (SQLite, `node:sqlite`).
 * Только чтение (этап 2); мутации появятся с импортом PDF и применением
 * доп. соглашений (этапы 3–4). Строки из `node:sqlite` приходят как
 * `Record<string, SQLOutputValue>` — приводим двойным кастом.
 */

interface MetaRow {
  object: string;
  contract_no: string | null;
  contract_date: string | null;
  contractor: string | null;
  start_date: string | null;
  deadline_days: number | null;
  area: string | null;
}

interface EstimateVersionRow {
  id: number;
  kind: EstimateVersionKind;
  date: string | null;
  label: string;
  total: number | null;
  total_no_overhead: number | null;
  overhead: number | null;
  addendum_ref: string | null;
  source_path: string | null;
  pdf_path: string | null;
}

interface EstimateItemRow {
  position: number | null;
  section: string;
  name: string;
  unit: string | null;
  price: number | null;
  qty: number | null;
  sum: number | null;
  change: EstimateItem['change'];
}

interface DocRow {
  id: number;
  type: RenovationDocType;
  number: string | null;
  date: string;
  title: string;
  total: number | null;
  overhead: number | null;
  total_with_overhead: number | null;
  source_path: string | null;
  pdf_path: string | null;
}

interface DocItemRow {
  position: number | null;
  section: string;
  name: string;
  unit: string | null;
  price: number | null;
  qty: number | null;
  sum: number | null;
  kind: RenovationDocItem['kind'];
}

interface SettlementRowRow {
  position: number | null;
  kind: SettlementRow['kind'];
  row_date: string | null;
  reason: string | null;
  paid_in: number | null;
  used: number | null;
  balance: number | null;
}

/** Реквизиты проекта (одна строка) или null, если модуль не наполнен. */
export function getRenovationMeta(): RenovationMeta | null {
  const db = getRenovationDb();
  const row = db.prepare('SELECT * FROM renovation_meta WHERE id = 1').get() as unknown as
    MetaRow | undefined;
  if (!row) return null;
  return {
    object: row.object,
    contractNo: row.contract_no,
    contractDate: row.contract_date,
    contractor: row.contractor,
    startDate: row.start_date,
    deadlineDays: row.deadline_days,
    area: row.area,
  };
}

/** Сводки версий сметы (без позиций), отсортированные по дате/порядку. */
export function listEstimateVersions(): EstimateVersion[] {
  const db = getRenovationDb();
  const rows = db
    .prepare(
      `SELECT id, kind, date, label, total, total_no_overhead, overhead, addendum_ref,
              source_path, pdf_path
         FROM estimate_versions
        ORDER BY CASE kind WHEN 'seed' THEN 0 WHEN 'current' THEN 1 WHEN 'history' THEN 2 ELSE 3 END,
                 COALESCE(date, ''), id`,
    )
    .all() as unknown as EstimateVersionRow[];
  return rows.map(toEstimateVersion);
}

/** Версия сметы с позициями по id. */
export function getEstimateVersion(id: number): EstimateVersion | null {
  const db = getRenovationDb();
  const row = db
    .prepare(
      `SELECT id, kind, date, label, total, total_no_overhead, overhead, addendum_ref,
              source_path, pdf_path
         FROM estimate_versions WHERE id = ?`,
    )
    .get(id) as unknown as EstimateVersionRow | undefined;
  return row ? loadVersionItems(row) : null;
}

/** Версия сметы с позициями по типу (`seed`/`current`/…); самая свежая при дублях. */
export function getEstimateVersionByKind(kind: EstimateVersionKind): EstimateVersion | null {
  const db = getRenovationDb();
  const row = db
    .prepare(
      `SELECT id, kind, date, label, total, total_no_overhead, overhead, addendum_ref,
              source_path, pdf_path
         FROM estimate_versions WHERE kind = ?
        ORDER BY id DESC LIMIT 1`,
    )
    .get(kind) as unknown as EstimateVersionRow | undefined;
  return row ? loadVersionItems(row) : null;
}

/** Актуальная версия: `current`, иначе последняя `history`, иначе `seed`. */
export function getCurrentEstimateVersion(): EstimateVersion | null {
  return (
    getEstimateVersionByKind('current') ??
    getEstimateVersionByKind('history') ??
    getEstimateVersionByKind('seed')
  );
}

function loadVersionItems(row: EstimateVersionRow): EstimateVersion {
  const db = getRenovationDb();
  const items = db
    .prepare(
      `SELECT position, section, name, unit, price, qty, sum, change
         FROM estimate_items WHERE version_id = ? ORDER BY id`,
    )
    .all(row.id) as unknown as EstimateItemRow[];
  return {
    ...toEstimateVersion(row),
    items: items.map((it) => ({
      position: it.position,
      section: it.section,
      name: it.name,
      unit: it.unit,
      price: it.price,
      qty: it.qty,
      sum: it.sum,
      change: it.change,
    })),
  };
}

function toEstimateVersion(row: EstimateVersionRow): EstimateVersion {
  return {
    id: row.id,
    kind: row.kind,
    date: row.date,
    label: row.label,
    total: row.total,
    totalNoOverhead: row.total_no_overhead,
    overhead: row.overhead,
    addendumRef: row.addendum_ref,
    sourcePath: row.source_path,
    pdfPath: row.pdf_path,
    items: [],
  };
}

/** Документы (акты работ / заказы материалов) с позициями. */
export function listRenovationDocs(type?: RenovationDocType): RenovationDoc[] {
  const db = getRenovationDb();
  const where = type ? 'WHERE type = ?' : '';
  const rows = (type
    ? db.prepare(`SELECT * FROM renovation_docs ${where} ORDER BY date, id`).all(type)
    : db
        .prepare(`SELECT * FROM renovation_docs ${where} ORDER BY date, id`)
        .all()) as unknown as DocRow[];

  const items = db
    .prepare(
      `SELECT doc_id, position, section, name, unit, price, qty, sum, kind
         FROM renovation_doc_items ORDER BY doc_id, id`,
    )
    .all() as unknown as (DocItemRow & { doc_id: number })[];

  const itemsByDoc = new Map<number, RenovationDocItem[]>();
  for (const it of items) {
    const list = itemsByDoc.get(it.doc_id) ?? [];
    list.push({
      position: it.position,
      section: it.section,
      name: it.name,
      unit: it.unit,
      price: it.price,
      qty: it.qty,
      sum: it.sum,
      kind: it.kind,
    });
    itemsByDoc.set(it.doc_id, list);
  }

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    number: row.number,
    date: row.date,
    title: row.title,
    total: row.total,
    overhead: row.overhead,
    totalWithOverhead: row.total_with_overhead,
    sourcePath: row.source_path,
    pdfPath: row.pdf_path,
    items: itemsByDoc.get(row.id) ?? [],
  }));
}

interface SettlementActRow {
  id: number;
  type: SettlementType;
  date: string;
  source_path: string | null;
  pdf_path: string | null;
}

/** Акты взаиморасчётов с строками. */
export function listSettlementActs(type?: SettlementType): SettlementAct[] {
  const db = getRenovationDb();
  const actRows = (type
    ? db.prepare('SELECT * FROM settlement_acts WHERE type = ? ORDER BY date, id').all(type)
    : db
        .prepare('SELECT * FROM settlement_acts ORDER BY date, id')
        .all()) as unknown as SettlementActRow[];

  const rowRows = db
    .prepare(
      `SELECT act_id, position, kind, row_date, reason, paid_in, used, balance
         FROM settlement_rows ORDER BY act_id, id`,
    )
    .all() as unknown as (SettlementRowRow & { act_id: number })[];

  const rowsByAct = new Map<number, SettlementRow[]>();
  for (const r of rowRows) {
    const list = rowsByAct.get(r.act_id) ?? [];
    list.push({
      position: r.position,
      kind: r.kind,
      rowDate: r.row_date,
      reason: r.reason,
      paidIn: r.paid_in,
      used: r.used,
      balance: r.balance,
    });
    rowsByAct.set(r.act_id, list);
  }

  return actRows.map((row) => ({
    id: row.id,
    type: row.type,
    date: row.date,
    sourcePath: row.source_path,
    pdfPath: row.pdf_path,
    rows: rowsByAct.get(row.id) ?? [],
  }));
}

// ── Мутации (этап 3: подтверждение импорта PDF) ─────────────────────────────

/** Существует ли документ того же типа с той же датой (идемпотентность импорта). */
export function findDocByTypeAndDate(type: RenovationDocType, date: string): RenovationDoc | null {
  const db = getRenovationDb();
  const row = db
    .prepare('SELECT * FROM renovation_docs WHERE type = ? AND date = ? LIMIT 1')
    .get(type, date) as unknown as DocRow | undefined;
  if (!row) return null;
  return listRenovationDocs(type).find((d) => d.id === row.id) ?? null;
}

/** Существует ли ведомость того же типа с той же датой (идемпотентность импорта). */
export function findSettlementByTypeAndDate(
  type: SettlementType,
  date: string,
): SettlementAct | null {
  const db = getRenovationDb();
  const row = db
    .prepare('SELECT id FROM settlement_acts WHERE type = ? AND date = ? LIMIT 1')
    .get(type, date) as unknown as { id: number } | undefined;
  return row ? (listSettlementActs(type).find((a) => a.id === row.id) ?? null) : null;
}

/** Существует ли доп. соглашение с той же датой (идемпотентность импорта). */
export function findAddendumByDate(date: string): EstimateVersion | null {
  const db = getRenovationDb();
  const row = db
    .prepare("SELECT id FROM estimate_versions WHERE kind = 'addendum' AND date = ? LIMIT 1")
    .get(date) as unknown as { id: number } | undefined;
  return row ? getEstimateVersion(row.id) : null;
}

/** Вставляет документ (акт/заказ) с позициями; возвращает id. */
export function insertRenovationDoc(doc: RenovationDoc): number {
  const db = getRenovationDb();
  db.exec('BEGIN');
  try {
    const res = db
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
    const docId = Number(res.lastInsertRowid);
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
    db.exec('COMMIT');
    return docId;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Вставляет ведомость взаиморасчётов со строками; возвращает id. */
export function insertSettlementAct(act: SettlementAct): number {
  const db = getRenovationDb();
  db.exec('BEGIN');
  try {
    const res = db
      .prepare(
        'INSERT INTO settlement_acts (type, date, source_path, pdf_path) VALUES (?, ?, ?, ?)',
      )
      .run(act.type, act.date, act.sourcePath, act.pdfPath);
    const actId = Number(res.lastInsertRowid);
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
    db.exec('COMMIT');
    return actId;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** Вставляет версию сметы `addendum` с позициями; возвращает id. */
export function insertAddendumVersion(input: {
  date: string;
  label: string;
  total: number | null;
  /** URL сохранённого PDF доп. соглашения (или null). */
  pdfPath: string | null;
  items: EstimateItem[];
}): number {
  const db = getRenovationDb();
  db.exec('BEGIN');
  try {
    const res = db
      .prepare(
        `INSERT INTO estimate_versions (kind, date, label, total, pdf_path)
         VALUES ('addendum', ?, ?, ?, ?)`,
      )
      .run(input.date, input.label, input.total, input.pdfPath);
    const versionId = Number(res.lastInsertRowid);
    const ins = db.prepare(
      `INSERT INTO estimate_items (version_id, position, section, name, unit, price, qty, sum, change)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
    );
    for (const item of input.items) {
      ins.run(
        versionId,
        item.position,
        item.section,
        item.name,
        item.unit,
        item.price,
        item.qty,
        item.sum,
      );
    }
    db.exec('COMMIT');
    return versionId;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/**
 * Применяет доп. соглашение к смете (этап 4): старая `current` → `history`
 * (дата = дата доп. соглашения, удалённые строки помечены `removed`), создаётся
 * новая `current` с пересчитанными итогами. Транзакция.
 */
export function applyAddendumVersion(input: {
  oldCurrentId: number;
  oldCurrentLabel: string;
  addendumDate: string;
  addendumLabel: string;
  addendumRef: string;
  historyItems: EstimateItem[];
  newItems: EstimateItem[];
  totals: { total: number | null; totalNoOverhead: number | null; overhead: number | null };
}): { currentId: number } {
  const db = getRenovationDb();
  db.exec('BEGIN');
  try {
    // Старая current → history.
    db.prepare(
      `UPDATE estimate_versions
          SET kind = 'history', date = ?, label = ?
        WHERE id = ?`,
    ).run(
      input.addendumDate,
      `${input.oldCurrentLabel} (до доп. соглашения ${input.addendumLabel})`,
      input.oldCurrentId,
    );
    // Обновляем позиции старой current (историческая копия с `removed`).
    db.prepare('DELETE FROM estimate_items WHERE version_id = ?').run(input.oldCurrentId);
    const insHist = db.prepare(
      `INSERT INTO estimate_items (version_id, position, section, name, unit, price, qty, sum, change)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const item of input.historyItems) {
      insHist.run(
        input.oldCurrentId,
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

    // Новая current.
    const res = db
      .prepare(
        `INSERT INTO estimate_versions
           (kind, date, label, total, total_no_overhead, overhead, addendum_ref, source_path, pdf_path)
         VALUES ('current', NULL, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.oldCurrentLabel,
        input.totals.total,
        input.totals.totalNoOverhead,
        input.totals.overhead,
        input.addendumRef,
        null,
        null,
      );
    const currentId = Number(res.lastInsertRowid);
    const insCur = db.prepare(
      `INSERT INTO estimate_items (version_id, position, section, name, unit, price, qty, sum, change)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const item of input.newItems) {
      insCur.run(
        currentId,
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

    db.exec('COMMIT');
    return { currentId };
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
