const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

/**
 * Обёртка над fetch: базовый путь `/api` и единая обработка 401.
 * При 401 (истекла/потеряна сессия) рассылает событие `auth:unauthorized`,
 * на которое AuthProvider сбрасывает пользователя и показывает экран входа.
 */
async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (res.status === 401) {
    window.dispatchEvent(new Event('auth:unauthorized'));
  }
  return res;
}

/** Извлекает сообщение об ошибке из ответа API (или запасной текст). */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string };
    if (data.message) return data.message;
  } catch {
    /* не JSON — используем запасной текст */
  }
  return fallback;
}

export interface HealthResponse {
  status: string;
  uptime: number;
  timestamp: string;
  environment: string;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await apiFetch('/health');
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<HealthResponse>;
}

// ── Авторизация ──────────────────────────────────────────────────────────────

/** Пользователь, возвращаемый бэкендом. */
export interface AuthUser {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'user';
}

/**
 * Вход: `POST /api/auth/login`. При успехе сервер ставит httpOnly-cookie.
 * 401 здесь — просто неверные учётные данные (не «потерянная сессия»),
 * поэтому событие auth:unauthorized не рассылается.
 */
export async function login(username: string, password: string): Promise<{ user: AuthUser }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<{ user: AuthUser }>;
}

/** Выход: `POST /api/auth/logout` (удаляет сессию на сервере). */
export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}

/** Текущий пользователь: `GET /api/auth/me`. 401 → событие auth:unauthorized. */
export async function fetchMe(): Promise<{ user: AuthUser }> {
  const res = await apiFetch('/auth/me');
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<{ user: AuthUser }>;
}

/** Входные данные для обновления профиля (имя и/или пароль). */
export interface ProfileUpdateInput {
  /** Новое отображаемое имя (если меняем имя). */
  name?: string;
  /** Текущий пароль — обязателен при смене пароля. */
  currentPassword?: string;
  /** Новый пароль (не короче 6 символов), если задаём/меняем пароль. */
  password?: string;
}

/** Обновляет профиль текущего пользователя: `PATCH /api/auth/profile`. */
export async function updateProfile(input: ProfileUpdateInput): Promise<{ user: AuthUser }> {
  const res = await apiFetch('/auth/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<{ user: AuthUser }>;
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
  const res = await apiFetch('/projects');
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<Project[]>;
}

/**
 * Список папок на сервере внутри каталога проектов: `GET /api/projects/dirs`.
 * Возвращает относительные пути (например `renovation/pdf/00 Дизайн-проект`) —
 * для выбора папки загрузки PDF.
 */
export async function fetchProjectDirs(): Promise<string[]> {
  const res = await apiFetch('/projects/dirs');
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
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

  const res = await apiFetch('/projects/upload', { method: 'POST', body: form });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
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
  const res = await apiFetch(`/vps${force ? '?refresh=1' : ''}`);
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
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
  const res = await apiFetch('/vps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
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
  const res = await apiFetch('/vps/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<VpsImportResult>;
}

/** Удаляет VPS по имени: `DELETE /api/vps/:name`. */
export async function deleteVps(name: string): Promise<void> {
  const res = await apiFetch(`/vps/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
}
