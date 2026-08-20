import type { ReportWorkRow } from '../api/client';
import type { useRenovationReports } from '../hooks/useRenovationReports';
import { formatKopecks } from '../utils/money';

interface Props {
  reports: ReturnType<typeof useRenovationReports>;
}

const STATUS_LABEL: Record<ReportWorkRow['status'], string> = {
  done: 'выполнено',
  partial: 'отклонение',
  notdone: 'не выполнено',
  added: 'добавлено',
};

function qtyText(v: number | null): string {
  return v == null ? '—' : `${formatKopecks(v, false)}`;
}

/** «Ход работ»: план (смета) vs факт (акты) по позициям, сопоставление по наименованию. */
function WorkReportView({ reports }: Props) {
  const { work, loading, error } = reports;

  if (loading && !work) return <div className="news-empty">Загружаем отчёт…</div>;
  if (error) return <div className="news-empty">Не удалось загрузить отчёт: {error}</div>;
  if (!work) return null;

  const { totals, sections, summary } = work;
  // Освоение бюджета — как в карточке «Работы» страницы «Ремонт» (факт/план с накладными).
  const fillWidth =
    totals.percent != null && Number.isFinite(totals.percent)
      ? Math.min(100, Math.max(0, totals.percent))
      : 0;

  return (
    <div className="renov-rp">
      {/* Прогресс-бар освоения (как в карточке «Работы»). */}
      <div className="renov-card__progress">
        <div className="renov-card__progress-track">
          <div className="renov-card__progress-fill" style={{ width: `${fillWidth}%` }} />
        </div>
        <div className="renov-card__progress-caption">
          <span>
            {formatKopecks(totals.factSum, true)} из {formatKopecks(totals.planSum, true)}
          </span>
          <span>{totals.percent != null ? `${totals.percent.toLocaleString('ru-RU')}%` : '—'}</span>
        </div>
      </div>

      <div className="renov-rp__legend">
        <span className="renov-rp__lg">
          <span className="renov-rp__dot renov-rp__dot--done" /> выполнено
        </span>
        <span className="renov-rp__lg">
          <span className="renov-rp__dot renov-rp__dot--partial" /> отклонение
        </span>
        <span className="renov-rp__lg">
          <span className="renov-rp__dot renov-rp__dot--notdone" /> не выполнено
        </span>
        <span className="renov-rp__lg">
          <span className="renov-rp__dot renov-rp__dot--added" /> добавлено
        </span>
      </div>

      <div className="renov-rp__table-wrap">
        <table className="renov-rp__table renov-rp__table--fixed renov-rp__table--work">
          <colgroup>
            <col className="renov-rp__col-status" />
            <col />
            <col className="renov-rp__col-price" />
            <col className="renov-rp__col-qty" />
            <col className="renov-rp__col-qty" />
            <col className="renov-rp__col-sum" />
            <col className="renov-rp__col-sum" />
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} colSpan={2} className="renov-rp__th-left">
                Наименование работ
              </th>
              <th rowSpan={2}>Цена</th>
              <th colSpan={2}>Объём</th>
              <th colSpan={2}>Сумма</th>
            </tr>
            <tr>
              <th className="renov-rp__th-num renov-rp__th-sub">план</th>
              <th className="renov-rp__th-num renov-rp__th-sub">факт</th>
              <th className="renov-rp__th-num renov-rp__th-sub">план</th>
              <th className="renov-rp__th-num renov-rp__th-sub">факт</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((sec) => (
              <WorkSection key={sec.title} title={sec.title} rows={sec.rows} />
            ))}
            <SummaryRow
              label="Итого по работам"
              plan={summary.worksPlan}
              fact={summary.worksFact}
            />
            <SummaryRow
              label="Накладные расходы 5%"
              plan={summary.overheadPlan}
              fact={summary.overheadFact}
            />
            <SummaryRow label="Итого" plan={summary.totalPlan} fact={summary.totalFact} final />
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkSection({ title, rows }: { title: string; rows: ReportWorkRow[] }) {
  // Подитог группы: суммы план/факт по строкам (без накладных — как в таблице).
  const planSub = rows.reduce((s, r) => s + (r.planSum ?? 0), 0);
  const factSub = rows.reduce((s, r) => s + (r.factSum ?? 0), 0);
  // Выполненные строки группы (есть факт — done/partial/added) из общего числа строк.
  const doneInGroup = rows.filter(
    (r) => r.status === 'done' || r.status === 'partial' || r.status === 'added',
  ).length;
  const totalInGroup = rows.length;
  return (
    <>
      <tr className="renov-rp__section">
        <td colSpan={2} className="renov-rp__section-title">
          <span className="renov-rp__section-title-text">{title}</span>
          <span className="renov-pill renov-pill--sm" title="Выполнено строк">
            {doneInGroup} / {totalInGroup}
          </span>
        </td>
        <td />
        <td />
        <td />
        <td />
        <td />
      </tr>
      {rows.map((r, i) => (
        <tr key={`${title}-${i}`} className={`renov-rp__row renov-rp__row--${r.status}`}>
          <td className="renov-rp__status">
            <span
              className={`renov-rp__dot renov-rp__dot--${r.status}`}
              title={STATUS_LABEL[r.status]}
            />
          </td>
          <td className="renov-rp__left">
            <span className="renov-rp__name">
              <span className="renov-rp__name-text">{r.name}</span>
              {r.unit && <span className="renov-rp__unit">{r.unit}</span>}
            </span>
          </td>
          <td className="renov-rp__num">{formatKopecks(r.planPrice, false)}</td>
          <td className="renov-rp__num">
            <span className="renov-rp__plan">{qtyText(r.planQty)}</span>
          </td>
          <td className="renov-rp__num">
            <span className="renov-rp__fact">{qtyText(r.factQty)}</span>
          </td>
          <td className="renov-rp__num">
            <span className="renov-rp__plan">{formatKopecks(r.planSum, true)}</span>
          </td>
          <td className="renov-rp__num">
            <span className="renov-rp__fact">
              {r.factSum == null ? '—' : formatKopecks(r.factSum, true)}
            </span>
          </td>
        </tr>
      ))}
      <tr className="renov-rp__subtotal">
        <td colSpan={2} className="renov-rp__subtotal-label">
          Итого по разделу
        </td>
        <td />
        <td />
        <td />
        <td className="renov-rp__num">{formatKopecks(planSub, true)}</td>
        <td className="renov-rp__num">{factSub > 0 ? formatKopecks(factSub, true) : '—'}</td>
      </tr>
    </>
  );
}

/** Строка нижней сводки отчёта: подпись + сумма план/факт. */
function SummaryRow({
  label,
  plan,
  fact,
  final = false,
}: {
  label: string;
  plan: number;
  fact: number;
  final?: boolean;
}) {
  return (
    <tr className={`renov-rp__total${final ? ' renov-rp__total--final' : ''}`}>
      <td colSpan={2} className="renov-rp__total-label">
        {label}
      </td>
      <td />
      <td />
      <td />
      <td className="renov-rp__num">{formatKopecks(plan, true)}</td>
      <td className="renov-rp__num">{formatKopecks(fact, true)}</td>
    </tr>
  );
}

export default WorkReportView;
