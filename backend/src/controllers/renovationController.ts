import type { Request, Response } from 'express';
import {
  applyAddendumVersion,
  findAddendumByDate,
  findDocByTypeAndDate,
  findSettlementByTypeAndDate,
  getCurrentEstimateVersion,
  getEstimateVersion,
  getEstimateVersionByKind,
  insertAddendumVersion,
  insertRenovationDoc,
  insertSettlementAct,
  listEstimateVersions,
  listRenovationDocs,
  listSettlementActs,
} from '../db/renovationRepository';
import {
  buildAddendumProposal,
  historyItemsAfter,
  newItemsAfter,
  totalsAfter,
} from '../services/renovation/addendum';
import { buildMaterialsReport, buildWorkReport } from '../services/renovation/reports';
import { buildOverview } from '../services/renovation/overview';
import { classifyPdf } from '../services/renovation/import/classify';
import { buildDraft, type RenovationDraft } from '../services/renovation/import/draft';
import { getDraft, storeDraft } from '../services/renovation/import/draftStore';
import { extractPdf } from '../services/renovation/import/pdfExtractor';
import type {
  RenovationDoc,
  RenovationDocItem,
  RenovationDocType,
  SettlementAct,
  SettlementRow,
  SettlementType,
} from '../services/renovation/domain/types';

/** Сводка «Ремонта» (Блок 1 Работы / Блок 2 Материалы): `GET /api/renovation`. */
export function overviewController(_req: Request, res: Response): void {
  res.json(buildOverview());
}

/** Список версий сметы (сводки): `GET /api/renovation/estimate/versions`. */
export function estimateVersionsController(_req: Request, res: Response): void {
  res.json({ versions: listEstimateVersions() });
}

/**
 * Версия сметы с позициями: `GET /api/renovation/estimate?version=<id|kind>`.
 * `version` — числовой id либо тип (`seed`/`current`/`history`/`addendum`).
 * По умолчанию — актуальная (`current`).
 */
export function estimateController(req: Request, res: Response): void {
  const raw = typeof req.query.version === 'string' ? req.query.version : 'current';
  const id = Number.parseInt(raw, 10);
  const version = Number.isFinite(id)
    ? getEstimateVersion(id)
    : getEstimateVersionByKind(raw as 'seed' | 'current' | 'history' | 'addendum');
  if (!version) {
    res.status(404).json({ message: 'Версия сметы не найдена' });
    return;
  }
  res.json(version);
}

/** Документы (акты работ / заказы материалов): `GET /api/renovation/docs?type=…`. */
export function docsController(req: Request, res: Response): void {
  const raw = typeof req.query.type === 'string' ? req.query.type : undefined;
  const type: RenovationDocType | undefined =
    raw === 'work_act' || raw === 'material_order' ? raw : undefined;
  res.json({ docs: listRenovationDocs(type) });
}

/** Акты взаиморасчётов: `GET /api/renovation/settlements?type=…`. */
export function settlementsController(req: Request, res: Response): void {
  const raw = typeof req.query.type === 'string' ? req.query.type : undefined;
  const type: SettlementType | undefined = raw === 'works' || raw === 'materials' ? raw : undefined;
  res.json({ acts: listSettlementActs(type) });
}

// ── Импорт PDF (этап 3): POST /pdf → draft, POST /pdf/:id/confirm ───────────

function draftSummary(d: RenovationDraft) {
  return {
    id: d.id,
    fileName: d.fileName,
    type: d.cls.type,
    subtype: d.cls.subtype,
    date: d.cls.date,
    number: d.cls.number,
    label: d.cls.label,
    reasons: d.cls.reasons,
    itemsCount: d.items.length,
    settlementsCount: d.settlementRows.length,
    total: d.total,
    needsReview: d.needsReview,
    warnings: d.warnings,
  };
}

/**
 * Импорт PDF → черновик: `POST /api/renovation/pdf` (multipart, admin).
 * Извлекает содержимое (pdfplumber), определяет тип/дату, строит черновик
 * и возвращает его сводку для подтверждения. Ответ — 201 `{ draft }`.
 */
export function uploadPdfController(req: Request, res: Response): void {
  const file = req.file;
  if (!file || !file.buffer || file.buffer.length === 0) {
    res.status(400).json({ message: 'Файл не выбран' });
    return;
  }
  const fileName =
    typeof req.body?.name === 'string' && req.body.name ? req.body.name : file.originalname;
  const extract = extractPdf(file.buffer, fileName);
  extract
    .then((extraction) => {
      const cls = classifyPdf(extraction.text, fileName);
      const draft = buildDraft(fileName, extraction, cls);
      storeDraft(draft);
      res.status(201).json({ draft: draftSummary(draft) });
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Ошибка извлечения PDF';
      res.status(422).json({ message });
    });
}

/**
 * Подтверждение импорта черновика: `POST /api/renovation/pdf/:id/confirm` (admin).
 * Проверяет идемпотентность (тип+дата уже есть → 409) и сохраняет в БД.
 */
export function confirmPdfController(req: Request, res: Response): void {
  const draft = getDraft(String(req.params.id));
  if (!draft) {
    res.status(404).json({ message: 'Черновик не найден или истёк (повторите загрузку)' });
    return;
  }
  const cls = draft.cls;

  try {
    if (cls.type === 'settlement') {
      if (!cls.subtype) {
        res
          .status(400)
          .json({ message: 'Не определён тип ведомости (работы/материалы) — уточните' });
        return;
      }
      if (!cls.date) {
        res.status(400).json({ message: 'Не определена дата документа' });
        return;
      }
      if (findSettlementByTypeAndDate(cls.subtype, cls.date)) {
        res.status(409).json({ message: 'Ведомость этого типа с такой датой уже импортирована' });
        return;
      }
      const act: SettlementAct = {
        id: 0,
        type: cls.subtype,
        date: cls.date,
        sourcePath: null,
        pdfPath: null,
        rows: draft.settlementRows.map((r): SettlementRow => ({
          position: r.position,
          kind: r.kind,
          rowDate: r.rowDate,
          reason: r.reason,
          paidIn: r.paidIn,
          used: r.used,
          balance: r.balance,
        })),
      };
      const id = insertSettlementAct(act);
      res.status(201).json({ id, type: act.type, date: act.date });
      return;
    }

    if (cls.type === 'work_act' || cls.type === 'material_order') {
      if (!cls.date) {
        res.status(400).json({ message: 'Не определена дата документа' });
        return;
      }
      if (findDocByTypeAndDate(cls.type, cls.date)) {
        res.status(409).json({ message: 'Документ этого типа с такой датой уже импортирован' });
        return;
      }
      const items: RenovationDocItem[] = draft.items.map((i) => ({
        position: i.position,
        section: '',
        name: i.name,
        unit: i.unit,
        price: i.price,
        qty: i.qty,
        sum: i.sum,
        kind: 'row',
      }));
      const doc: RenovationDoc = {
        id: 0,
        type: cls.type,
        number: cls.number,
        date: cls.date,
        title: cls.label,
        total: cls.type === 'material_order' ? draft.total : null,
        overhead: null,
        totalWithOverhead: cls.type === 'work_act' ? draft.total : null,
        sourcePath: null,
        pdfPath: null,
        items,
      };
      const id = insertRenovationDoc(doc);
      res.status(201).json({ id, type: doc.type, date: doc.date, number: doc.number });
      return;
    }

    if (cls.type === 'addendum') {
      if (!cls.date) {
        res.status(400).json({ message: 'Не определена дата доп. соглашения' });
        return;
      }
      if (findAddendumByDate(cls.date)) {
        res.status(409).json({ message: 'Доп. соглашение с такой датой уже импортировано' });
        return;
      }
      const id = insertAddendumVersion({
        date: cls.date,
        label: cls.label || 'Дополнительное соглашение',
        total: draft.total,
        items: draft.items.map((i) => ({
          position: i.position,
          section: '',
          name: i.name,
          unit: i.unit,
          price: i.price,
          qty: i.qty,
          sum: i.sum,
          change: 'new' as const,
        })),
      });
      res.status(201).json({ id, type: 'addendum', date: cls.date });
      return;
    }

    res.status(400).json({ message: 'Тип документа не распознан' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка сохранения';
    res.status(500).json({ message });
  }
}

// ── Доп. соглашения к смете (этап 4) ─────────────────────────────────────────

/**
 * Предложение применения доп. соглашения: `POST /api/renovation/estimate/addendum`.
 * Тело — `{ addendumId }`; ответ — `{ proposal }` (дифф строк + новый итог).
 */
export function addendumProposalController(req: Request, res: Response): void {
  const addendumId = Number(req.body?.addendumId);
  if (!Number.isFinite(addendumId)) {
    res.status(400).json({ message: 'Не указан addendumId' });
    return;
  }
  const addendum = getEstimateVersion(addendumId);
  if (!addendum || addendum.kind !== 'addendum') {
    res.status(404).json({ message: 'Доп. соглашение не найдено' });
    return;
  }
  const current = getCurrentEstimateVersion();
  if (!current) {
    res.status(404).json({ message: 'Актуальная смета не найдена' });
    return;
  }
  res.json({ proposal: buildAddendumProposal(current, addendum) });
}

/**
 * Подтверждение применения доп. соглашения: `POST /api/renovation/estimate/addendum/confirm`.
 * Тело — `{ addendumId, removeKeys?: string[] }` (нормализованные имена на удаление).
 * Старая `current` → `history`, создаётся новая `current`. Ответ — 201.
 */
export function addendumConfirmController(req: Request, res: Response): void {
  const addendumId = Number(req.body?.addendumId);
  const removeKeysRaw: unknown = req.body?.removeKeys;
  const removeKeys = new Set<string>(
    Array.isArray(removeKeysRaw)
      ? removeKeysRaw.filter((k): k is string => typeof k === 'string')
      : [],
  );

  if (!Number.isFinite(addendumId)) {
    res.status(400).json({ message: 'Не указан addendumId' });
    return;
  }
  const addendum = getEstimateVersion(addendumId);
  if (!addendum || addendum.kind !== 'addendum') {
    res.status(404).json({ message: 'Доп. соглашение не найдено' });
    return;
  }
  if (!addendum.date) {
    res.status(400).json({ message: 'У доп. соглашения не определена дата' });
    return;
  }
  const current = getCurrentEstimateVersion();
  if (!current) {
    res.status(404).json({ message: 'Актуальная смета не найдена' });
    return;
  }

  try {
    const newItems = newItemsAfter(current, addendum, removeKeys);
    const historyItems = historyItemsAfter(current, removeKeys);
    const totals = totalsAfter(current, addendum, removeKeys);
    const { currentId } = applyAddendumVersion({
      oldCurrentId: current.id,
      oldCurrentLabel: current.label,
      addendumDate: addendum.date,
      addendumLabel: addendum.label,
      addendumRef: addendum.label,
      historyItems,
      newItems,
      totals,
    });
    res.status(201).json({
      currentId,
      total: totals.total,
      totalNoOverhead: totals.totalNoOverhead,
      overhead: totals.overhead,
      itemsCount: newItems.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка применения доп. соглашения';
    res.status(500).json({ message });
  }
}

// ── Отчёты (этап 5) ─────────────────────────────────────────────────────────

/** «Ход работ» (план vs факт): `GET /api/renovation/reports/work`. */
export function workReportController(_req: Request, res: Response): void {
  try {
    res.json({ work: buildWorkReport() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка формирования отчёта';
    res.status(500).json({ message });
  }
}

/** «Материалы» (заказы с позициями): `GET /api/renovation/reports/materials`. */
export function materialsReportController(_req: Request, res: Response): void {
  try {
    res.json({ materials: buildMaterialsReport() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка формирования отчёта';
    res.status(500).json({ message });
  }
}
