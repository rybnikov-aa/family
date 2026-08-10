import { useCallback, useEffect, useState } from 'react';
import { fetchRenovationEstimateVersions, type RenovationEstimateVersion } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { formatDateIso, formatKopecks } from '../utils/money';
import Modal from './Modal';
import Button from './Button';
import AddendumModal from './AddendumModal';
import PdfLink from './PdfLink';
import { RefreshIcon } from './icons';

interface RenovationEstimateModalProps {
  /** Закрыть модалку. */
  onClose: () => void;
  /** Открыть PDF во встроенном просмотрщике (url, заголовок). */
  onOpenPdf: (url: string, title: string) => void;
  /** Вызывается после применения доп. соглашения (перезагрузить сводку). */
  onApplied: () => void;
}

/**
 * Строка версии сметы в 3 столбца (как списки документов «Ход работ» /
 * «Закупка материалов»): дата | имя-ссылка | сумма. Отдельной кнопки
 * «Открыть PDF» нет — иконка стоит перед именем, PDF открывается по клику
 * на имя документа (если `pdfPath` задан).
 */
function VersionRow({
  version,
  onOpenPdf,
}: {
  version: RenovationEstimateVersion;
  onOpenPdf: (url: string, title: string) => void;
}) {
  const pdf = version.pdfPath;
  const title = version.label + (version.date ? ` от ${formatDateIso(version.date)}` : '');
  return (
    <div className="est-doc-row">
      <span className="est-doc-date">{version.date ? formatDateIso(version.date) : ''}</span>
      <span className="est-doc-name">
        {pdf ? (
          <PdfLink url={pdf} title={title} onOpenPdf={onOpenPdf}>
            {version.label}
          </PdfLink>
        ) : (
          version.label
        )}
      </span>
      <span className="est-doc-total">{formatKopecks(version.total, true)}</span>
    </div>
  );
}

/**
 * Модалка «Смета»: версии сметы из БД (`GET /api/renovation/estimate/versions`) —
 * исходная смета (версия `seed`, дата/сумма/PDF исходной сметы) и доп. соглашения,
 * с суммами и ссылками на исходные PDF (просмотр во встроенном просмотрщике).
 * Для admin — кнопка «Доп. соглашение» (применение соглашения, `AddendumModal`),
 * перенесённая сюда с шапки страницы. Заменяет прямую ссылку на статичную
 * `estimates.html`.
 */
function RenovationEstimateModal({ onClose, onOpenPdf, onApplied }: RenovationEstimateModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [versions, setVersions] = useState<RenovationEstimateVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addendumOpen, setAddendumOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchRenovationEstimateVersions()
      .then(({ versions: v }) => setVersions(v))
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить смету'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const seed = versions.find((v) => v.kind === 'seed') ?? null;
  const addenda = versions.filter((v) => v.kind === 'addendum');

  return (
    <Modal
      title="Смета"
      onClose={onClose}
      wide
      className="modal--estimate"
      closeOnEscape={!addendumOpen}
    >
      <div className="est-modal">
        {loading ? (
          <div className="est-modal__hint">Загрузка сметы…</div>
        ) : error ? (
          <div className="est-modal__error">{error}</div>
        ) : (
          <>
            <section className="est-modal__block">
              <div className="est-modal__title">Исходная смета</div>
              {seed ? (
                <VersionRow version={seed} onOpenPdf={onOpenPdf} />
              ) : (
                <div className="est-modal__muted">Исходная смета не найдена</div>
              )}
            </section>

            {addenda.length > 0 && (
              <section className="est-modal__block">
                <div className="est-modal__title">Доп. соглашения</div>
                {addenda.map((a) => (
                  <VersionRow key={a.id} version={a} onOpenPdf={onOpenPdf} />
                ))}
              </section>
            )}

            {isAdmin && (
              <div className="est-modal__actions">
                <Button icon={<RefreshIcon />} onClick={() => setAddendumOpen(true)}>
                  Доп. соглашение
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {addendumOpen && (
        <AddendumModal
          onClose={() => setAddendumOpen(false)}
          onApplied={() => {
            onApplied();
            load();
          }}
        />
      )}
    </Modal>
  );
}

export default RenovationEstimateModal;
