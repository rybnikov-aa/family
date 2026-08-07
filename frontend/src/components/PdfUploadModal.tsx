import { useEffect, useRef, useState, type FormEvent } from 'react';
import { fetchProjectDirs, uploadProjectPdf } from '../api/client';
import Modal from './Modal';
import Button from './Button';
import { UploadIcon } from './icons';

interface PdfUploadModalProps {
  /** Закрыть модалку */
  onClose: () => void;
}

/** Состояние загрузки: статус, сообщение и URL загруженного файла. */
interface UploadState {
  status: 'idle' | 'uploading' | 'done' | 'error';
  message: string;
  url: string | null;
}

/**
 * Загрузка PDF на сервер (вариант «просто доставка»).
 * Пользователь выбирает папку на сервере внутри каталога проектов и файл PDF;
 * файл сохраняется в эту папку, в ответ приходит ссылка на него.
 */
function PdfUploadModal({ onClose }: PdfUploadModalProps) {
  const [dirs, setDirs] = useState<string[]>([]);
  const [dirsError, setDirsError] = useState<string | null>(null);
  const [folder, setFolder] = useState('');
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [upload, setUpload] = useState<UploadState>({ status: 'idle', message: '', url: null });

  // При открытии загружаем список папок и выбираем первую.
  useEffect(() => {
    let active = true;
    fetchProjectDirs()
      .then((list) => {
        if (!active) return;
        setDirs(list);
        if (list.length > 0) setFolder(list[0]);
      })
      .catch((err: unknown) => {
        if (active) {
          setDirsError(err instanceof Error ? err.message : 'Не удалось получить список папок');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // Escape закрывает базовый Modal.

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];

    if (!folder) {
      setUpload({ status: 'error', message: 'Выберите папку назначения', url: null });
      return;
    }
    if (!file) {
      setUpload({ status: 'error', message: 'Выберите файл PDF', url: null });
      return;
    }

    setUpload({ status: 'uploading', message: '', url: null });
    try {
      const result = await uploadProjectPdf(folder, file);
      setUpload({ status: 'done', message: 'Файл загружен', url: result.url });
    } catch (err) {
      setUpload({
        status: 'error',
        message: err instanceof Error ? err.message : 'Не удалось загрузить файл',
        url: null,
      });
    }
  };

  // Группируем папки по проекту (первый сегмент пути) для удобного выбора.
  const grouped = new Map<string, string[]>();
  for (const dir of dirs) {
    const project = dir.split('/')[0];
    const list = grouped.get(project) ?? [];
    list.push(dir);
    grouped.set(project, list);
  }

  const noteClass =
    upload.status === 'done'
      ? ' modal__import-note--ok'
      : upload.status === 'error'
        ? ' modal__import-note--error'
        : '';

  return (
    <Modal title="Загрузка PDF" onClose={onClose}>
      {dirsError ? (
        <div className="modal__import-note modal__import-note--error" role="alert">
          {dirsError}
        </div>
      ) : dirs.length === 0 ? (
        <div className="modal__import-note" role="status">
          На сервере пока нет папок для загрузки.
        </div>
      ) : (
        <form className="vps-form" onSubmit={handleSubmit}>
          <label className="vps-form__field">
            <span className="vps-form__label">Папка на сервере</span>
            <select
              className="vps-form__control"
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
              required
            >
              {[...grouped.entries()].map(([project, list]) => (
                <optgroup key={project} label={project}>
                  {list.map((dir) => (
                    <option key={dir} value={dir}>
                      {dir}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          <div className="vps-form__field">
            <span className="vps-form__label">Файл PDF</span>
            <div className="pdf-upload__file-row">
              <Button onClick={() => fileInputRef.current?.click()}>Выбрать файл…</Button>
              <span className="pdf-upload__file-name">{fileName || 'файл не выбран'}</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                setFileName(file ? file.name : '');
                setUpload({ status: 'idle', message: '', url: null });
              }}
            />
          </div>

          {upload.status !== 'idle' && (
            <div className={`modal__import-note${noteClass}`} role="status">
              {upload.status === 'uploading' && 'Загрузка…'}
              {upload.status === 'done' && (
                <>
                  Файл загружен:{' '}
                  <a href={upload.url ?? '#'} target="_blank" rel="noopener">
                    {upload.url}
                  </a>
                </>
              )}
              {upload.status === 'error' && upload.message}
            </div>
          )}

          <div className="vps-form__actions">
            <Button onClick={onClose}>Закрыть</Button>
            <Button
              type="submit"
              variant="primary"
              icon={<UploadIcon />}
              disabled={upload.status === 'uploading'}
            >
              Загрузить
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default PdfUploadModal;
