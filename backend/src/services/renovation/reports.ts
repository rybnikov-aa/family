import {
  getCurrentEstimateVersion,
  getRenovationMeta,
  listRenovationDocs,
  listSettlementActs,
} from '../../db/renovationRepository';
import { normalizeName } from './addendum';
import type { RenovationMeta, SettlementAct } from './domain/types';

/**
 * Отчёты из БД (этап 5): «ход работ» (план vs факт по позициям сметы,
 * сопоставление по нормализованному наименованию) и «материалы» (заказы
 * с позициями и итогами). Чистые функции без Express; суммы — копейки.
 */

export type WorkRowStatus = 'done' | 'partial' | 'notdone' | 'added';

export interface ReportWorkRow {
  position: number | null;
  section: string;
  name: string;
  unit: string | null;
  change: string;
  /** План (по смете). */
  planPrice: number | null;
  planQty: number | null;
  planSum: number | null;
  /** Факт (по актам работ, суммирование по всем актам). */
  factQty: number | null;
  factSum: number | null;
  /** Отклонение факт − план (копейки); `null` — нет факта. */
  diff: number | null;
  status: WorkRowStatus;
}

export interface ReportWork {
  asOf: string | null;
  meta: Pick<RenovationMeta, 'object' | 'area' | 'startDate' | 'deadlineDays'>;
  sections: {
    title: string;
    rows: ReportWorkRow[];
  }[];
  totals: {
    planSum: number;
    factSum: number;
    percent: number | null;
    done: number;
    partial: number;
    notdone: number;
    added: number;
  };
  settlements: {
    works:
      | (Pick<SettlementAct, 'date' | 'type'> & {
          paidIn: number | null;
          used: number | null;
          balance: number | null;
        })
      | null;
  };
}

export interface ReportMaterialOrder {
  id: number;
  number: string | null;
  date: string;
  title: string;
  total: number | null;
  overhead: number | null;
  /** URL исходного PDF (просмотр в приложении). */
  pdfPath: string | null;
  items: {
    position: number | null;
    name: string;
    unit: string | null;
    price: number | null;
    qty: number | null;
    sum: number | null;
  }[];
}

export interface ReportMaterials {
  orders: ReportMaterialOrder[];
  totals: {
    count: number;
    ordersSum: number;
    overheadSum: number;
  };
}

function settleSummary(act: SettlementAct | null): ReportWork['settlements']['works'] {
  if (!act) return null;
  let paidIn = 0;
  let used = 0;
  let balance: number | null = null;
  for (const row of act.rows) {
    if (row.kind === 'total') {
      balance = row.balance ?? balance;
      continue;
    }
    paidIn += row.paidIn ?? 0;
    used += row.used ?? 0;
  }
  return { date: act.date, type: act.type, paidIn, used, balance };
}

/** «Ход работ»: позиции сметы (current) ↔ факт из актов работ. */
export function buildWorkReport(): ReportWork {
  const current = getCurrentEstimateVersion();
  const acts = listRenovationDocs('work_act').filter((d) => d.type === 'work_act');
  const meta = getRenovationMeta();

  // Факт по актам: нормализованное имя → сумма по всем актам. Сначала считаем
  // строки только по смете, затем добавляем отдельные строки актов, которых нет
  // в смете (новые/добавленные объёмы по факту).
  const factByKey = new Map<string, { qty: number; sum: number }>();
  for (const act of acts) {
    for (const it of act.items) {
      if (it.kind !== 'row') continue;
      const key = normalizeName(it.name);
      if (key === '') continue;
      const cur = factByKey.get(key) ?? { qty: 0, sum: 0 };
      cur.qty += it.qty ?? 0;
      cur.sum += it.sum ?? 0;
      factByKey.set(key, cur);
    }
  }

  const items = current?.items ?? [];
  const estimateKeys = new Set(items.map((item) => normalizeName(item.name)));
  const addedByKey = new Map<
    string,
    {
      section: string;
      name: string;
      unit: string | null;
      qty: number;
      sum: number;
    }
  >();

  for (const act of acts) {
    for (const it of act.items) {
      if (it.kind !== 'row') continue;
      const key = normalizeName(it.name);
      if (key === '' || estimateKeys.has(key)) continue;
      const prev = addedByKey.get(key) ?? {
        section: it.section || 'Прочее',
        name: it.name,
        unit: it.unit,
        qty: 0,
        sum: 0,
      };
      prev.section = prev.section || it.section || 'Прочее';
      prev.name = it.name;
      prev.unit = it.unit ?? prev.unit;
      prev.qty += it.qty ?? 0;
      prev.sum += it.sum ?? 0;
      addedByKey.set(key, prev);
    }
  }

  const sections: ReportWork['sections'] = [];
  const order = new Map<string, number>();
  const ensureSection = (title: string) => {
    if (!order.has(title)) {
      order.set(title, sections.length);
      sections.push({ title, rows: [] });
    }
    return order.get(title)!;
  };

  for (const item of items) {
    ensureSection(item.section);
    const key = normalizeName(item.name);
    const fact = factByKey.get(key);
    const factSum = fact?.sum ?? null;
    const factQty = fact?.qty ?? null;
    const diff = factSum != null && item.sum != null ? factSum - item.sum : null;
    const status: WorkRowStatus = fact ? (diff === 0 ? 'done' : 'partial') : 'notdone';
    sections[ensureSection(item.section)].rows.push({
      position: item.position,
      section: item.section,
      name: item.name,
      unit: item.unit,
      change: item.change,
      planPrice: item.price,
      planQty: item.qty,
      planSum: item.sum,
      factQty,
      factSum,
      diff,
      status,
    });
  }

  for (const row of addedByKey.values()) {
    const sectionIndex = ensureSection(row.section);
    sections[sectionIndex].rows.push({
      position: null,
      section: row.section,
      name: row.name,
      unit: row.unit,
      change: 'new',
      planPrice: null,
      planQty: null,
      planSum: null,
      factQty: row.qty,
      factSum: row.sum,
      diff: null,
      status: 'added',
    });
  }

  // Итоги шапки — с накладными, как в сводке (overview.ts): план = итог сметы
  // (total включает накладные), факт = сумма итогов актов с накладными. Позиции
  // ниже — без накладных (накладные не привязаны к отдельным строкам).
  const planSum = current?.total ?? items.reduce((s, i) => s + (i.sum ?? 0), 0);
  const factSum = acts.reduce((s, a) => s + (a.totalWithOverhead ?? 0), 0);
  const counts = { done: 0, partial: 0, notdone: 0, added: 0 };
  for (const s of sections) {
    for (const r of s.rows) counts[r.status] += 1;
  }

  const worksActs = listSettlementActs('works');
  const latestWorks =
    worksActs.length > 0 ? worksActs.reduce((a, b) => (a.date >= b.date ? a : b)) : null;

  // Дата отчёта — самая поздняя дата документа (акта/заказа).
  const docDates = [
    ...listRenovationDocs().map((d) => d.date),
    ...(latestWorks ? [latestWorks.date] : []),
  ].filter(Boolean);
  const asOf = docDates.length > 0 ? (docDates.sort().at(-1) ?? null) : null;

  return {
    asOf,
    meta: {
      object: meta?.object ?? '',
      area: meta?.area ?? null,
      startDate: meta?.startDate ?? null,
      deadlineDays: meta?.deadlineDays ?? null,
    },
    sections,
    totals: {
      planSum,
      factSum,
      percent: planSum > 0 ? Math.round((factSum / planSum) * 1000) / 10 : null,
      done: counts.done,
      partial: counts.partial,
      notdone: counts.notdone,
      added: counts.added,
    },
    settlements: { works: settleSummary(latestWorks) },
  };
}

/** «Материалы»: заказы материалов с позициями и итогами. */
export function buildMaterialsReport(): ReportMaterials {
  const orders = listRenovationDocs('material_order').filter((d) => d.type === 'material_order');
  const result: ReportMaterialOrder[] = orders.map((o) => ({
    id: o.id,
    number: o.number,
    date: o.date,
    title: o.title,
    total: o.total,
    overhead: o.overhead,
    pdfPath: o.pdfPath,
    items: o.items
      .filter((i) => i.kind === 'row')
      .map((i) => ({
        position: i.position,
        name: i.name,
        unit: i.unit,
        price: i.price,
        qty: i.qty,
        sum: i.sum,
      })),
  }));
  return {
    orders: result,
    totals: {
      count: result.length,
      ordersSum: result.reduce((s, o) => s + (o.total ?? 0), 0),
      overheadSum: result.reduce((s, o) => s + (o.overhead ?? 0), 0),
    },
  };
}
