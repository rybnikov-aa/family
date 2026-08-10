import { useCallback, useEffect, useState } from 'react';
import { fetchRenovationEstimateVersions, type RenovationEstimateVersion } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { formatDateIso, formatKopecks } from '../utils/money';
import Modal from './Modal';
import Button from './Button';
import AddendumModal from './AddendumModal';
import { DocIcon, RefreshIcon } from './icons';

interface RenovationEstimateModalProps {
  /** Закрыть модалку. */
  onClose: () => void;
  /** Открыть PDF во встроенном просмотрщике (url, заголовок). */
  onOpenPdf: (url: string, title: string) => void;
  /** Вызывается после применения доп. соглашения (перезагрузить сводку). */
  onApplied: () => void;
}

/** Кнопка-ссылка на исходный PDF версии сметы (если путь задан). */
function VersionPdfLink({
  version,
  onOpenPdf,
}: {
  version: RenovationEstimateVersion;
  onOpenPdf: (url: string, title: string) => void;
}) {
  const pdf = version.pdfPath;
  if (!pdf) return null;
  const title = version.label + (version.date ? ` от ${formatDateIso(version.date)}` : '');
  return (
    <button
      type="button"
      className="renov-link"
      onClick={() => onOpenPdf(pdf, title)}
      title={`Открыть исходный документ (PDF)`}
    >
      <DocIcon />
      Открыть PDF
    </button>
  );
}

/**
 * Модалка «Смета»: версии сметы из БД (`GET /api/renovation/estimate/versions`) —
 * актуальная смета и доп. соглашения, с суммами и ссылками на исходные PDF
 * (просмотр во встроенном просмотрщике). Для admin — кнопка «Доп. соглашение»
 * (применение соглашения, `AddendumModal`), перенесённая сюда с шапки страницы.
 * Заменяет прямую ссылку на статичную `estimates.html`.
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

  const current = versions.find((v) => v.kind === 'current') ?? null;
  const addenda = versions.filter((v) => v.kind === 'addendum');
  const history = versions.filter((v) => v.kind === 'history' || v.kind === 'seed');

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
              <div className="est-modal__title">Актуальная смета</div>
              {current ? (
                <div className="est-modal__row">
                  <span className="est-modal__name">{current.label}</span>
                  <span className="est-modal__total">{formatKopecks(current.total, true)}</span>
                  <VersionPdfLink version={current} onOpenPdf={onOpenPdf} />
                </div>
              ) : (
                <div className="est-modal__muted">Актуальная смета не найдена</div>
              )}
            </section>

            {addenda.length > 0 && (
              <section className="est-modal__block">
                <div className="est-modal__title">Доп. соглашения</div>
                {addenda.map((a) => (
                  <div key={a.id} className="est-modal__row">
                    <span className="est-modal__name">
                      {a.label}
                      {a.date ? ` от ${formatDateIso(a.date)}` : ''}
                    </span>
                    <span className="est-modal__total">{formatKopecks(a.total, true)}</span>
                    <VersionPdfLink version={a} onOpenPdf={onOpenPdf} />
                  </div>
                ))}
              </section>
            )}

            {history.length > 0 && (
              <section className="est-modal__block">
                <div className="est-modal__title">История</div>
                {history.map((h) => (
                  <div key={h.id} className="est-modal__row est-modal__row--muted">
                    <span className="est-modal__name">
                      {h.label}
                      {h.date ? ` от ${formatDateIso(h.date)}` : ''}
                    </span>
                    <span className="est-modal__total">{formatKopecks(h.total, true)}</span>
                    <VersionPdfLink version={h} onOpenPdf={onOpenPdf} />
                  </div>
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
