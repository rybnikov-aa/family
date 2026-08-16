#!/usr/bin/env node
/**
 * Read-only диагностика сервера family: health бэкенда, порт 3000, pm2, nginx -t.
 *
 * Использование (из корня репозитория):
 *   node .github/skills/deploy/scripts/check-server.mjs
 *   node .github/skills/deploy/scripts/check-server.mjs --host test.rybnikov.su --user rybnikov
 *   node .github/skills/deploy/scripts/check-server.mjs --lines 100 --app family-backend
 *   node .github/skills/deploy/scripts/check-server.mjs --batch   # без интерактивного пароля (для агентов)
 *
 * Хост/пользователь/порт/приложение берутся из флагов или DEPLOY_* env
 * (читает корневой .env, как deploy.mjs; реальные env не переопределяются).
 * Скрипт только читает состояние сервера — ничего не меняет и не перезапускает.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Мини-загрузчик .env (как в deploy.mjs): не переопределяет уже заданные env. */
function loadEnvFile() {
  const envFile = join(ROOT, '.env');
  if (!existsSync(envFile)) return;
  for (const rawLine of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvFile();

function parseArgs(argv) {
  const args = { host: null, user: null, port: null, app: null, lines: 50, batch: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--host') args.host = argv[i + 1];
    else if (a === '--user') args.user = argv[i + 1];
    else if (a === '--port') args.port = argv[i + 1];
    else if (a === '--app') args.app = argv[i + 1];
    else if (a === '--lines') args.lines = Number(argv[i + 1]) || 50;
    else if (a === '--batch') args.batch = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const host = args.host ?? process.env.DEPLOY_HOST ?? 'my.rybnikov.su';
const user = args.user ?? process.env.DEPLOY_USER ?? 'root';
const port = args.port ?? process.env.DEPLOY_PORT ?? '22';
const app = args.app ?? process.env.DEPLOY_PM2_APP ?? 'family-backend';
const lines = args.lines;

const target = `${user}@${host}`;
const sshArgs = ['-p', port, '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ConnectTimeout=15'];
if (args.batch) sshArgs.push('-o', 'BatchMode=yes');

const remote = `
set +e
echo "=== Хост: $(hostname) ($(hostname -I 2>/dev/null | tr ' ' '\\n' | head -1)) ==="
echo
echo "=== Health (localhost:3000) ==="
curl -sS -i --max-time 10 http://127.0.0.1:3000/api/health || echo "curl: нет соединения"
echo
echo "=== Порт 3000 ==="
ss -ltnp 2>/dev/null | grep ':3000' || echo "порт 3000 не слушается"
echo
PM2="$HOME/.nvm/versions/node/v24.19.0/bin/pm2"
[ -x "$PM2" ] || PM2=$(command -v pm2)
echo "=== pm2 (${app}) ==="
if [ -n "$PM2" ]; then
  "$PM2" describe "${app}" 2>/dev/null | grep -Ei 'name|status|pid|uptime|restarts' | head -20 || echo "pm2: приложение ${app} не найдено"
else
  echo "pm2 не найден"
fi
echo
echo "=== pm2 logs (последние ${lines}) ==="
if [ -n "$PM2" ]; then
  "$PM2" logs "${app}" --lines ${lines} --nostream 2>/dev/null | tail -${lines} || echo "нет логов"
else
  echo "pm2 не найден"
fi
echo
echo "=== nginx -t (test only) ==="
if command -v sudo >/dev/null 2>&1 && sudo -n true 2>/dev/null; then
  sudo -n nginx -t 2>&1
else
  echo "sudo/nginx -t недоступны в этой сессии"
fi
`.trim();

console.log(`[check-server] ${target}:${port} (app=${app}, lines=${lines})\n`);
try {
  // Скрипт передаётся в `bash -s` через stdin — без проблем с вложенными кавычками.
  execFileSync('ssh', [...sshArgs, target, 'bash -s'], {
    input: remote,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  console.log('\n[check-server] Диагностика завершена.');
} catch {
  console.error(
    '\n[check-server] Ошибка при подключении/выполнении (см. выше). Возможно, нет SSH-ключа — используйте --batch для явного отказа от пароля.',
  );
  process.exitCode = 1;
}
