import { lazy, Suspense, useState } from 'react';
import PageLayout from '../components/PageLayout';
import { RenovationIcon, RefreshIcon, UploadIcon } from '../components/icons';
import Button from '../components/Button';
import AddendumModal from '../components/AddendumModal';
import RenovationPdfModal from '../components/RenovationPdfModal';
import RenovationWorkReport from '../components/RenovationWorkReport';
import RenovationMaterialsReport from '../components/RenovationMaterialsReport';
import { useRenovationOverview } from '../hooks/useRenovationOverview';
import { useRenovationReports } from '../hooks/useRenovationReports';
import { useAuth } from '../hooks/useAuth';
import { formatDateIso, formatKopecks } from '../utils/money';

type Tab = 'summary' | 'work' | 'materials';

// Просмотрщик PDF (pdfjs) — тяжёлый чанк, грузится только при открытии документа.
const PdfViewerModal = lazy(() => import('../components/PdfViewerModal'));

/** Документ для просмотра: серверный путь к PDF + заголовок. */
interface ViewPdfDoc {
  url: string;
  title: string;
}

/**
 * Страница «Ремонт» (этапы 2–5): сводка (Блок 1 Работы / Блок 2 Материалы) из
 * отдельной БД `renovation.sqlite` (`GET /api/renovation`), вкладки «Ход работ»
 * и «Материалы» (отчёты `GET /api/renovation/reports/*`), импорт PDF и
 * применение доп. соглашений (admin). Статичные страницы `projects/renovation/`
 * остаются read-only архивом.
 */
function RenovationPage() {
  const { overview, error, loading, reload } = useRenovationOverview();
  const reports = useRenovationReports();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [importOpen, setImportOpen] = useState(false);
  const [addendumOpen, setAddendumOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('summary');
  const [viewPdf, setViewPdf] = useState<ViewPdfDoc | null>(null);

  const meta = overview?.meta;
  const works = overview?.works;
  const materials = overview?.materials;
  const est = overview?.estimate;

  const switchTab = (t: Tab) => {
    setTab(t);
    if (t !== 'summary') void reports.load();
  };

  /** Открыть PDF документа во встроенном просмотрщике. */
  const openPdf = (url: string, title: string) => setViewPdf({ url, title });

  return (
    <PageLayout>
      <section className="page">
        <div className="page__head">
          <span className="page__icon page__icon--projects">
            <RenovationIcon />
          </span>
          <div>
            <h2>Ремонт квартиры</h2>
            <div className="page__sub">Сводка из БД: смета, акты, материалы, взаиморасчёты</div>
          </div>
          {isAdmin && (
            <div className="page__head-actions">
              <Button icon={<RefreshIcon />} onClick={() => setAddendumOpen(true)}>
                Доп. соглашение
              </Button>
              <Button variant="primary" icon={<UploadIcon />} onClick={() => setImportOpen(true)}>
                Импорт PDF
              </Button>
            </div>
          )}
        </div>

        {error ? (
          <div className="news-empty">Не удалось загрузить сводку «Ремонта»: {error}</div>
        ) : loading || !overview ? (
          <div className="news-empty">Загрузка сводки…</div>
        ) : (
          <>
            {meta && (
              <div className="renov-meta">
                <span>
                  <strong>Объект:</strong> {meta.object}
                </span>
                {meta.contractNo && (
                  <span>
                    <strong>Договор:</strong> {meta.contractNo}
                    {meta.contractDate ? ` от ${formatDateIso(meta.contractDate)}` : ''}
                  </span>
                )}
                {meta.contractor && (
                  <span>
                    <strong>Подрядчик:</strong> {meta.contractor}
                  </span>
                )}
                {meta.startDate && (
                  <span>
                    <strong>Старт:</strong> {formatDateIso(meta.startDate)}
                  </span>
                )}
                {meta.area && (
                  <span>
                    <strong>Площадь:</strong> {meta.area}
                  </span>
                )}
                {meta.deadlineDays != null && (
                  <span>
                    <strong>Срок:</strong> {meta.deadlineDays} раб. дней
                  </span>
                )}
              </div>
            )}

            <div className="renov-grid">
              {/* Блок 1. Работы */}
              <div className="card renov-card">
                <div className="renov-card__head">
                  <span className="renov-card__title">Блок 1. Работы</span>
                  {works?.percent != null && (
                    <span className="renov-card__percent">
                      {works.percent.toLocaleString('ru-RU')}%
                    </span>
                  )}
                </div>
                <div className="renov-card__body">
                  <div className="renov-line">
                    <span className="renov-label">Смета (план)</span>
                    <span className="renov-value">{formatKopecks(est?.total, true)}</span>
                  </div>
                  <div className="renov-line">
                    <span className="renov-label">Выполнено по актам</span>
                    <span className="renov-value">{formatKopecks(works?.factTotal, true)}</span>
                  </div>
                  <div className="renov-divider" />
                  <div className="renov-line">
                    <span className="renov-label">Акты выполненных работ</span>
                    <span className="renov-value renov-value--list">
                      {works && works.acts.length > 0
                        ? works.acts.map((a, i) => (
                            <span key={a.id}>
                              {i > 0 ? ', ' : ''}
                              {a.pdfPath ? (
                                <button
                                  type="button"
                                  className="renov-link"
                                  onClick={() =>
                                    openPdf(
                                      a.pdfPath!,
                                      `Акт ${a.number ?? ''} (${formatDateIso(a.date)})`,
                                    )
                                  }
                                >
                                  Акт {a.number ?? ''} ({formatDateIso(a.date)})
                                </button>
                              ) : (
                                <>
                                  Акт {a.number ?? ''} ({formatDateIso(a.date)})
                                </>
                              )}
                            </span>
                          ))
                        : '—'}
                    </span>
                  </div>
                  <div className="renov-divider" />
                  {overview.settlements.works ? (
                    <>
                      <div className="renov-line">
                        <span className="renov-label">
                          Взаиморасчёты (работы), от{' '}
                          {formatDateIso(overview.settlements.works.date)}
                        </span>
                        <span className="renov-value" />
                      </div>
                      <div className="renov-line renov-line--sub">
                        <span className="renov-label">Внесено заказчиком</span>
                        <span className="renov-value renov-value--blue">
                          {formatKopecks(overview.settlements.works.paidIn, true)}
                        </span>
                      </div>
                      <div className="renov-line renov-line--sub">
                        <span className="renov-label">Использовано</span>
                        <span className="renov-value">
                          {formatKopecks(overview.settlements.works.used, true)}
                        </span>
                      </div>
                      <div className="renov-line renov-line--sub">
                        <span className="renov-label">Остаток</span>
                        <span
                          className={`renov-value ${
                            (overview.settlements.works.balance ?? 0) > 0
                              ? 'renov-value--pos'
                              : (overview.settlements.works.balance ?? 0) < 0
                                ? 'renov-value--neg'
                                : ''
                          }`}
                        >
                          {formatKopecks(overview.settlements.works.balance, true)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="renov-line">
                      <span className="renov-label">Взаиморасчёты (работы)</span>
                      <span className="renov-value">—</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Блок 2. Материалы */}
              <div className="card renov-card">
                <div className="renov-card__head">
                  <span className="renov-card__title">Блок 2. Материалы</span>
                </div>
                <div className="renov-card__body">
                  <div className="renov-line">
                    <span className="renov-label">Итого заказы материалов</span>
                    <span className="renov-value">
                      {formatKopecks(materials?.ordersTotal, true)}
                    </span>
                  </div>
                  {materials && materials.orders.length > 0 && (
                    <>
                      <div className="renov-divider" />
                      <div className="renov-label">Заказы ({materials.orders.length}):</div>
                      {materials.orders.map((o) => (
                        <div className="renov-line renov-line--sub" key={o.id}>
                          <span className="renov-label">
                            {o.pdfPath ? (
                              <button
                                type="button"
                                className="renov-link"
                                onClick={() =>
                                  openPdf(
                                    o.pdfPath!,
                                    `Отчёт №${o.number ?? '—'} от ${formatDateIso(o.date)}`,
                                  )
                                }
                              >
                                Отчёт №{o.number ?? '—'} от {formatDateIso(o.date)}
                              </button>
                            ) : (
                              <>
                                Отчёт №{o.number ?? '—'} от {formatDateIso(o.date)}
                              </>
                            )}
                          </span>
                          <span className="renov-value">{formatKopecks(o.total, true)}</span>
                        </div>
                      ))}
                    </>
                  )}
                  <div className="renov-divider" />
                  {overview.settlements.materials ? (
                    <>
                      <div className="renov-line">
                        <span className="renov-label">
                          Взаиморасчёты (материалы), от{' '}
                          {formatDateIso(overview.settlements.materials.date)}
                        </span>
                        <span className="renov-value" />
                      </div>
                      <div className="renov-line renov-line--sub">
                        <span className="renov-label">Внесено по ведомости</span>
                        <span className="renov-value renov-value--blue">
                          {formatKopecks(overview.settlements.materials.paidIn, true)}
                        </span>
                      </div>
                      <div className="renov-line renov-line--sub">
                        <span className="renov-label">Использовано (с накладными)</span>
                        <span className="renov-value">
                          {formatKopecks(overview.settlements.materials.used, true)}
                        </span>
                      </div>
                      <div className="renov-line renov-line--sub">
                        <span className="renov-label">Остаток</span>
                        <span
                          className={`renov-value ${
                            (overview.settlements.materials.balance ?? 0) > 0
                              ? 'renov-value--pos'
                              : (overview.settlements.materials.balance ?? 0) < 0
                                ? 'renov-value--neg'
                                : ''
                          }`}
                        >
                          {formatKopecks(overview.settlements.materials.balance, true)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="renov-line">
                      <span className="renov-label">Взаиморасчёты (материалы)</span>
                      <span className="renov-value">—</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="renov-tabs">
              {(
                [
                  ['summary', 'Сводка'],
                  ['work', 'Ход работ'],
                  ['materials', 'Материалы'],
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  className={`renov-tab ${tab === key ? 'renov-tab--active' : ''}`}
                  onClick={() => switchTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'work' && <RenovationWorkReport reports={reports} />}
            {tab === 'materials' && (
              <RenovationMaterialsReport reports={reports} onOpenPdf={openPdf} />
            )}

            <div className="renov-note">
              <a href="/projects/renovation/" target="_blank" rel="noopener">
                Открыть статичный архив проекта (PDF, документы, отчёты) →
              </a>
            </div>
          </>
        )}
      </section>

      {importOpen && (
        <RenovationPdfModal onClose={() => setImportOpen(false)} onImported={() => reload()} />
      )}
      {addendumOpen && (
        <AddendumModal onClose={() => setAddendumOpen(false)} onApplied={() => reload()} />
      )}
      {viewPdf && (
        <Suspense fallback={null}>
          <PdfViewerModal
            url={viewPdf.url}
            title={viewPdf.title}
            onClose={() => setViewPdf(null)}
          />
        </Suspense>
      )}
    </PageLayout>
  );
}

export default RenovationPage;
