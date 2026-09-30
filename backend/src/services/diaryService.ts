import {
  createDiaryEventRow,
  deleteDiaryEventRow,
  getDiaryEventRow,
  listDiaryEventRows,
  updateDiaryEventRow,
  replaceDiaryEventTags,
  type DiaryEventRow,
} from '../db/diaryRepository';
import {
  imageFileName,
  listEventImages,
  newEventFolder,
  removeEventImage,
  removeEventImages,
  saveEventImage,
} from './diary/imageStore';
import { isValidIsoDate } from '../utils/date';

/** Ошибка с HTTP-статусом — для ответов 400/404/409 и т.п. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** Проверка корректности даты (`2026-08-15` и т.п.). */
function isValidDate(value: string): boolean {
  return isValidIsoDate(value);
}

function cleanupEventImages(folder: string): void {
  try {
    removeEventImages(folder);
  } catch (err) {
    console.error('Не удалось очистить изображения дневника', err);
  }
}

function cleanupNewImages(folder: string, names: string[]): void {
  for (const name of names) {
    try {
      removeEventImage(folder, name);
    } catch (err) {
      console.error('Не удалось очистить новое изображение дневника', err);
    }
  }
}

/** Нормализует и валидирует дату; кидает `HttpError(400)` при некорректной. */
function normalizeDate(value: string, label: string): string {
  const v = value.trim();
  if (!isValidDate(v)) {
    throw new HttpError(400, `${label} — некорректная дата (нужен формат ГГГГ-ММ-ДД)`);
  }
  return v;
}

/** Публичные данные события для списка/карточки. */
export interface DiaryEventSummary {
  id: number;
  title: string;
  dateStart: string;
  dateEnd: string | null;
  summary: string;
  place: string;
  participants: string[];
  tags: string[];
  /** Уникальная папка изображений события (в `images/`). */
  folder: string;
  /** Имя файла основной фотографии (в папке события); `null` — нет обложки. */
  cover: string | null;
  /** Имена файлов изображений события (в папке события). */
  images: string[];
}

/** Полные данные события: сводка + markdown-контент. */
export interface DiaryEventDetail extends DiaryEventSummary {
  content: string;
}

/**
 * Входные данные создания/обновления события (multipart, разобранные
 * контроллером). Новые файлы приходят в `files` в порядке поля `images`;
 * их клиентские id — в `newIds` (той же длины). Существующие файлы, которые
 * нужно сохранить, — в `keep` (порядок сохраняется). `cover` — клиентский id
 * нового файла (`new-…`) либо имя существующего файла; `null` — обложка не
 * задана (берётся первое изображение).
 */
export interface DiaryEventUpload {
  title: string;
  dateStart: string;
  dateEnd: string | null;
  summary: string;
  place: string;
  participants: string[];
  tags: string[];
  content: string;
  cover: string | null;
  newIds: string[];
  keep: string[];
  files: { buffer: Buffer; originalName: string }[];
}

const DIARY_IMAGE_RE = /!\[([^\]]*)\]\(diary-image:\/\/([a-z0-9._-]+)\)/g;

/** Заменяет временные id новых файлов и возвращает имена фотографий в описании. */
function resolveContentImages(
  content: string,
  newIds: string[],
  savedNames: string[],
  availableNames: string[],
): { content: string; selectedNames: Set<string> } {
  const selectedNames = new Set<string>();
  const resolvedContent = content.replace(DIARY_IMAGE_RE, (match, _alt: string, ref: string) => {
    const newIndex = newIds.indexOf(ref);
    const name = newIndex >= 0 ? savedNames[newIndex] : ref;
    if (!name || !availableNames.includes(name)) {
      throw new HttpError(400, 'В описании указана недоступная фотография');
    }
    selectedNames.add(name);
    return newIndex >= 0 ? match.replace(`diary-image://${ref}`, `diary-image://${name}`) : match;
  });
  return { content: resolvedContent, selectedNames };
}

/** Строка БД → сводка события (обложка по умолчанию — первое изображение). */
function rowToSummary(row: DiaryEventRow): DiaryEventSummary {
  const allImages = listEventImages(row.folder);
  const cover =
    row.cover && allImages.includes(row.cover)
      ? row.cover
      : allImages.length > 0
        ? allImages[0]
        : null;
  return {
    id: row.id,
    title: row.title,
    dateStart: row.date_start,
    dateEnd: row.date_end,
    summary: row.summary,
    place: row.place,
    participants: parseParticipants(row.participants_json),
    tags: row.tags,
    folder: row.folder,
    cover,
    images: allImages,
  };
}

function parseParticipants(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Валидация текстовых полей + нормализация дат (общая для create/update). */
function normalizeFields(input: DiaryEventUpload): {
  title: string;
  dateStart: string;
  dateEnd: string | null;
  summary: string;
  place: string;
  participants: string[];
  tags: string[];
} {
  const title = input.title.trim();
  const summary = input.summary.trim();
  if (title === '') {
    throw new HttpError(400, 'Укажите название события');
  }
  if (summary === '') {
    throw new HttpError(400, 'Укажите краткое описание события');
  }
  const dateStart = normalizeDate(input.dateStart, 'Дата начала');
  const dateEnd =
    input.dateEnd && input.dateEnd.trim() !== ''
      ? normalizeDate(input.dateEnd, 'Дата окончания')
      : null;
  if (dateEnd && dateEnd < dateStart) {
    throw new HttpError(400, 'Дата окончания раньше даты начала');
  }
  return {
    title,
    dateStart,
    dateEnd,
    summary,
    place: input.place.trim(),
    participants: [...new Set(input.participants.map((item) => item.trim()).filter(Boolean))],
    tags: [
      ...new Set(input.tags.map((item) => item.trim().toLocaleLowerCase('ru')).filter(Boolean)),
    ],
  };
}

/**
 * Определяет файл обложки: `cover` — клиентский id нового файла (маппится
 * на сохранённое имя через `newIds`) либо имя существующего файла из `keep`.
 * `null` — обложка не задана. Кидает 400, если обложка указана, но не найдена.
 */
function resolveCover(
  cover: string | null,
  newIds: string[],
  savedNames: string[],
  keep: string[],
): string | null {
  if (!cover) return null;
  const idx = newIds.indexOf(cover);
  if (idx !== -1) return savedNames[idx];
  if (keep.includes(cover)) return cover;
  throw new HttpError(400, 'Основная фотография не найдена среди изображений');
}

/** Список событий (сводки, без контента): `GET /api/diary`. */
export function listDiaryEvents(
  options: { year?: string; tag?: string; query?: string } = {},
): DiaryEventSummary[] {
  const query = options.query?.trim().toLocaleLowerCase('ru');
  return listDiaryEventRows()
    .filter((row) => !options.year || row.date_start.startsWith(options.year))
    .filter(
      (row) =>
        !options.tag ||
        row.tags.some(
          (tag) => tag.toLocaleLowerCase('ru') === options.tag?.toLocaleLowerCase('ru'),
        ),
    )
    .filter(
      (row) =>
        !query ||
        [row.title, row.summary, row.content, row.place, row.participants_json, ...row.tags].some(
          (value) => value.toLocaleLowerCase('ru').includes(query),
        ),
    )
    .map(rowToSummary);
}

/** Полные данные события: `GET /api/diary/:id`. 404 — не найдено. */
export function getDiaryEvent(id: number): DiaryEventDetail {
  const row = getDiaryEventRow(id);
  if (!row) {
    throw new HttpError(404, 'Событие не найдено');
  }
  return { ...rowToSummary(row), content: row.content };
}

/**
 * Создаёт событие (admin): валидация, генерация уникальной папки, сохранение
 * изображений в `images/<folder>/`, вставка записи в БД. Ответ — полное
 * событие (201). При ошибке папка изображений удаляется (откат).
 */
export function createDiaryEvent(input: DiaryEventUpload): DiaryEventDetail {
  const { title, dateStart, dateEnd, summary, place, participants, tags } = normalizeFields(input);
  if (input.newIds.length !== input.files.length) {
    throw new HttpError(400, 'Не совпадает число файлов и метаданных');
  }

  const folder = newEventFolder();
  const savedNames = input.files.map((file) => imageFileName(file.originalName));
  let cover = resolveCover(input.cover, input.newIds, savedNames, []);
  if (!cover && savedNames.length > 0) cover = savedNames[0];
  const content = resolveContentImages(input.content, input.newIds, savedNames, savedNames).content;

  try {
    for (const [index, file] of input.files.entries()) {
      saveEventImage(folder, file.buffer, savedNames[index]);
    }
  } catch {
    cleanupEventImages(folder);
    throw new HttpError(400, 'Не удалось сохранить изображения');
  }

  let row: DiaryEventRow;
  try {
    row = createDiaryEventRow({
      title,
      dateStart,
      dateEnd,
      summary,
      place,
      participants,
      content,
      folder,
      cover,
    });
  } catch (err) {
    cleanupEventImages(folder);
    throw err;
  }
  replaceDiaryEventTags(row.id, tags);
  row = getDiaryEventRow(row.id) as DiaryEventRow;
  return { ...rowToSummary(row), content: row.content };
}

/**
 * Обновляет событие (admin): обновление полей, синхронизация изображений
 * (удаляются не входящие в `keep`, добавляются новые), смена обложки.
 * 404 — событие не найдено.
 */
export function updateDiaryEvent(id: number, input: DiaryEventUpload): DiaryEventDetail {
  const current = getDiaryEventRow(id);
  if (!current) {
    throw new HttpError(404, 'Событие не найдено');
  }
  const { title, dateStart, dateEnd, summary, place, participants, tags } = normalizeFields(input);
  if (input.newIds.length !== input.files.length) {
    throw new HttpError(400, 'Не совпадает число файлов и метаданных');
  }

  const existing = listEventImages(current.folder);
  const existingSet = new Set(existing);
  if (
    new Set(input.keep).size !== input.keep.length ||
    input.keep.some((name) => !existingSet.has(name))
  ) {
    throw new HttpError(400, 'Список сохраняемых фотографий содержит неизвестные файлы');
  }

  const savedNames = input.files.map((file) => imageFileName(file.originalName));
  const finalNames = [...input.keep, ...savedNames];
  const cover = resolveCover(input.cover, input.newIds, savedNames, input.keep);
  const content = resolveContentImages(input.content, input.newIds, savedNames, finalNames).content;
  const keepSet = new Set(input.keep);
  try {
    for (const [index, file] of input.files.entries()) {
      saveEventImage(current.folder, file.buffer, savedNames[index]);
    }
  } catch {
    cleanupNewImages(current.folder, savedNames);
    throw new HttpError(400, 'Не удалось сохранить изображения');
  }

  let row: DiaryEventRow | null;
  try {
    row = updateDiaryEventRow(id, {
      title,
      dateStart,
      dateEnd,
      summary,
      place,
      participants,
      content,
      folder: current.folder,
      cover,
    });
  } catch (err) {
    cleanupNewImages(current.folder, savedNames);
    throw err;
  }
  if (!row) {
    cleanupNewImages(current.folder, savedNames);
    throw new HttpError(404, 'Событие не найдено');
  }
  replaceDiaryEventTags(row.id, tags);
  row = getDiaryEventRow(row.id) as DiaryEventRow;

  for (const name of existing) {
    if (!keepSet.has(name)) {
      try {
        removeEventImage(current.folder, name);
      } catch (err) {
        console.error('Не удалось удалить старое изображение дневника', err);
      }
    }
  }
  return { ...rowToSummary(row), content: row.content };
}

/**
 * Удаляет событие (admin): запись из БД + папку изображений.
 * 404 — событие не найдено.
 */
export function deleteDiaryEvent(id: number): void {
  const row = getDiaryEventRow(id);
  if (!row) {
    throw new HttpError(404, 'Событие не найдено');
  }
  if (!deleteDiaryEventRow(id)) {
    throw new HttpError(404, 'Событие не найдено');
  }
  cleanupEventImages(row.folder);
}
