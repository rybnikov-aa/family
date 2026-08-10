import {
  getCurrentEstimateVersion,
  getRenovationMeta,
  listRenovationDocs,
  listSettlementActs,
} from '../../db/renovationRepository';
import { getMaterialsBudget } from './budget';
import { sumKopecks } from './domain/money';
import type { MaterialsBudget, RenovationDoc, SettlementAct } from './domain/types';

/**
 * Сводка проекта «Ремонт» (аналог Блоков 1/2 главной страницы
 * `projects/renovation/index.html`), посчитанная из БД `renovation.sqlite`.
 *
 * Правила (см. `docs/specification-renovation.md`, ADR-16):
 * - факт по работам = сумма итогов (с накладными) актов выполненных работ;
 * - закуплено материалов = сумма итогов заказов материалов;
 * - взаиморасчёты — **только последний акт на тип** (акты кумулятивные).
 */

export interface RenovationOverview {
  meta: {
    object: string;
    contractNo: string | null;
    contractDate: string | null;
    contractor: string | null;
    startDate: string | null;
    deadlineDays: number | null;
    area: string | null;
  } | null;
  estimate: {
    id: number;
    total: number | null;
    totalNoOverhead: number | null;
    overhead: number | null;
    itemsCount: number;
  } | null;
  works: {
    /** План — итог сметы (с накладными). */
    planTotal: number | null;
    /** Факт — сумма итогов актов (с накладными). */
    factTotal: number | null;
    /** Освоение бюджета: факт / план × 100, один знак. */
    percent: number | null;
    acts: {
      id: number;
      number: string | null;
      date: string;
      title: string;
      totalWithOverhead: number | null;
      /** URL исходного PDF (просмотр в приложении). */
      pdfPath: string | null;
    }[];
  };
  materials: {
    ordersTotal: number | null;
    orders: {
      id: number;
      number: string | null;
      date: string;
      title: string;
      total: number | null;
      /** URL исходного PDF (просмотр в приложении). */
      pdfPath: string | null;
    }[];
  };
  settlements: {
    works: {
      date: string;
      paidIn: number | null;
      used: number | null;
      balance: number | null;
      /** URL исходного PDF ведомости (просмотр в приложении). */
      pdfPath: string | null;
    } | null;
    materials: {
      date: string;
      paidIn: number | null;
      used: number | null;
      balance: number | null;
      /** URL исходного PDF ведомости (просмотр в приложении). */
      pdfPath: string | null;
    } | null;
  };
  /** Настройка и действующий бюджет на материалы («Блок 2»). */
  materialsBudget: MaterialsBudget;
}

/** Итоги из строки «Всего» ведомости (последний акт на тип). */
function totalsOf(
  act: SettlementAct | undefined,
): RenovationOverview['settlements']['works'] | null {
  if (!act) return null;
  const totalRow = act.rows.find((r) => r.kind === 'total');
  return {
    date: act.date,
    paidIn: totalRow?.paidIn ?? null,
    used: totalRow?.used ?? null,
    balance: totalRow?.balance ?? null,
    pdfPath: act.pdfPath,
  };
}

/** Самый свежий акт на тип (кумулятивные — в расчёт только последний). */
function latestByType(
  acts: SettlementAct[],
  type: SettlementAct['type'],
): SettlementAct | undefined {
  const ofType = acts
    .filter((a) => a.type === type)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return ofType[ofType.length - 1];
}

export function buildOverview(): RenovationOverview {
  const meta = getRenovationMeta();
  const estimate = getCurrentEstimateVersion();
  const docs = listRenovationDocs();
  const acts = docs.filter((d) => d.type === 'work_act');
  const orders = docs.filter((d) => d.type === 'material_order');
  const settlements = listSettlementActs();

  const factTotal = sumKopecks(acts.map((a) => a.totalWithOverhead));
  const planTotal = estimate?.total ?? null;
  const ordersTotal = sumKopecks(orders.map((o) => o.total));
  const materialsBudget = getMaterialsBudget();

  let percent: number | null = null;
  if (planTotal != null && planTotal !== 0 && factTotal != null) {
    percent = Math.round((factTotal / planTotal) * 1000) / 10;
  }

  return {
    meta,
    estimate: estimate
      ? {
          id: estimate.id,
          total: estimate.total,
          totalNoOverhead: estimate.totalNoOverhead,
          overhead: estimate.overhead,
          itemsCount: estimate.items.length,
        }
      : null,
    works: {
      planTotal,
      factTotal,
      percent,
      acts: acts.map((a: RenovationDoc) => ({
        id: a.id,
        number: a.number,
        date: a.date,
        title: a.title,
        totalWithOverhead: a.totalWithOverhead,
        pdfPath: a.pdfPath,
      })),
    },
    materials: {
      ordersTotal,
      orders: orders.map((o: RenovationDoc) => ({
        id: o.id,
        number: o.number,
        date: o.date,
        title: o.title,
        total: o.total,
        pdfPath: o.pdfPath,
      })),
    },
    settlements: {
      works: totalsOf(latestByType(settlements, 'works')),
      materials: totalsOf(latestByType(settlements, 'materials')),
    },
    materialsBudget,
  };
}
