import type { useRenovationReports } from '../hooks/useRenovationReports';
import PdfLink from './PdfLink';
import { formatDateIso, formatKopecks } from '../utils/money';

interface Props {
  reports: ReturnType<typeof useRenovationReports>;
  /** Открыть PDF документа (url, заголовок) во встроенном просмотрщике. */
  onOpenPdf?: (url: string, title: string) => void;
}

/** «Материалы»: заказы материалов с позициями и итогами (агрегировано из БД). */
function MaterialsReportView({ reports, onOpenPdf }: Props) {
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
              {o.pdfPath ? (
                <PdfLink
                  url={o.pdfPath}
                  title={`Отчёт №${o.number ?? '—'} · ${formatDateIso(o.date)}`}
                  onOpenPdf={onOpenPdf}
                >
                  Отчёт №{o.number ?? '—'} · {formatDateIso(o.date)}
                </PdfLink>
              ) : (
                <>
                  Отчёт №{o.number ?? '—'} · {formatDateIso(o.date)}
                </>
              )}
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
          <table className="renov-rp__table renov-rp__table--fixed renov-rp__table--materials">
            <colgroup>
              <col className="renov-rp__col-num" />
              <col />
              <col className="renov-rp__col-price" />
              <col className="renov-rp__col-qty" />
              <col className="renov-rp__col-sum" />
            </colgroup>
            <thead>
              <tr>
                <th>№</th>
                <th className="renov-rp__th-left">Наименование</th>
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
                    <span className="renov-rp__name">
                      <span className="renov-rp__name-text">{it.name}</span>
                      {it.unit && <span className="renov-rp__unit">{it.unit}</span>}
                    </span>
                  </td>
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
