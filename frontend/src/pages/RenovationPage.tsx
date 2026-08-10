import { lazy, Suspense, useState, type ReactNode } from 'react';
import PageLayout from '../components/PageLayout';
import { RenovationIcon, RefreshIcon, UploadIcon } from '../components/icons';
import Button from '../components/Button';
import AddendumModal from '../components/AddendumModal';
import RenovationPdfModal from '../components/RenovationPdfModal';
import RenovationWorkReport from '../components/RenovationWorkReport';
import RenovationMaterialsReport from '../components/RenovationMaterialsReport';
import RenovationSummaryCard from '../components/RenovationSummaryCard';
import MaterialsBudgetModal from '../components/MaterialsBudgetModal';
import RenovDocRow from '../components/RenovDocRow';
import RenovationSettlement from '../components/RenovationSettlement';
import StatRow from '../components/StatRow';
import Tabs from '../components/Tabs';
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
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('summary');
  const [viewPdf, setViewPdf] = useState<ViewPdfDoc | null>(null);

  const meta = overview?.meta;
  const works = overview?.works;
  const materials = overview?.materials;
  const est = overview?.estimate;
  // Даты последних ведомостей взаиморасчётов — для пометки «учтён в ведомости».
  const worksSettledAt = overview?.settlements.works?.date ?? null;
  const materialsSettledAt = overview?.settlements.materials?.date ?? null;
  // «Учтено по актам» в ведомостях: использовано минус подотчётные.
  const worksUsedByActs =
    overview?.settlements.works?.used != null
      ? overview.settlements.works.used - (overview.settlements.works.foremenAmount ?? 0)
      : null;
  const materialsUsedByActs =
    overview?.settlements.materials?.used != null
      ? overview.settlements.materials.used - (overview.settlements.materials.foremenAmount ?? 0)
      : null;
  // Сумма документов, учтённых в ведомости (дата ≤ даты последней ведомости по типу).
  const worksSettledSum =
    works && worksSettledAt
      ? works.acts.reduce(
          (acc, a) =>
            a.date <= worksSettledAt && a.totalWithOverhead != null
              ? acc + a.totalWithOverhead
              : acc,
          0,
        )
      : null;
  const materialsSettledSum =
    materials && materialsSettledAt
      ? materials.orders.reduce(
          (acc, o) => (o.date <= materialsSettledAt && o.total != null ? acc + o.total : acc),
          0,
        )
      : null;
  // Расхождения «Учтено по актам» с суммой учтённых документов (в т.ч. копеечные).
  const worksDiff =
    worksSettledSum != null && worksUsedByActs != null ? worksSettledSum - worksUsedByActs : null;
  const materialsDiff =
    materialsSettledSum != null && materialsUsedByActs != null
      ? materialsSettledSum - materialsUsedByActs
      : null;
  // Сноски (подотчётные прораба + расхождения) — для блока «Примечания».
  const notes: { ref: number; text: ReactNode }[] = [];
  const addNote = (text: ReactNode): number => {
    const ref = notes.length + 1;
    notes.push({ ref, text });
    return ref;
  };
  const worksForemen = overview?.settlements.works?.foremenAmount ?? null;
  const worksNote =
    worksForemen != null
      ? {
          ref: addNote(
            <>в т.ч. подотчётные прораба на сумму {formatKopecks(worksForemen, true)}</>,
          ),
          amount: worksForemen,
        }
      : null;
  const worksDiffNote =
    worksDiff != null && worksDiff !== 0
      ? {
          ref: addNote(
            <>
              расхождение {formatKopecks(Math.abs(worksDiff), true)} между суммой по актам, учтённым
              в ведомости ({formatKopecks(worksSettledSum, true)}), и строкой «Учтено по актам» —
              соответствует исходным документам, не исправлено
            </>,
          ),
          amount: worksDiff,
        }
      : null;
  const materialsForemen = overview?.settlements.materials?.foremenAmount ?? null;
  const materialsNote =
    materialsForemen != null
      ? {
          ref: addNote(
            <>в т.ч. подотчётные прораба на сумму {formatKopecks(materialsForemen, true)}</>,
          ),
          amount: materialsForemen,
        }
      : null;
  const materialsDiffNote =
    materialsDiff != null && materialsDiff !== 0
      ? {
          ref: addNote(
            <>
              расхождение {formatKopecks(Math.abs(materialsDiff), true)} между суммой по заказам,
              учтённым в ведомости ({formatKopecks(materialsSettledSum, true)}), и строкой «Учтено
              по актам» — соответствует исходным документам, не исправлено
            </>,
          ),
          amount: materialsDiff,
        }
      : null;
  // Прогресс освоения бюджета (факт по актам из плана сметы) — для прогресс-бара.
  const worksProgress =
    works && est && est.total != null && works.factTotal != null && est.total !== 0
      ? {
          percent: works.percent ?? Math.round((works.factTotal / est.total) * 1000) / 10,
          done: works.factTotal,
          total: est.total,
        }
      : null;

  // Прогресс «Блока 2. Материалы»: сумма по заказам из бюджета на материалы.
  // Подпись — как у «Блока 1. Работы» («сумма из бюджет» + %), бюджет — ссылка.
  const materialsBudget = overview?.materialsBudget ?? null;
  const materialsBudgetValue = materialsBudget?.value ?? null;
  const materialsProgress =
    materials && materialsBudgetValue != null && materials.ordersTotal != null
      ? {
          percent:
            materialsBudgetValue !== 0
              ? Math.round((materials.ordersTotal / materialsBudgetValue) * 1000) / 10
              : 0,
          done: materials.ordersTotal,
          total: materialsBudgetValue,
          totalLabel: isAdmin ? (
            <button
              type="button"
              className="renov-link"
              title="Бюджет на материалы — изменить"
              onClick={() => setBudgetOpen(true)}
            >
              {formatKopecks(materialsBudgetValue, true)}
            </button>
          ) : (
            formatKopecks(materialsBudgetValue, true)
          ),
        }
      : null;

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
              <RenovationSummaryCard title="Блок 1. Работы" progress={worksProgress}>
                <div className="renov-divider" />
                <StatRow
                  label={
                    works && works.acts.length > 0 ? (
                      <>
                        Акты выполненных работ
                        <span className="renov-pill">{works.acts.length}</span>
                      </>
                    ) : (
                      'Акты выполненных работ'
                    )
                  }
                />
                {works && works.acts.length > 0 && (
                  <>
                    {works.acts.map((a, i) => (
                      <RenovDocRow
                        key={a.id}
                        date={a.date}
                        name={`Акт №${a.number ?? i + 1}`}
                        sum={a.totalWithOverhead}
                        accounted={worksSettledAt != null && a.date <= worksSettledAt}
                        pdfPath={a.pdfPath}
                        pdfTitle={`Акт №${a.number ?? i + 1} (${formatDateIso(a.date)})`}
                        onOpenPdf={openPdf}
                      />
                    ))}
                  </>
                )}
                {overview.settlements.works ? (
                  <RenovationSettlement
                    title="Взаиморасчёты (работы)"
                    date={overview.settlements.works.date}
                    pdfPath={overview.settlements.works.pdfPath}
                    onOpenPdf={openPdf}
                    paidInLabel="Внесено заказчиком"
                    paidIn={overview.settlements.works.paidIn}
                    used={overview.settlements.works.used}
                    balance={overview.settlements.works.balance}
                    foremenAmount={worksNote?.amount ?? null}
                    noteRef={worksNote?.ref ?? null}
                    diffAmount={worksDiffNote?.amount ?? null}
                    diffNoteRef={worksDiffNote?.ref ?? null}
                  />
                ) : (
                  <div className="renov-section">
                    <div className="renov-divider" />
                    <StatRow label="Взаиморасчёты (работы)" value="—" />
                  </div>
                )}
              </RenovationSummaryCard>

              {/* Блок 2. Материалы */}
              <RenovationSummaryCard title="Блок 2. Материалы" progress={materialsProgress}>
                {materials && materials.orders.length > 0 && (
                  <>
                    <div className="renov-divider" />
                    <StatRow
                      label={
                        <>
                          Заказы
                          <span className="renov-pill">{materials.orders.length}</span>
                        </>
                      }
                    />
                    {materials.orders.map((o) => (
                      <RenovDocRow
                        key={o.id}
                        date={o.date}
                        name={`Отчёт №${o.number ?? '—'}`}
                        sum={o.total}
                        accounted={materialsSettledAt != null && o.date <= materialsSettledAt}
                        pdfPath={o.pdfPath}
                        pdfTitle={`Отчёт №${o.number ?? '—'} от ${formatDateIso(o.date)}`}
                        onOpenPdf={openPdf}
                      />
                    ))}
                  </>
                )}
                {overview.settlements.materials ? (
                  <RenovationSettlement
                    title="Взаиморасчёты (материалы)"
                    date={overview.settlements.materials.date}
                    pdfPath={overview.settlements.materials.pdfPath}
                    onOpenPdf={openPdf}
                    paidInLabel="Внесено заказчиком"
                    paidIn={overview.settlements.materials.paidIn}
                    used={overview.settlements.materials.used}
                    balance={overview.settlements.materials.balance}
                    foremenAmount={materialsNote?.amount ?? null}
                    noteRef={materialsNote?.ref ?? null}
                    diffAmount={materialsDiffNote?.amount ?? null}
                    diffNoteRef={materialsDiffNote?.ref ?? null}
                  />
                ) : (
                  <div className="renov-section">
                    <div className="renov-divider" />
                    <StatRow label="Взаиморасчёты (материалы)" value="—" />
                  </div>
                )}
              </RenovationSummaryCard>
            </div>

            {notes.length > 0 && (
              <div className="renov-notes">
                <h3 className="renov-notes__title">Примечания</h3>
                {notes.map((n) => (
                  <p key={n.ref} className="renov-notes__item">
                    <sup>{n.ref}</sup> {n.text}
                  </p>
                ))}
              </div>
            )}

            <Tabs
              items={[
                { value: 'summary', label: 'Сводка' },
                { value: 'work', label: 'Ход работ' },
                { value: 'materials', label: 'Материалы' },
              ]}
              value={tab}
              onChange={switchTab}
            />

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
      {budgetOpen && (
        <MaterialsBudgetModal
          budget={materialsBudget}
          onClose={() => setBudgetOpen(false)}
          onSaved={() => reload()}
        />
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
