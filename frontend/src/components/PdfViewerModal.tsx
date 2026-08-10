import { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { fetchFileBytes } from '../api/client';
import Modal from './Modal';

// Воркер pdf.js — отдельный файл (Vite `?url` отдаёт URL ассета).
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfViewerModalProps {
  /** Серверный путь к PDF (например `/api/renovation/docs/…` или `/projects/…`). */
  url: string;
  /** Заголовок документа в шапке модалки. */
  title: string;
  /** Закрыть модалку. */
  onClose: () => void;
  /**
   * Растягивать модалку так, чтобы документ помещался целиком по ширине
   * (самая широкая страница без горизонтальной прокрутки) — но только если
   * позволяет ширина экрана. Используется для документов дизайн-проекта.
   */
  fitToWidth?: boolean;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const ZOOM_STEP = 0.25;
// Горизонтальные «отступы-хром» вокруг страницы: паддинги модалки (--space-4 ×2)
// и сцены (--space-4 ×2).
const PDF_CHROME_X = 16 * 4;
// Не сужаем форму ниже дефолтной ширины модалки PDF (min(1080px, 96vw)).
const PDF_DEFAULT_MAX = 1080;
// Доступная ширина экрана: бэкдроп (--space-6 = 24 ×2) + запас на скроллбар.
const PDF_BACKDROP_X = 24 * 2 + 8;

/**
 * Просмотр PDF в приложении (pdf.js / pdfjs-dist). Открывается по клику на
 * ссылку документа «Ремонта»; страницы рисуются на `<canvas>` с листанием,
 * масштабом и индикатором страницы. Файл скачивается через `fetchFileBytes`
 * (для `/api/*` — с обработкой 401, для статичного архива `/projects/…` —
 * обычным fetch). Компонент грузится лениво (pdfjs — тяжёлый чанк).
 */
function PdfViewerModal({ url, title, onClose, fitToWidth = false }: PdfViewerModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const taskRef = useRef<pdfjsLib.PDFDocumentLoadingTask | null>(null);
  const docRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorText, setErrorText] = useState('');
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1);
  /** Ширина самой широкой страницы на масштабе 1 (для fitToWidth), px. */
  const [pageWidth, setPageWidth] = useState<number | null>(null);

  // Загрузка документа по url (перезагружается при смене url).
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setErrorText('');
    setPage(1);
    setNumPages(0);
    docRef.current = null;

    (async () => {
      try {
        const data = await fetchFileBytes(url);
        if (cancelled) return;
        const task = pdfjsLib.getDocument({ data: new Uint8Array(data) });
        taskRef.current = task;
        const doc = await task.promise;
        if (cancelled) {
          void task.destroy();
          taskRef.current = null;
          return;
        }
        docRef.current = doc;
        setNumPages(doc.numPages);
        setPage(1);
        if (fitToWidth) {
          // Подгонка под самую широкую страницу (без отрисовки, только метаданные).
          let maxW = 0;
          for (let i = 1; i <= doc.numPages; i++) {
            const p = await doc.getPage(i);
            const vp = p.getViewport({ scale: 1 });
            if (vp.width > maxW) maxW = vp.width;
          }
          if (cancelled) return;
          setPageWidth(maxW || null);
        } else {
          setPageWidth(null);
        }
        setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          setErrorText(err instanceof Error ? err.message : 'Не удалось открыть PDF');
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      taskRef.current?.destroy();
      taskRef.current = null;
      docRef.current = null;
    };
  }, [url]);

  // Рендер текущей страницы на canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    const doc = docRef.current;
    if (status !== 'ready' || !canvas || !doc) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfPage = await doc.getPage(page);
        if (cancelled) return;
        const viewport = pdfPage.getViewport({ scale });
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.save();
        ctx.scale(dpr, dpr);
        const renderTask = pdfPage.render({ canvas, canvasContext: ctx, viewport });
        renderTaskRef.current = renderTask;
        await renderTask.promise;
        renderTaskRef.current = null;
        ctx.restore();
      } catch {
        /* страница не отрисовалась (отмена/закрытие) — игнорируем */
      }
    })();
    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [status, page, scale]);

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, +(s + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, +(s - ZOOM_STEP).toFixed(2)));
  const prevPage = () => setPage((p) => Math.max(1, p - 1));
  const nextPage = () => setPage((p) => Math.min(numPages, p + 1));

  // Ширина модалки для «подогнанных» документов: самая широкая страница +
  // отступы-хром, не уже дефолта (1080) и не шире доступного экрана.
  const modalStyle = useMemo(() => {
    if (!fitToWidth || pageWidth == null) return undefined;
    const desired = pageWidth + PDF_CHROME_X;
    const available = window.innerWidth - PDF_BACKDROP_X;
    const width = Math.min(Math.max(desired, PDF_DEFAULT_MAX), available);
    return { width: `${width}px`, maxWidth: `${width}px` };
  }, [fitToWidth, pageWidth]);

  return (
    <Modal title={title} onClose={onClose} className="modal--pdf" style={modalStyle}>
      <div className="pdf-viewer">
        <div className="pdf-viewer__toolbar">
          <span className="pdf-viewer__file">{url}</span>
          <div className="pdf-viewer__toolbar-group">
            <button
              type="button"
              className="pdf-viewer__btn"
              onClick={zoomOut}
              disabled={scale <= MIN_SCALE}
              aria-label="Уменьшить масштаб"
            >
              −
            </button>
            <span className="pdf-viewer__zoom">{Math.round(scale * 100)}%</span>
            <button
              type="button"
              className="pdf-viewer__btn"
              onClick={zoomIn}
              disabled={scale >= MAX_SCALE}
              aria-label="Увеличить масштаб"
            >
              +
            </button>
          </div>
        </div>

        {status === 'loading' && <div className="pdf-viewer__hint">Загружаем PDF…</div>}
        {status === 'error' && <div className="pdf-viewer__error">{errorText}</div>}

        {status === 'ready' && (
          <>
            <div className="pdf-viewer__stage">
              <canvas ref={canvasRef} />
            </div>
            <div className="pdf-viewer__toolbar pdf-viewer__toolbar--bottom">
              <div className="pdf-viewer__toolbar-group">
                <button
                  type="button"
                  className="pdf-viewer__btn"
                  onClick={prevPage}
                  disabled={page <= 1}
                  aria-label="Предыдущая страница"
                >
                  ‹
                </button>
                <span className="pdf-viewer__pages">
                  {page} / {numPages}
                </span>
                <button
                  type="button"
                  className="pdf-viewer__btn"
                  onClick={nextPage}
                  disabled={page >= numPages}
                  aria-label="Следующая страница"
                >
                  ›
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default PdfViewerModal;
