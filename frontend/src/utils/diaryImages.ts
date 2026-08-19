/**
 * Маркеры фотографий в тексте описания события «Дневника».
 * Формат внутреннего маркера: `![подпись](diary-image://имя-файла)`.
 */

/** Маркер фото для вставки в текст описания (с переносом строки после). */
export function diaryImageMarker(name: string): string {
  return `![Фото](diary-image://${name})\n`;
}

/** Имена файлов фото, на которые ссылается текст описания. */
export function extractDiaryImageNames(content: string): Set<string> {
  return new Set(
    Array.from(
      content.matchAll(/!\[[^\]]*\]\(diary-image:\/\/([a-z0-9._-]+)\)/g),
      (match) => match[1],
    ),
  );
}

/**
 * Удаляет из текста все маркеры, ссылающиеся на фото с заданным именем
 * (используется при удалении фото из события: маркер вырезается из текста).
 */
export function stripDiaryImage(content: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return content.replace(
    new RegExp(`!\\[[^\\]]*\\]\\(diary-image:\\/\\/${escapedName}\\)`, 'g'),
    '',
  );
}
