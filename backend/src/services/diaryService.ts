import {
  createDiaryEventRow,
  deleteDiaryEventRow,
  getDiaryEventRow,
  listDiaryEventRows,
  updateDiaryEventRow,
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

/** Ошибка с HTTP-статусом — для ответов 400/404/409 и т.п. */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** Дата в формате ГГГГ-ММ-ДД. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Проверка корректности даты (`2026-08-15` и т.п.). */
function isValidDate(value: string): boolean {
  return DATE_RE.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
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
  const contentImages = new Set<string>();
  for (const match of row.content.matchAll(DIARY_IMAGE_RE)) contentImages.add(match[2]);
  const images = allImages.filter((name) => !contentImages.has(name));
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
    folder: row.folder,
    cover,
    images,
  };
}

/** Валидация текстовых полей + нормализация дат (общая для create/update). */
function normalizeFields(input: DiaryEventUpload): {
  title: string;
  dateStart: string;
  dateEnd: string | null;
  summary: string;
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
  return { title, dateStart, dateEnd, summary };
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
export function listDiaryEvents(): DiaryEventSummary[] {
  return listDiaryEventRows().map(rowToSummary);
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
  const { title, dateStart, dateEnd, summary } = normalizeFields(input);
  if (input.newIds.length !== input.files.length) {
    throw new HttpError(400, 'Не совпадает число файлов и метаданных');
  }

  const folder = newEventFolder();
  const savedNames: string[] = [];
  try {
    for (const file of input.files) {
      const name = imageFileName(file.originalName);
      saveEventImage(folder, file.buffer, name);
      savedNames.push(name);
    }
  } catch {
    removeEventImages(folder);
    throw new HttpError(400, 'Не удалось сохранить изображения');
  }

  let cover: string | null;
  let content: string;
  try {
    cover = resolveCover(input.cover, input.newIds, savedNames, []);
    if (!cover && savedNames.length > 0) cover = savedNames[0];
    content = resolveContentImages(input.content, input.newIds, savedNames, savedNames).content;
  } catch (err) {
    removeEventImages(folder);
    throw err;
  }

  const row = createDiaryEventRow({
    title,
    dateStart,
    dateEnd,
    summary,
    content,
    folder,
    cover,
  });
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
  const { title, dateStart, dateEnd, summary } = normalizeFields(input);
  if (input.newIds.length !== input.files.length) {
    throw new HttpError(400, 'Не совпадает число файлов и метаданных');
  }

  // Синхронизация изображений: удалить не входящие в `keep`, сохранить новые.
  const existing = listEventImages(current.folder);
  const keepSet = new Set(input.keep);
  for (const name of existing) {
    if (!keepSet.has(name)) removeEventImage(current.folder, name);
  }
  const savedNames: string[] = [];
  for (const file of input.files) {
    const name = imageFileName(file.originalName);
    saveEventImage(current.folder, file.buffer, name);
    savedNames.push(name);
  }

  const cover = resolveCover(input.cover, input.newIds, savedNames, input.keep);
  const finalNames = [...input.keep, ...savedNames];
  const content = resolveContentImages(input.content, input.newIds, savedNames, finalNames).content;

  const row = updateDiaryEventRow(id, {
    title,
    dateStart,
    dateEnd,
    summary,
    content,
    folder: current.folder,
    cover,
  });
  if (!row) {
    throw new HttpError(404, 'Событие не найдено');
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
  deleteDiaryEventRow(id);
  removeEventImages(row.folder);
}
