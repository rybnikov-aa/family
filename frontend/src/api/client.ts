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

/**
 * Скачивает файл по серверному пути (для встроенного просмотра PDF).
 * Для путей `/api/*` идёт через `apiFetch` (та же обработка 401 → вход);
 * прочие пути (например статичный архив `/projects/...`) — обычным fetch.
 */
export async function fetchFileBytes(path: string): Promise<ArrayBuffer> {
  if (path.startsWith('/api/')) {
    const res = await apiFetch(path.slice('/api'.length));
    if (!res.ok) {
      throw new Error(await errorMessage(res, `Ошибка загрузки файла (${res.status})`));
    }
    return res.arrayBuffer();
  }
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Ошибка загрузки файла (${res.status})`);
  return res.arrayBuffer();
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

// ── Админ-панель: управление пользователями ──────────────────────────────────

/** Пользователь в админ-панели (включая дату создания). */
export interface AdminUser {
  id: number;
  username: string;
  name: string;
  role: 'admin' | 'user';
  createdAt: string;
}

/** Входные данные для создания пользователя (админка). */
export interface AdminUserInput {
  username: string;
  name: string;
  role: 'admin' | 'user';
  password: string;
}

/** Список пользователей: `GET /api/auth/admin/users`. */
export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const res = await apiFetch('/auth/admin/users');
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  const data = (await res.json()) as { users: AdminUser[] };
  return data.users;
}

/** Создаёт пользователя: `POST /api/auth/admin/users`. Возвращает созданного (201). */
export async function createAdminUser(input: AdminUserInput): Promise<{ user: AuthUser }> {
  const res = await apiFetch('/auth/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<{ user: AuthUser }>;
}

/** Принудительно задаёт пароль пользователю: `PATCH /api/auth/admin/users/:id/password`. */
export async function setAdminUserPassword(id: number, password: string): Promise<void> {
  const res = await apiFetch(`/auth/admin/users/${id}/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
}

/** Удаляет пользователя: `DELETE /api/auth/admin/users/:id`. */
export async function deleteAdminUser(id: number): Promise<void> {
  const res = await apiFetch(`/auth/admin/users/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
}

/**
 * Метаданные проекта (раздел «Проекты»).
 * Проект — запись в БД (`projects`, созданные через UI) либо встроенный проект
 * из реестра бэкенда (`config/appProjects.ts`, например «Ремонт»). Все проекты —
 * прикладные (`kind: 'app'`), их страницы — маршруты приложения.
 */
export interface Project {
  slug: string;
  title: string;
  description: string;
  accent: string;
  /** Имя иконки (например, `renovation`); пусто — иконка по умолчанию. */
  icon: string;
  kind: 'app';
  /** Внутренний маршрут приложения без `#` (hash-роутинг), например `/projects/renovation`. */
  url: string;
  order: number;
  /** Встроенные проекты (реестр) редактировать/удалять нельзя. */
  editable: boolean;
}

/** Полные данные проекта: метаданные + markdown-контент. */
export interface ProjectDetail extends Project {
  /** Markdown-контент страницы проекта (пусто у встроенных проектов). */
  content: string;
}

/** Список проектов: `GET /api/projects`. Кэша сканирования больше нет, `force` игнорируется. */
export async function fetchProjects(force = false): Promise<Project[]> {
  const res = await apiFetch(`/projects${force ? '?refresh=1' : ''}`);
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<Project[]>;
}

/** Полные данные проекта: `GET /api/projects/:slug` (включая markdown-контент). */
export async function fetchProject(slug: string): Promise<ProjectDetail> {
  const res = await apiFetch(`/projects/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<ProjectDetail>;
}

/** Входные данные для создания/обновления проекта. */
export interface ProjectInput {
  /** Имя (slug): латиница, цифры и дефисы (например `dacha`). */
  slug: string;
  /** Название для карточки и страницы проекта. */
  title: string;
  /** Описание для карточки. */
  description: string;
  /** Акцентный цвет карточки (`#RRGGBB`), по умолчанию `#3b82f6`. */
  accent?: string;
  /** Имя иконки: `renovation` | `folder` | `projects`, по умолчанию `projects`. */
  icon?: string;
  /** Порядок в списке (целое ≥ 0); не задано — в конец. */
  order?: number;
  /** Markdown-контент страницы проекта (необязательно). */
  content?: string;
}

/**
 * Создаёт проект: `POST /api/projects` (admin). Бэкенд записывает проект в БД
 * `projects` (без статичных папок и шаблонов). Ответ — метаданные (201);
 * 400 — невалидные данные, 409 — имя занято.
 */
export async function createProject(input: ProjectInput): Promise<Project> {
  const res = await apiFetch('/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<Project>;
}

/**
 * Обновляет проект: `PATCH /api/projects/:slug` (admin) — метаданные и/или
 * markdown-контент. 400 — встроенный проект, 404 — не найден.
 */
export async function updateProject(slug: string, input: ProjectInput): Promise<ProjectDetail> {
  const res = await apiFetch(`/projects/${encodeURIComponent(slug)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<ProjectDetail>;
}

/** Удаляет проект: `DELETE /api/projects/:slug` (admin). 400 — встроенный, 404 — не найден. */
export async function deleteProject(slug: string): Promise<void> {
  const res = await apiFetch(`/projects/${encodeURIComponent(slug)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
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

// ── Ремонт (renovation) ──────────────────────────────────────────────────────

/** Настройка и действующий бюджет на материалы (для «Блока 2»). */
export interface MaterialsBudget {
  /** Режим: `percent` (от сметы на работы) или `amount` (явная сумма). */
  mode: 'percent' | 'amount';
  /** % от сметы (для `mode='percent'`); по умолчанию 100. */
  percent: number | null;
  /** Явная сумма, копейки (для `mode='amount'`). */
  amount: number | null;
  /** Действующий бюджет, копейки (percent% сметы или amount). */
  value: number | null;
}

/**
 * Сводка проекта «Ремонт» (Блок 1 Работы / Блок 2 Материалы) из отдельной БД
 * `renovation.sqlite`. Все суммы — копейки (×100); форматирование — `utils/money.ts`.
 */
export interface RenovationOverview {
  meta: {
    object: string;
    contractNo: string | null;
    contractDate: string | null;
    contractor: string | null;
    startDate: string | null;
    deadlineDays: number | null;
    area: string | null;
  } | null;
  estimate: {
    id: number;
    total: number | null;
    totalNoOverhead: number | null;
    overhead: number | null;
    itemsCount: number;
  } | null;
  works: {
    planTotal: number | null;
    factTotal: number | null;
    /** Освоение бюджета, % (один знак). */
    percent: number | null;
    acts: {
      id: number;
      number: string | null;
      date: string;
      title: string;
      totalWithOverhead: number | null;
      /** URL исходного PDF (просмотр в приложении). */
      pdfPath: string | null;
    }[];
  };
  materials: {
    ordersTotal: number | null;
    orders: {
      id: number;
      number: string | null;
      date: string;
      title: string;
      total: number | null;
      /** URL исходного PDF (просмотр в приложении). */
      pdfPath: string | null;
    }[];
  };
  settlements: {
    works: {
      date: string;
      paidIn: number | null;
      used: number | null;
      balance: number | null;
      /** URL исходного PDF ведомости (просмотр в приложении). */
      pdfPath: string | null;
      /** Сумма «подотчётные прораба» в ведомости, копейки; null — нет. */
      foremenAmount: number | null;
    } | null;
    materials: {
      date: string;
      paidIn: number | null;
      used: number | null;
      balance: number | null;
      /** URL исходного PDF ведомости (просмотр в приложении). */
      pdfPath: string | null;
      /** Сумма «подотчётные прораба» в ведомости, копейки; null — нет. */
      foremenAmount: number | null;
    } | null;
  };
  /** Настройка и действующий бюджет на материалы («Блок 2»). */
  materialsBudget: MaterialsBudget;
}

/** Сводка «Ремонта»: `GET /api/renovation`. */
export async function fetchRenovationOverview(): Promise<RenovationOverview> {
  const res = await apiFetch('/renovation');
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<RenovationOverview>;
}

/**
 * Обновить бюджет на материалы (admin): `PUT /api/renovation/materials-budget`.
 * В режиме `percent` бюджет = % от сметы на работы (пересчитывается при её
 * изменении); в режиме `amount` — явная сумма в копейках.
 */
export async function updateMaterialsBudget(input: {
  mode: 'percent' | 'amount';
  percent?: number | null;
  amount?: number | null;
}): Promise<{ budget: MaterialsBudget }> {
  const res = await apiFetch('/renovation/materials-budget', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<{ budget: MaterialsBudget }>;
}

/** Черновик импорта PDF (этап 3) — результат `POST /api/renovation/pdf`. */
export interface RenovationDraftSummary {
  id: string;
  fileName: string;
  type: 'work_act' | 'material_order' | 'settlement' | 'addendum' | null;
  subtype: 'works' | 'materials' | null;
  date: string | null;
  number: string | null;
  label: string;
  itemsCount: number;
  settlementsCount: number;
  /** Итог (копейки) либо null. */
  total: number | null;
  /** Требует ручной проверки (автоматический разбор неполный). */
  needsReview: boolean;
  warnings: string[];
}

/** Загружает PDF и возвращает черновик импорта: `POST /api/renovation/pdf` (admin). */
export async function uploadRenovationPdf(file: File): Promise<{ draft: RenovationDraftSummary }> {
  const form = new FormData();
  form.append('name', file.name);
  form.append('file', file);
  const res = await apiFetch('/renovation/pdf', { method: 'POST', body: form });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<{ draft: RenovationDraftSummary }>;
}

/** Подтверждает импорт черновика: `POST /api/renovation/pdf/:id/confirm` (admin). */
export async function confirmRenovationPdf(
  draftId: string,
): Promise<{ id: number; type: string; date: string }> {
  const res = await apiFetch(`/renovation/pdf/${encodeURIComponent(draftId)}/confirm`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<{ id: number; type: string; date: string }>;
}

// ── Доп. соглашения к смете (этап 4) ─────────────────────────────────────────

/** Версия сметы (seed / current / history / addendum). */
export interface RenovationEstimateVersion {
  id: number;
  kind: 'seed' | 'current' | 'history' | 'addendum';
  date: string | null;
  label: string;
  total: number | null;
  totalNoOverhead: number | null;
  overhead: number | null;
  addendumRef: string | null;
  sourcePath: string | null;
  pdfPath: string | null;
}

/** Список версий сметы: `GET /api/renovation/estimate/versions`. */
export async function fetchRenovationEstimateVersions(): Promise<{
  versions: RenovationEstimateVersion[];
}> {
  const res = await apiFetch('/renovation/estimate/versions');
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<{ versions: RenovationEstimateVersion[] }>;
}

/** Строка диффа применения доп. соглашения. */
export interface RenovationAddendumDiff {
  key: string;
  kind: 'update' | 'new' | 'keep' | 'remove';
  section: string;
  name: string;
  unit: string | null;
  price: number | null;
  qty: number | null;
  sum: number | null;
  oldPrice: number | null;
  oldQty: number | null;
  oldSum: number | null;
}

/** Предложение применения доп. соглашения (дифф + новый итог). */
export interface RenovationAddendumProposal {
  addendum: { id: number; date: string | null; label: string; total: number | null };
  current: { id: number; total: number | null };
  diffs: RenovationAddendumDiff[];
  newTotalNoOverhead: number | null;
  newOverhead: number | null;
  newTotal: number | null;
  needsReview: boolean;
  warnings: string[];
}

/** Предложение применения доп. соглашения: `POST /api/renovation/estimate/addendum` (admin). */
export async function fetchRenovationAddendumProposal(addendumId: number): Promise<{
  proposal: RenovationAddendumProposal;
}> {
  const res = await apiFetch('/renovation/estimate/addendum', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addendumId }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<{ proposal: RenovationAddendumProposal }>;
}

/**
 * Подтверждает применение доп. соглашения:
 * `POST /api/renovation/estimate/addendum/confirm` (admin).
 * `removeKeys` — нормализованные имена позиций на удаление.
 */
export async function confirmRenovationAddendum(
  addendumId: number,
  removeKeys: string[],
): Promise<{
  currentId: number;
  total: number | null;
  totalNoOverhead: number | null;
  overhead: number | null;
  itemsCount: number;
}> {
  const res = await apiFetch('/renovation/estimate/addendum/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addendumId, removeKeys }),
  });
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<{
    currentId: number;
    total: number | null;
    totalNoOverhead: number | null;
    overhead: number | null;
    itemsCount: number;
  }>;
}

// ── Отчёты (этап 5) ─────────────────────────────────────────────────────────

export type WorkRowStatus = 'done' | 'partial' | 'notdone';

export interface ReportWorkRow {
  position: number | null;
  section: string;
  name: string;
  unit: string | null;
  change: string;
  planPrice: number | null;
  planQty: number | null;
  planSum: number | null;
  factQty: number | null;
  factSum: number | null;
  diff: number | null;
  status: WorkRowStatus;
}

export interface RenovationWorkReport {
  asOf: string | null;
  meta: {
    object: string;
    area: string | null;
    startDate: string | null;
    deadlineDays: number | null;
  };
  sections: { title: string; rows: ReportWorkRow[] }[];
  totals: {
    planSum: number;
    factSum: number;
    percent: number | null;
    done: number;
    partial: number;
    notdone: number;
  };
  settlements: {
    works: {
      date: string;
      paidIn: number | null;
      used: number | null;
      balance: number | null;
    } | null;
  };
}

/** «Ход работ»: `GET /api/renovation/reports/work`. */
export async function fetchRenovationWorkReport(): Promise<{ work: RenovationWorkReport }> {
  const res = await apiFetch('/renovation/reports/work');
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<{ work: RenovationWorkReport }>;
}

export interface RenovationMaterialsReport {
  orders: {
    id: number;
    number: string | null;
    date: string;
    title: string;
    total: number | null;
    overhead: number | null;
    /** URL исходного PDF (просмотр в приложении). */
    pdfPath: string | null;
    items: {
      position: number | null;
      name: string;
      unit: string | null;
      price: number | null;
      qty: number | null;
      sum: number | null;
    }[];
  }[];
  totals: { count: number; ordersSum: number; overheadSum: number };
}

/** «Материалы»: `GET /api/renovation/reports/materials`. */
export async function fetchRenovationMaterialsReport(): Promise<{
  materials: RenovationMaterialsReport;
}> {
  const res = await apiFetch('/renovation/reports/materials');
  if (!res.ok) throw new Error(await errorMessage(res, `Request failed with status ${res.status}`));
  return res.json() as Promise<{ materials: RenovationMaterialsReport }>;
}
