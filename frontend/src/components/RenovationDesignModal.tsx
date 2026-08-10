import { useEffect, useState } from 'react';
import { fetchRenovationDesignDocs, type RenovationDesignDoc } from '../api/client';
import Modal from './Modal';
import PdfLink from './PdfLink';

interface RenovationDesignModalProps {
  /** Закрыть модалку. */
  onClose: () => void;
  /** Открыть документ во встроенном просмотрщике (url, заголовок). */
  onOpenPdf: (url: string, title: string, fitToWidth?: boolean) => void;
}

/**
 * Модалка «Дизайн-проект»: список документов дизайн-проекта из хранилища
 * (`GET /api/renovation/design`, файлы в подпапке `design/` каталога документов
 * на сервере). По клику на документ он открывается во встроенном просмотрщике
 * PDF (`PdfViewerModal`). Заменяет прямую ссылку на статичный PDF.
 */
function RenovationDesignModal({ onClose, onOpenPdf }: RenovationDesignModalProps) {
  const [docs, setDocs] = useState<RenovationDesignDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchRenovationDesignDocs()
      .then(({ docs: d }) => {
        if (active) setDocs(d);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Не удалось загрузить документы');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Modal title="Дизайн-проект" onClose={onClose}>
      <div className="design-modal">
        {loading ? (
          <div className="design-modal__hint">Загрузка документов…</div>
        ) : error ? (
          <div className="design-modal__error">{error}</div>
        ) : docs.length === 0 ? (
          <div className="design-modal__empty">Документы дизайн-проекта не найдены</div>
        ) : (
          <ul className="design-modal__list">
            {docs.map((d) => (
              <li key={d.fileName}>
                <PdfLink
                  url={d.url}
                  title={d.title}
                  onOpenPdf={onOpenPdf}
                  fitToWidth
                  className="design-modal__link"
                >
                  {d.title}
                </PdfLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

export default RenovationDesignModal;
