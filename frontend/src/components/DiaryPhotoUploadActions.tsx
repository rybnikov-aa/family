import { useRef } from 'react';
import IconButton from './IconButton';
import { ImagePlusIcon, ImageUpIcon } from './icons';

interface DiaryPhotoUploadActionsProps {
  /** Доступен ли инстанс Immich (показывать кнопку добавления из Immich). */
  immichAvailable: boolean;
  /** Передать выбранные файлы (с диска или из Immich). */
  onAddFiles: (files: File[]) => void;
  /** Открыть пикер Immich. */
  onOpenImmich: () => void;
}

/**
 * Кнопки добавления фото в событие «Дневника»: с диска (`ImageUpIcon`) и из
 * Immich (`ImagePlusIcon`), единый набор для формы события, модалки
 * фотографий и редактора описания. Загрузка с диска — через скрытый input.
 */
function DiaryPhotoUploadActions({
  immichAvailable,
  onAddFiles,
  onOpenImmich,
}: DiaryPhotoUploadActionsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <IconButton
        label="Добавить фото с диска"
        tooltip="Добавить фото с диска"
        onClick={() => inputRef.current?.click()}
      >
        <ImageUpIcon />
      </IconButton>
      {immichAvailable && (
        <IconButton
          label="Добавить фото из Immich"
          tooltip="Добавить фото из Immich"
          onClick={onOpenImmich}
        >
          <ImagePlusIcon />
        </IconButton>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => onAddFiles(Array.from(event.target.files ?? []))}
      />
    </>
  );
}

export default DiaryPhotoUploadActions;
