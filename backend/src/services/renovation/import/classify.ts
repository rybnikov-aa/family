/**
 * Определение типа PDF-документа «Ремонта» по содержимому (текст/шапка).
 *
 * Правила — из архивного навыка `project-renovation-update-from-pdf`
 * (`projects/skills-archive/`). Тип определяется по ключевым словам; дата — из
 * шапки; номер — по «№N».
 */

export type PdfDocType = 'work_act' | 'material_order' | 'settlement' | 'addendum' | null;

export interface PdfClass {
  type: PdfDocType;
  /** Для `settlement`: 'works' | 'materials' | null (нужно уточнение). */
  subtype: 'works' | 'materials' | null;
  /** Дата документа `yyyy-MM-dd` (из шапки) или null. */
  date: string | null;
  number: string | null;
  label: string;
  reasons: string[];
}

const TYPE_RULES: { type: Exclude<PdfDocType, null>; keywords: string[] }[] = [
  {
    type: 'material_order',
    keywords: [
      'заказ материалов',
      'закупка материалов',
      'товарный чек',
      'счет на оплату',
      'счёт на оплату',
    ],
  },
  {
    type: 'work_act',
    keywords: [
      'акт приёмки выполненных работ',
      'акт приемки выполненных работ',
      'акт выполненных работ',
      'акт о приёмке выполненных работ',
      'акт о приемке выполненных работ',
    ],
  },
  {
    type: 'settlement',
    keywords: [
      'акт взаиморасчётов',
      'акт взаиморасчетов',
      'акт сверки взаиморасчётов',
      'акт сверки взаиморасчетов',
      'взаиморасчёты',
      'взаиморасчеты',
      'ведомость взаиморасчётов',
      'ведомость взаиморасчетов',
    ],
  },
  {
    type: 'addendum',
    keywords: ['дополнительное соглашение', 'доп. соглашение', 'допсоглашение', 'доп соглашение'],
  },
];

const DATE_RE = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;

/** `dd.mm.yyyy` → `yyyy-mm-dd`. */
function toIso(d: string, m: string, y: string): string {
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Даты из первых строк текста (шапка документа), до N символов. */
function headerDates(text: string, limit = 700): { iso: string; pos: number }[] {
  const head = text.slice(0, limit);
  const out: { iso: string; pos: number }[] = [];
  DATE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DATE_RE.exec(head)) !== null) {
    out.push({ iso: toIso(m[1], m[2], m[3]), pos: m.index });
  }
  return out;
}

/** Самая поздняя дата в тексте (для кумулятивных ведомостей — дата документа). */
function maxDate(text: string): string | null {
  const dates = headerDates(text);
  if (dates.length === 0) return null;
  return (
    dates
      .map((d) => d.iso)
      .sort()
      .at(-1) ?? null
  );
}

/** Дата из шапки: предпочитаем ту, что рядом с «от/№/составлен/дата». */
function pickDate(text: string): string | null {
  const dates = headerDates(text);
  if (dates.length === 0) return null;
  const markers = /(?:от|№|составлен|дата|договор)/i;
  const after = dates.find(
    (d) => text.slice(Math.max(0, d.pos - 30), d.pos + 5).search(markers) >= 0,
  );
  return (after ?? dates[0]).iso;
}

/** Дата `yyyy-MM-dd` из имени файла (например `6124 - ВВ материалы 2026-08-06.pdf`). */
function fileNameDate(fileName: string): string | null {
  const iso = /\b(\d{4})[-.]?(\d{2})[-.]?(\d{2})\b/.exec(fileName);
  if (iso && iso[1].length === 4) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const ru = /\b(\d{1,2})[-.](\d{1,2})[-.](\d{4})\b/.exec(fileName);
  return ru ? `${ru[3]}-${ru[2].padStart(2, '0')}-${ru[1].padStart(2, '0')}` : null;
}

export function classifyPdf(text: string, fileName: string): PdfClass {
  const lower = text.toLowerCase();
  const reasons: string[] = [];

  // Первая непустая строка без маркера страницы — заголовок.
  const label = (
    text.split('\n').find((l) => {
      const t = l.trim();
      return t !== '' && !/^\[стр/i.test(t);
    }) ?? ''
  ).trim();

  let type: PdfDocType = null;
  let subtype: 'works' | 'materials' | null = null;

  for (const rule of TYPE_RULES) {
    if (rule.keywords.some((k) => lower.includes(k))) {
      type = rule.type;
      reasons.push(rule.keywords.find((k) => lower.includes(k)) ?? '');
      break;
    }
  }

  if (type === 'settlement') {
    if (lower.includes('по материалам') || /ведомость[^]*материал/.test(lower)) {
      subtype = 'materials';
      reasons.push('по материалам');
    } else if (lower.includes('по работам') || lower.includes('выполнено работ')) {
      subtype = 'works';
      reasons.push('по работам');
    } else if (lower.includes('материал')) {
      subtype = 'materials';
      reasons.push('упоминание материалов');
    } else if (lower.includes('работ')) {
      subtype = 'works';
      reasons.push('упоминание работ');
    }
  }

  const number = /№\s*(\d+)/.exec(text.slice(0, 300))?.[1] ?? null;
  // Дата: приоритет — из имени файла; для ведомостей (кумулятивных) — самая поздняя
  // строка (дата документа = дата последней записи), иначе — из шапки.
  const fromName = fileNameDate(fileName);
  const date = fromName ?? (type === 'settlement' ? maxDate(text) : pickDate(text));

  return { type, subtype, date, number, label, reasons };
}
