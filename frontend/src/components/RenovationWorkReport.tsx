import type { ReportWorkRow } from '../api/client';
import type { useRenovationReports } from '../hooks/useRenovationReports';
import { formatDateIso, formatKopecks } from '../utils/money';

interface Props {
  reports: ReturnType<typeof useRenovationReports>;
}

const STATUS_LABEL: Record<ReportWorkRow['status'], string> = {
  done: 'выполнено',
  partial: 'отклонение',
  notdone: 'не выполнено',
};

function qtyText(v: number | null): string {
  return v == null ? '—' : `${formatKopecks(v, false)}`;
}

function sumCell(plan: number | null, fact: number | null) {
  return (
    <>
      <span className="renov-rp__plan">{formatKopecks(plan, true)}</span>
      <span className="renov-rp__fact">{fact == null ? '—' : formatKopecks(fact, true)}</span>
    </>
  );
}

/** «Ход работ»: план (смета) vs факт (акты) по позициям, сопоставление по наименованию. */
function WorkReportView({ reports }: Props) {
  const { work, loading, error } = reports;

  if (loading && !work) return <div className="news-empty">Загружаем отчёт…</div>;
  if (error) return <div className="news-empty">Не удалось загрузить отчёт: {error}</div>;
  if (!work) return null;

  const { totals, sections } = work;

  return (
    <div className="renov-rp">
      <div className="renov-rp__head">
        <span>
          План <strong>{formatKopecks(totals.planSum, true)}</strong> · Факт{' '}
          <strong>{formatKopecks(totals.factSum, true)}</strong> · Освоение{' '}
          <strong>
            {totals.percent != null ? `${totals.percent.toLocaleString('ru-RU')}%` : '—'}
          </strong>
        </span>
        <span className="renov-rp__asof">
          {work.asOf ? `по состоянию на ${formatDateIso(work.asOf)}` : ''} · выполнено{' '}
          {totals.done + totals.partial} / {totals.done + totals.partial + totals.notdone}
        </span>
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
          <span className="renov-rp__pos">+</span> перерасход ·{' '}
          <span className="renov-rp__neg">−</span> экономия
        </span>
      </div>

      <div className="renov-rp__table-wrap">
        <table className="renov-rp__table">
          <thead>
            <tr>
              <th>№</th>
              <th className="renov-rp__th-left">Наименование работ</th>
              <th className="renov-rp__th-num">Цена</th>
              <th className="renov-rp__th-num">
                Объём
                <br />
                <span className="renov-rp__th-sub">план / факт</span>
              </th>
              <th className="renov-rp__th-num">
                Сумма
                <br />
                <span className="renov-rp__th-sub">план / факт</span>
              </th>
              <th className="renov-rp__th-num">Отклонение</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((sec) => (
              <WorkSection key={sec.title} title={sec.title} rows={sec.rows} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WorkSection({ title, rows }: { title: string; rows: ReportWorkRow[] }) {
  return (
    <>
      <tr className="renov-rp__section">
        <td colSpan={7}>{title}</td>
      </tr>
      {rows.map((r, i) => {
        const diff =
          r.diff != null ? `${r.diff > 0 ? '+' : ''}${formatKopecks(r.diff, true)}` : '—';
        return (
          <tr key={`${title}-${i}`} className={`renov-rp__row renov-rp__row--${r.status}`}>
            <td>{r.position ?? ''}</td>
            <td className="renov-rp__left">
              <span className="renov-rp__name">
                {r.name}
                {r.unit && <span className="renov-rp__unit">{r.unit}</span>}
              </span>
            </td>
            <td className="renov-rp__num">{formatKopecks(r.planPrice, false)}</td>
            <td className="renov-rp__num">
              <span className="renov-rp__plan">{qtyText(r.planQty)}</span>
              <span className="renov-rp__fact">{qtyText(r.factQty)}</span>
            </td>
            <td className="renov-rp__num">{sumCell(r.planSum, r.factSum)}</td>
            <td
              className={`renov-rp__num renov-rp__diff ${r.diff == null || r.diff === 0 ? '' : r.diff > 0 ? 'renov-rp__pos' : 'renov-rp__neg'}`}
            >
              {diff}
            </td>
            <td className="renov-rp__status">
              <span className={`renov-rp__dot renov-rp__dot--${r.status}`} />
              {STATUS_LABEL[r.status]}
            </td>
          </tr>
        );
      })}
    </>
  );
}

export default WorkReportView;
