import type { useRenovationReports } from '../hooks/useRenovationReports';
import { formatDateIso, formatKopecks } from '../utils/money';

interface Props {
  reports: ReturnType<typeof useRenovationReports>;
}

/** «Материалы»: заказы материалов с позициями и итогами (агрегировано из БД). */
function MaterialsReportView({ reports }: Props) {
  const { materials, loading, error } = reports;

  if (loading && !materials) return <div className="news-empty">Загружаем отчёт…</div>;
  if (error) return <div className="news-empty">Не удалось загрузить отчёт: {error}</div>;
  if (!materials) return null;

  const { orders, totals } = materials;

  return (
    <div className="renov-rp">
      <div className="renov-rp__head">
        <span>
          Заказов <strong>{totals.count}</strong> · Итого закуплено{' '}
          <strong>{formatKopecks(totals.ordersSum, true)}</strong>
        </span>
        <span className="renov-rp__asof">
          в т.ч. накладные расходы {formatKopecks(totals.overheadSum, true)}
        </span>
      </div>

      {orders.map((o) => (
        <div className="renov-rp__order" key={o.id}>
          <div className="renov-rp__order-head">
            <span>
              Отчёт №{o.number ?? '—'} · {formatDateIso(o.date)}
            </span>
            <span>
              Итого <strong>{formatKopecks(o.total, true)}</strong>
              {o.overhead != null && o.overhead > 0 && (
                <span className="renov-rp__overhead">
                  {' '}
                  (накл. {formatKopecks(o.overhead, true)})
                </span>
              )}
            </span>
          </div>
          <table className="renov-rp__table">
            <thead>
              <tr>
                <th>№</th>
                <th className="renov-rp__th-left">Наименование</th>
                <th className="renov-rp__th-num">Ед.</th>
                <th className="renov-rp__th-num">Цена</th>
                <th className="renov-rp__th-num">Кол-во</th>
                <th className="renov-rp__th-num">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {o.items.map((it, i) => (
                <tr key={i}>
                  <td>{it.position ?? ''}</td>
                  <td className="renov-rp__left">
                    <span className="renov-rp__name">{it.name}</span>
                  </td>
                  <td className="renov-rp__num">{it.unit || '—'}</td>
                  <td className="renov-rp__num">{formatKopecks(it.price, false)}</td>
                  <td className="renov-rp__num">{formatKopecks(it.qty, false)}</td>
                  <td className="renov-rp__num">{formatKopecks(it.sum, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export default MaterialsReportView;
