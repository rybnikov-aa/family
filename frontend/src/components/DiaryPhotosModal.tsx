import { useRef } from 'react';
import Modal from './Modal';
import IconButton from './IconButton';
import Tooltip from './Tooltip';
import { CheckIcon, ImagePlusIcon, ImageUpIcon, TrashIcon } from './icons';
import type { FormImage } from './DiaryEventModal';

interface DiaryPhotosModalProps {
  images: FormImage[];
  cover: string | null;
  usedImageNames: Set<string>;
  immichAvailable: boolean;
  onClose: () => void;
  onAddFiles: (files: File[]) => void;
  onOpenImmich: () => void;
  onSelectCover: (id: string) => void;
  onRemoveImage: (id: string) => void;
  isForeground: boolean;
}

/** Полный редактор фотосета события; изменения остаются черновиком основной формы. */
function DiaryPhotosModal({
  images,
  cover,
  usedImageNames,
  immichAvailable,
  onClose,
  onAddFiles,
  onOpenImmich,
  onSelectCover,
  onRemoveImage,
  isForeground,
}: DiaryPhotosModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const actions = (
    <>
      <IconButton
        label="Добавить фото с диска"
        tooltip="Добавить фото с диска"
        onClick={() => fileInputRef.current?.click()}
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
    </>
  );

  return (
    <Modal title="Фотографии" onClose={onClose} wide actions={actions} isForeground={isForeground}>
      <div className="diary-photos-modal">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => onAddFiles(Array.from(event.target.files ?? []))}
        />
        <div className="diary-photos">
          {images.length === 0 && (
            <div className="diary-photos__empty">Фотографии ещё не добавлены</div>
          )}
          {images.map((image) => {
            const isInDescription = usedImageNames.has(image.id);
            return (
              <div
                key={image.id}
                className={`diary-photo${cover === image.id ? ' diary-photo--cover' : ''}${
                  isInDescription ? ' diary-photo--used' : ''
                }`}
              >
                <Tooltip content="Сделать основной фотографией">
                  <button
                    type="button"
                    className="diary-photo__select"
                    aria-pressed={cover === image.id}
                    onClick={() => onSelectCover(image.id)}
                  >
                    <img src={image.preview} alt="" />
                  </button>
                </Tooltip>
                {cover === image.id && (
                  <span className="diary-photo__badge">
                    <CheckIcon /> Обложка
                  </span>
                )}
                {isInDescription && <span className="diary-photo__used">В тексте</span>}
                <span className="diary-photo__remove">
                  <IconButton
                    label="Удалить фотографию"
                    tooltip="Удалить"
                    size="sm"
                    plain
                    danger
                    onClick={() => onRemoveImage(image.id)}
                  >
                    <TrashIcon />
                  </IconButton>
                </span>
              </div>
            );
          })}
        </div>
        <span className="field__hint">
          Клик по фотографии — выбрать основную («Обложка»). JPG, PNG, WebP, GIF.
        </span>
      </div>
    </Modal>
  );
}

export default DiaryPhotosModal;
