const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

export interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
  environment: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  return res.json() as Promise<HealthResponse>;
}

/**
 * Метаданные проекта (раздел «Проекты»).
 * Проект — подпапка на сервере с `index.html`; метаданные бэкенд читает
 * из самого `index.html` (`<title>`, `<meta name="description">` и т.п.).
 */
export interface Project {
  slug: string;
  title: string;
  description: string;
  accent: string;
  /** Имя иконки (например, `renovation`); пусто — иконка по умолчанию. */
  icon: string;
  url: string;
}

/** Список проектов: `GET /api/projects`. */
export async function fetchProjects(): Promise<Project[]> {
  const res = await fetch(`${API_BASE}/projects`);
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  return res.json() as Promise<Project[]>;
}

/**
 * Список папок на сервере внутри каталога проектов: `GET /api/projects/dirs`.
 * Возвращает относительные пути (например `renovation/pdf/00 Дизайн-проект`) —
 * для выбора папки загрузки PDF.
 */
export async function fetchProjectDirs(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/projects/dirs`);
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  const data = (await res.json()) as { dirs: string[] };
  return data.dirs;
}

/** Результат загрузки PDF на сервер. */
export interface PdfUploadResult {
  /** URL загруженного файла (например `/projects/renovation/pdf/…/файл.pdf`). */
  url: string;
}

/**
 * Загружает PDF на сервер в указанную папку: `POST /api/projects/upload` (multipart).
 * Поля формы: `folder` (относительный путь внутри каталога проектов),
 * `name` (имя файла, UTF-8) и `file` (PDF).
 */
export async function uploadProjectPdf(folder: string, file: File): Promise<PdfUploadResult> {
  const form = new FormData();
  form.append('folder', folder);
  form.append('name', file.name);
  form.append('file', file);

  const res = await fetch(`${API_BASE}/projects/upload`, { method: 'POST', body: form });
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const d = (await res.json()) as { message?: string };
      if (d.message) message = d.message;
    } catch {
      /* не JSON — оставляем сообщение по умолчанию */
    }
    throw new Error(message);
  }
  return res.json() as Promise<PdfUploadResult>;
}

export interface VpsServiceStatus {
  name: string;
  type: string;
  address: string;
  online: boolean;
  latencyMs: number | null;
  error: string | null;
}

export interface VpsStatus {
  country: string;
  name: string;
  ip: string;
  panel: string;
  services: VpsServiceStatus[];
  online: boolean;
  latencyMs: number | null;
  error: string | null;
  checkedAt: string;
}

export async function fetchVps(force = false): Promise<VpsStatus[]> {
  const res = await fetch(`${API_BASE}/vps${force ? '?refresh=1' : ''}`);
  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }
  return res.json() as Promise<VpsStatus[]>;
}

/** Конфигурация сервиса внутри VPS (для создания). */
export interface VpsServiceConfig {
  name: string;
  type: string;
  address: string;
}

/** Входные данные для создания VPS на мониторинге. */
export interface VpsEntryInput {
  country: string;
  name: string;
  ip: string;
  panel: string;
  services: VpsServiceConfig[];
}

/** Добавляет VPS на мониторинг: `POST /api/vps`. Возвращает созданную запись. */
export async function createVps(entry: VpsEntryInput): Promise<VpsEntryInput> {
  const res = await fetch(`${API_BASE}/vps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const data = (await res.json()) as { message?: string };
      if (data.message) message = data.message;
    } catch {
      /* не JSON — оставляем сообщение по умолчанию */
    }
    throw new Error(message);
  }
  return res.json() as Promise<VpsEntryInput>;
}

/** Результат импорта VPS из JSON-файла. */
export interface VpsImportResult {
  /** Сколько записей добавлено */
  imported: number;
  /** Сколько записей пропущено (невалидные/дубликаты) */
  skipped: number;
  /** Пояснения к пропущенным записям */
  errors: string[];
}

/** Импортирует VPS из JSON: `POST /api/vps/import` (структура как в vps.json). */
export async function importVps(data: { vps: VpsEntryInput[] }): Promise<VpsImportResult> {
  const res = await fetch(`${API_BASE}/vps/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const d = (await res.json()) as { message?: string };
      if (d.message) message = d.message;
    } catch {
      /* не JSON — оставляем сообщение по умолчанию */
    }
    throw new Error(message);
  }
  return res.json() as Promise<VpsImportResult>;
}

/** Удаляет VPS по имени: `DELETE /api/vps/:name`. */
export async function deleteVps(name: string): Promise<void> {
  const res = await fetch(`${API_BASE}/vps/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const d = (await res.json()) as { message?: string };
      if (d.message) message = d.message;
    } catch {
      /* не JSON — оставляем сообщение по умолчанию */
    }
    throw new Error(message);
  }
}
