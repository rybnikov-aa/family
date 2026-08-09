/**
 * Доменные модели проекта «Ремонт» (модуль renovation).
 *
 * Чистые типы без зависимостей от Express/SQLite/React — их используют
 * репозиторий (`db/renovationRepository.ts`), будущий API `/api/renovation/*`
 * и сервисы расчёта. Все денежные и количественные значения — целые копейки
 * (количество тоже ×100), см. `domain/money.ts`.
 *
 * Источник данных — отдельная БД `data/renovation.sqlite` (см.
 * `docs/specification-renovation.md`); первичное наполнение — из статичных
 * HTML `projects/renovation/` скриптом `backend/scripts/seed-renovation.mjs`.
 */

/** Тип версии сметы (соответствует файлам `estimate*.html`). */
export type EstimateVersionKind = 'seed' | 'current' | 'history' | 'addendum';

/**
 * Разметка строки по доп. соглашению (цвет в HTML: синий/жёлтый/красный).
 * `removed` — строка удалена из сметы (помечается в исторической копии).
 */
export type ItemChange = 'none' | 'changed' | 'new' | 'removed';

export interface EstimateItem {
  /** Номер позиции в смете; `null` — «—». */
  position: number | null;
  /** Название раздела, например «Раздел 5. Электрика». */
  section: string;
  name: string;
  unit: string | null;
  /** Копейки. */
  price: number | null;
  /** Копейки (×100): 91,91 → 9191. */
  qty: number | null;
  /** Копейки. */
  sum: number | null;
  change: ItemChange;
}

export interface EstimateVersion {
  /** Идентификатор версии в БД (`estimate_versions.id`). */
  id: number;
  kind: EstimateVersionKind;
  /** Дата версии (для `history`/`addendum`); для `seed`/`current` — null. */
  date: string | null;
  label: string;
  /** Итого с накладными, копейки. */
  total: number | null;
  /** Итого по всем разделам, копейки. */
  totalNoOverhead: number | null;
  /** Накладные 5%, копейки. */
  overhead: number | null;
  /** Ссылки на доп. соглашения (для `current`), через запятую. */
  addendumRef: string | null;
  /** Относительный путь исходного HTML (`estimate.html` и т.п.). */
  sourcePath: string | null;
  /** URL исходного PDF (`/projects/renovation/pdf/…`). */
  pdfPath: string | null;
  items: EstimateItem[];
}

export type RenovationDocType = 'work_act' | 'material_order';

export interface RenovationDocItem {
  position: number | null;
  /** Название раздела (для актов работ); для заказов материалов — '' . */
  section: string;
  name: string;
  unit: string | null;
  price: number | null;
  qty: number | null;
  sum: number | null;
  kind: 'row' | 'total';
}

export interface RenovationDoc {
  /** Идентификатор документа в БД (`renovation_docs.id`). */
  id: number;
  type: RenovationDocType;
  number: string | null;
  /** Дата документа в формате `yyyy-MM-dd` (из имени файла). */
  date: string;
  title: string;
  /** Итого по всем разделам (до накладных), копейки. */
  total: number | null;
  /** Накладные 5%, копейки. */
  overhead: number | null;
  /** Итого с накладными, копейки. */
  totalWithOverhead: number | null;
  sourcePath: string | null;
  pdfPath: string | null;
  items: RenovationDocItem[];
}

export type SettlementType = 'works' | 'materials';
export type SettlementRowKind = 'row' | 'subtotal' | 'total';

export interface SettlementRow {
  position: number | null;
  kind: SettlementRowKind;
  rowDate: string | null;
  reason: string | null;
  /** Копейки; `null` — «—» (не применимо к строке). */
  paidIn: number | null;
  used: number | null;
  balance: number | null;
}

/**
 * Акт взаиморасчётов. Кумулятивный: каждый следующий включает все предыдущие,
 * в расчёт отчётности идёт только самый свежий на тип (по `date`).
 */
export interface SettlementAct {
  /** Идентификатор акта в БД (`settlement_acts.id`). */
  id: number;
  type: SettlementType;
  date: string;
  sourcePath: string | null;
  pdfPath: string | null;
  rows: SettlementRow[];
}

/** Реквизиты проекта (одна строка, `renovation_meta`). */
export interface RenovationMeta {
  object: string;
  contractNo: string | null;
  /** `yyyy-MM-dd`. */
  contractDate: string | null;
  contractor: string | null;
  /** `yyyy-MM-dd`. */
  startDate: string | null;
  deadlineDays: number | null;
  /** Площадь в виде текста, например «91,91 м²». */
  area: string | null;
}
