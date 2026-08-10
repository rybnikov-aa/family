import { useRef, useState } from 'react';
import {
  confirmRenovationPdf,
  uploadRenovationPdf,
  type RenovationDraftSummary,
} from '../api/client';
import { formatDateIso, formatKopecks } from '../utils/money';
import Modal from './Modal';
import Button from './Button';
import ModalDone from './ModalDone';
import { UploadIcon, CheckIcon } from './icons';

interface RenovationPdfModalProps {
  /** Закрыть модалку. */
  onClose: () => void;
  /** Вызывается после успешного подтверждения импорта (перезагрузить сводку). */
  onImported: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  work_act: 'Акт выполненных работ',
  material_order: 'Заказ материалов',
  settlement: 'Ведомость взаиморасчётов',
  addendum: 'Дополнительное соглашение',
};

function typeLabel(draft: RenovationDraftSummary): string {
  if (!draft.type) return 'Тип не распознан';
  const base = TYPE_LABELS[draft.type] ?? draft.type;
  if (draft.type === 'settlement') {
    return draft.subtype ? `${base} (${draft.subtype === 'works' ? 'работы' : 'материалы'})` : base;
  }
  return base;
}

/**
 * Импорт PDF в модуль «Ремонт» (этап 3, admin):
 * загрузка → черновик (тип/дата/позиции/итог) → подтверждение записи в БД.
 * Если автоматический разбор неполный (`needsReview`) — показываем предупреждение.
 */
function RenovationPdfModal({ onClose, onImported }: RenovationPdfModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [phase, setPhase] = useState<'idle' | 'uploading' | 'draft' | 'confirming' | 'done'>(
    'idle',
  );
  const [draft, setDraft] = useState<RenovationDraftSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Выберите файл PDF');
      return;
    }
    setError(null);
    setPhase('uploading');
    try {
      const { draft: d } = await uploadRenovationPdf(file);
      setDraft(d);
      setPhase('draft');
    } catch (err) {
      setPhase('idle');
      setError(err instanceof Error ? err.message : 'Ошибка распознавания PDF');
    }
  };

  const handleConfirm = async () => {
    if (!draft) return;
    setError(null);
    setPhase('confirming');
    try {
      const res = await confirmRenovationPdf(draft.id);
      setResult(`Импортировано: ${typeLabel(draft)}, дата ${formatDateIso(res.date)}`);
      setPhase('done');
      onImported();
    } catch (err) {
      setPhase('draft');
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    }
  };

  return (
    <Modal title="Импорт PDF в «Ремонт»" onClose={onClose}>
      <div className="renov-pdf">
        {phase === 'done' ? (
          <ModalDone message={result} onClose={onClose} />
        ) : (
          <>
            <label className="renov-pdf__file">
              <span>PDF-файл:</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
              />
              <span className="renov-pdf__file-name">{fileName || 'файл не выбран'}</span>
            </label>

            {error && <div className="renov-pdf__error">{error}</div>}

            {phase === 'uploading' && (
              <div className="renov-pdf__hint">Распознаём документ (pdfplumber)…</div>
            )}
            {phase === 'confirming' && <div className="renov-pdf__hint">Сохраняем в БД…</div>}

            {draft && phase === 'draft' && (
              <div className="renov-pdf__draft">
                <div className="renov-pdf__line">
                  <span>Тип</span>
                  <strong>{typeLabel(draft)}</strong>
                </div>
                <div className="renov-pdf__line">
                  <span>Дата</span>
                  <strong>{formatDateIso(draft.date)}</strong>
                </div>
                <div className="renov-pdf__line">
                  <span>Заголовок</span>
                  <strong>{draft.label || '—'}</strong>
                </div>
                {draft.type === 'settlement' ? (
                  <div className="renov-pdf__line">
                    <span>Строк ведомости</span>
                    <strong>{draft.settlementsCount}</strong>
                  </div>
                ) : (
                  <>
                    <div className="renov-pdf__line">
                      <span>Позиций</span>
                      <strong>{draft.itemsCount}</strong>
                    </div>
                    <div className="renov-pdf__line">
                      <span>Итог</span>
                      <strong>{formatKopecks(draft.total, true)}</strong>
                    </div>
                  </>
                )}

                {draft.needsReview && (
                  <div className="renov-pdf__warn">
                    ⚠ Разбор неполный: проверьте позиции/итог перед подтверждением. Для сложных
                    документов используйте навык «Ремонт: PDF → HTML».
                    {draft.warnings.length > 0 && (
                      <ul>
                        {draft.warnings.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="renov-pdf__actions">
              {phase === 'draft' ? (
                <>
                  <Button
                    variant="primary"
                    icon={<CheckIcon />}
                    onClick={handleConfirm}
                    disabled={!draft}
                  >
                    Подтвердить импорт
                  </Button>
                  <Button onClick={onClose}>Отмена</Button>
                </>
              ) : (
                <>
                  <Button
                    variant="primary"
                    icon={<UploadIcon />}
                    onClick={handleUpload}
                    disabled={phase === 'uploading' || phase === 'confirming'}
                  >
                    Загрузить и распознать
                  </Button>
                  <Button onClick={onClose}>Закрыть</Button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default RenovationPdfModal;
