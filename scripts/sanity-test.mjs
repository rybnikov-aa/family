#!/usr/bin/env node

const baseUrl = (process.env.SANITY_BASE_URL ?? 'https://test.rybnikov.su').replace(/\/$/, '');
const username = process.env.SANITY_USERNAME ?? process.env.PIPELINE_TEST_USERNAME;
const password = process.env.SANITY_PASSWORD ?? process.env.PIPELINE_TEST_PASSWORD;

if (!username || !password) {
  console.error('[sanity] Укажите SANITY_USERNAME и SANITY_PASSWORD.');
  process.exit(2);
}

async function fetchWithRetry(url, options) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw lastError;
}

async function request(path, options = {}) {
  const response = await fetchWithRetry(`${baseUrl}${path}`, options);
  const text = await response.text();
  let body = text;
  try {
    body = JSON.parse(text);
  } catch {
    // Текст ответа сохраняется для сообщения об ошибке.
  }
  return { response, body };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log(`[sanity] Проверка ${baseUrl}`);

  const health = await request('/api/health');
  assert(health.response.ok, `health: HTTP ${health.response.status}`);
  assert(health.body?.status === 'ok', 'health: status не ok');
  assert(health.body?.environment === 'production', 'health: сервер не в production');

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert(login.response.ok, `login: HTTP ${login.response.status}`);
  assert(login.body?.user?.username === username, 'login: пользователь не совпадает');

  const cookie = login.response.headers.get('set-cookie');
  assert(cookie, 'login: cookie сессии не выдана');

  const protectedChecks = [
    ['/api/auth/me', (body) => body?.user?.username === username],
    ['/api/projects', Array.isArray],
    ['/api/vps', Array.isArray],
    ['/api/renovation', (body) => body && typeof body === 'object'],
    ['/api/diary', Array.isArray],
  ];

  for (const [path, predicate] of protectedChecks) {
    const result = await request(path, { headers: { cookie } });
    assert(result.response.ok, `${path}: HTTP ${result.response.status}`);
    assert(predicate(result.body), `${path}: неожиданный формат ответа`);
  }

  console.log(`[sanity] Успешно: ${protectedChecks.length + 2} проверок`);
}

try {
  await main();
} catch (error) {
  console.error(`[sanity] ОШИБКА: ${error.message ?? error}`);
  process.exitCode = 1;
}
