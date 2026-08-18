interface UploadProgressProps {
  /** Индекс текущего файла (0-based). */
  currentIndex: number;
  /** Имя текущего файла. */
  currentName: string;
  /** Прогресс текущего файла (0–100). */
  currentPercent: number;
  /** Общий прогресс (0–100). */
  overallPercent: number;
  /** Число файлов. */
  totalFiles: number;
}

/**
 * Прогресс передачи файлов: две полоски — «Фото N из M · имя» (текущий файл)
 * и «Общий прогресс». Используется в форме события «Дневника» (загрузка фото)
 * и в пикере Immich (скачивание оригиналов). Стили — `styles/diary.css`
 * (`.diary-upload-progress*`).
 */
function UploadProgress({
  currentIndex,
  currentName,
  currentPercent,
  overallPercent,
  totalFiles,
}: UploadProgressProps) {
  return (
    <div className="diary-upload-progress" aria-live="polite" aria-atomic="true">
      <div className="diary-upload-progress__header">
        <span>
          Фото {currentIndex + 1} из {totalFiles}
          {currentName ? ` · ${currentName}` : ''}
        </span>
        <span>{currentPercent}%</span>
      </div>
      <div
        className="diary-upload-progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={currentPercent}
      >
        <span className="diary-upload-progress__fill" style={{ width: `${currentPercent}%` }} />
      </div>
      <div className="diary-upload-progress__header diary-upload-progress__header--overall">
        <span>Общий прогресс</span>
        <span>{overallPercent}%</span>
      </div>
      <div
        className="diary-upload-progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={overallPercent}
      >
        <span className="diary-upload-progress__fill" style={{ width: `${overallPercent}%` }} />
      </div>
    </div>
  );
}

export default UploadProgress;
