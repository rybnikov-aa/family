import { useState } from 'react';
import {
  buildDiaryFormData,
  diaryImageUrl,
  updateDiaryEvent,
  type DiaryEventDetail,
} from '../api/client';
import { extractDiaryImageNames, stripDiaryImage } from '../utils/diaryImages';
import type { FormImage } from '../types/diary';

/** Изменения фотосета, применяемые мгновенным PATCH-сохранением. */
interface DiaryPhotoChanges {
  /** Новые файлы (добавление с диска или из Immich). */
  extra?: { id: string; file: File }[];
  /** Имена сохраняемых существующих изображений (после удаления). */
  keep?: string[];
  /** Контент описания (после удаления фото, вставленного в текст). */
  content?: string;
  /** id новой обложки. */
  cover: string | null;
}

/**
 * Мгновенный редактор фотосета события «Дневника» — модалка «Фотографии»
 * (`DiaryPhotosModal`): каждое действие (добавление, выбор обложки, удаление)
 * сразу сохраняется через `PATCH /api/diary/:id`. Используется на странице
 * события и в карточке списка (кнопка «Редактировать фотографии»).
 *
 * `onSaved` получает обновлённое событие — вызывающий синхронизирует своё
 * состояние (перезагрузка детали на странице события, обновление модалки
 * и списка на странице списка).
 */
export function useDiaryPhotosEditor(
  event: DiaryEventDetail | null,
  onSaved: (updated: DiaryEventDetail) => void,
) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [photoSaving, setPhotoSaving] = useState(false);

  // Имена фото, на которые ссылается текст описания (бейдж «В тексте»).
  const contentImageNames = extractDiaryImageNames(event?.content ?? '');

  const savePhotos = async (changes: DiaryPhotoChanges) => {
    if (!event || photoSaving) return;
    setPhotoSaving(true);
    try {
      const formData = buildDiaryFormData({
        title: event.title,
        dateStart: event.dateStart,
        dateEnd: event.dateEnd,
        summary: event.summary,
        content: changes.content ?? event.content,
        cover: changes.cover,
        images: [
          ...(changes.keep ?? event.images).map((name) => ({ id: name, file: null })),
          ...(changes.extra ?? []),
        ],
        keep: changes.keep ?? event.images,
      });
      onSaved(await updateDiaryEvent(event.id, formData));
    } catch {
      window.alert('Не удалось сохранить фотографии. Попробуйте ещё раз.');
    } finally {
      setPhotoSaving(false);
    }
  };

  const addFiles = (files: File[]) => {
    if (!event) return;
    const extra = files.map((file, index) => ({ id: `new-${index}`, file }));
    void savePhotos({ extra, cover: event.cover });
  };

  const selectCover = (id: string) => {
    void savePhotos({ cover: id });
  };

  const removeImage = (id: string) => {
    if (!event) return;
    // Фото добавлено в текст описания (бейдж «В тексте»): удаление вырежет маркер и из текста.
    if (contentImageNames.has(id)) {
      const proceed = window.confirm(
        'Фотография добавлена в текст описания и будет удалена и из текста. Удалить?',
      );
      if (!proceed) return;
    }
    const keep = event.images.filter((name) => name !== id);
    void savePhotos({
      keep,
      content: stripDiaryImage(event.content, id),
      cover: event.cover === id ? (keep[0] ?? null) : event.cover,
    });
  };

  /**
   * Пропсы модалки «Фотографии», зависящие от события; `null`, когда события
   * нет. Внешние пропсы (onClose, immichAvailable, onOpenImmich, isForeground)
   * подставляет вызывающий — они различаются по месту использования.
   */
  const photosProps = event
    ? {
        images: event.images.map((name): FormImage => ({
          id: name,
          file: null,
          preview: diaryImageUrl(event.folder, name, true),
        })),
        cover: event.cover,
        usedImageNames: contentImageNames,
        onAddFiles: addFiles,
        onSelectCover: selectCover,
        onRemoveImage: removeImage,
      }
    : null;

  return { pickerOpen, setPickerOpen, photoSaving, contentImageNames, photosProps };
}

export default useDiaryPhotosEditor;
