import {
  createDiaryAlbumRow,
  deleteDiaryAlbumRow,
  getDiaryAlbumRow,
  getDiaryEventRow,
  listDiaryAlbumRows,
  replaceDiaryAlbumEvents,
  updateDiaryAlbumRow,
  type DiaryAlbumRow,
} from '../db/diaryRepository';

export class DiaryAlbumError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'DiaryAlbumError';
    this.status = status;
  }
}

export interface DiaryAlbum {
  id: number;
  title: string;
  description: string;
  eventIds: number[];
  createdAt: string;
  updatedAt: string;
}

export interface DiaryAlbumInput {
  title?: string;
  description?: string;
  eventIds?: number[];
}

function toPublic(row: DiaryAlbumRow): DiaryAlbum {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventIds: row.event_ids,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalize(input: DiaryAlbumInput): {
  title: string;
  description: string;
  eventIds: number[];
} {
  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) throw new DiaryAlbumError(400, 'Укажите название альбома');
  const eventIds = [...new Set(input.eventIds ?? [])];
  if (!eventIds.every((id) => Number.isInteger(id) && id > 0)) {
    throw new DiaryAlbumError(400, 'Некорректный список событий альбома');
  }
  for (const eventId of eventIds) {
    if (!getDiaryEventRow(eventId)) throw new DiaryAlbumError(400, 'Событие альбома не найдено');
  }
  return {
    title,
    description: typeof input.description === 'string' ? input.description.trim() : '',
    eventIds,
  };
}

export function listDiaryAlbums(): DiaryAlbum[] {
  return listDiaryAlbumRows().map(toPublic);
}

export function createDiaryAlbum(input: DiaryAlbumInput): DiaryAlbum {
  const normalized = normalize(input);
  try {
    const row = createDiaryAlbumRow(normalized.title, normalized.description);
    replaceDiaryAlbumEvents(row.id, normalized.eventIds);
    return toPublic(getDiaryAlbumRow(row.id) as DiaryAlbumRow);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new DiaryAlbumError(409, 'Альбом с таким названием уже существует');
    }
    throw error;
  }
}

export function updateDiaryAlbum(id: number, input: DiaryAlbumInput): DiaryAlbum {
  const normalized = normalize(input);
  try {
    const row = updateDiaryAlbumRow(id, normalized.title, normalized.description);
    if (!row) throw new DiaryAlbumError(404, 'Альбом не найден');
    replaceDiaryAlbumEvents(id, normalized.eventIds);
    return toPublic(getDiaryAlbumRow(id) as DiaryAlbumRow);
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
      throw new DiaryAlbumError(409, 'Альбом с таким названием уже существует');
    }
    throw error;
  }
}

export function deleteDiaryAlbum(id: number): void {
  if (!deleteDiaryAlbumRow(id)) throw new DiaryAlbumError(404, 'Альбом не найден');
}
