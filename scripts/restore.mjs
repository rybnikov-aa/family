#!/usr/bin/env node
/**
 * Полное восстановление сайта из бэкапа (архив от scripts/backup.mjs) на целевом сервере,
 * например на новом VPS. Восстанавливает ТОЛЬКО данные приложения:
 *   data/ (5 SQLite-БД), docs/ (PDF «Ремонта»), images/ (фото «Дневника»), .env
 * Справочные server-config (nginx/letsencrypt) из архива НЕ восстанавливаются —
 * провижининг нового хоста (node, nginx, letsencrypt, pm2, python-venv) выполняется
 * по чек-листу в docs/server.md, а код приложения публикуется штатным npm run deploy.
 *
 * Flow:
 *   1. (Для локального архива) scp архива на целевой сервер.
 *   2. На сервере: pm2 stop → текущие data/docs/images/.env убираются в /tmp (страховка) →
 *      распаковка архива → pm2 restart (гарантирован даже при сбое).
 *   3. Health-check напрямую (127.0.0.1:<PORT>/api/health) с ожиданием готовности.
 *
 * Usage:
 *   npm run restore -- <archive.tar.gz>                 # цель — из DEPLOY_HOST / --host
 *   npm run restore -- <archive.tar.gz> --host new.vps.example
 *   npm run restore -- <archive.tar.gz> --no-env        # не восстанавливать .env (рабочий сохраняется)
 *   npm run restore -- --from-server /var/backups/family/family-backup-....tar.gz
 *   npm run restore -- <archive> --dry-run              # только показать план
 *   npm run restore -- <archive> --print-script         # показать remote-скрипт
 *   npm run restore -- <archive> --skip-health          # без health-check
 *
 * Конфигурация — env / корневой .env (шаблон — .env.example). Для цели восстановления
 * используется отдельное пространство имён RESTORE_* (DEPLOY_* из корневого .env описывает
 * основной хост и НЕ применяется к каталогу/имени приложения на цели):
 *   DEPLOY_HOST / --host (ОБЯЗАТЕЛЬНО)
 *   RESTORE_USER (по умолчанию rybnikov), RESTORE_PORT (по умолчанию 22)
 *   RESTORE_BACKEND_DIR (по умолчанию /var/www/<host>/server)
 *   RESTORE_PM2_APP (по умолчанию family-backend), RESTORE_PM2_HOME (по умолчанию /home/rybnikov/.pm2)
 *
 * Требуется OpenSSH (ssh/scp) в PATH. Останавливает бэкенд на несколько секунд.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Минимальный .env-загрузчик (без зависимостей). Существующие env не переопределяются. */
function loadEnvFile() {
  const envFile = join(ROOT, '.env');
  if (!existsSync(envFile)) return;
  for (const rawLine of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const comment = value.search(/[ \t]#/);
      if (comment !== -1) value = value.slice(0, comment).trim();
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile();

/** Парсит флаги вида `--key value`. */
function flagValue(names) {
  for (let i = 0; i < process.argv.length - 1; i += 1) {
    if (names.includes(process.argv[i])) return process.argv[i + 1];
  }
  return null;
}

const hostArg = flagValue(['--host']);
const host = hostArg ?? process.env.DEPLOY_HOST ?? '';
if (!host) {
  console.error(
    '[restore] Не задан целевой хост. Укажите --host <host> или переменную окружения DEPLOY_HOST.',
  );
  process.exit(1);
}

// Источник архива: локальный файл (позиционный аргумент) или путь на сервере.
const fromServer = flagValue(['--from-server']);
const positional = process.argv.find((a, i) => i > 1 && !a.startsWith('-'));
if (!fromServer && !positional) {
  console.error(
    '[restore] Укажите архив: локальный файл (первый аргумент) или --from-server <путь-на-сервере>.',
  );
  process.exit(1);
}

const cfg = {
  host,
  user: process.env.RESTORE_USER ?? process.env.DEPLOY_USER ?? 'rybnikov',
  port: process.env.RESTORE_PORT ?? process.env.DEPLOY_PORT ?? '22',
  // ВАЖНО: DEPLOY_BACKEND_DIR в корневом .env описывает ОСНОВНОЙ хост и не должен
  // по умолчанию применяться к цели восстановления — каталог выводим из --host.
  backendDir: process.env.RESTORE_BACKEND_DIR ?? `/var/www/${host}/server`,
  pm2App: process.env.RESTORE_PM2_APP ?? 'family-backend',
  pm2Home: process.env.RESTORE_PM2_HOME ?? '/home/rybnikov/.pm2',
  localArchive: fromServer ? null : resolve(positional),
  serverArchive: fromServer ?? '/tmp/family-restore.tar.gz',
  dryRun: process.argv.includes('--dry-run'),
  printScript: process.argv.includes('--print-script'),
  skipHealth: process.argv.includes('--skip-health'),
  noEnv: process.argv.includes('--no-env'),
};

const target = `${cfg.user}@${cfg.host}`;
const sshBase = [
  '-p',
  cfg.port,
  '-o',
  'StrictHostKeyChecking=accept-new',
  '-o',
  'ConnectTimeout=20',
  target,
];
const scpBase = [
  '-P',
  cfg.port,
  '-o',
  'StrictHostKeyChecking=accept-new',
  '-o',
  'ConnectTimeout=20',
];

const REMOTE_SCRIPT_PATH = '/tmp/family-restore.sh';

function log(msg) {
  console.log(`\n[restore] ${msg}`);
}

/** Remote-скрипт: стоп → страховка → распаковка → рестарт. Все пути подставляются на этапе генерации. */
function buildRestoreScript() {
  return `
set -e
STAMP="$(date +%Y%m%d-%H%M%S)"
PREV="/tmp/family-restore-prev-\${STAMP}"
export PM2_HOME="${cfg.pm2Home}"

# --- Обеспечить доступность node/npm/pm2 (минимальный PATH) ---
if ! command -v pm2 >/dev/null 2>&1; then
  for f in "$HOME/.profile" "$HOME/.bash_profile" "$HOME/.bashrc" "$HOME/.nvm/nvm.sh"; do
    if [ -f "$f" ]; then . "$f" >/dev/null 2>&1 || true; fi
  done
fi
if ! command -v pm2 >/dev/null 2>&1; then
  for d in "$HOME/.nvm/versions/node"/*/bin /usr/local/bin /usr/bin /opt/node*/bin "$HOME/node"*/bin "$HOME/.local/bin"; do
    if [ -x "$d/pm2" ]; then
      export PATH="$d:\${PATH}"
      break
    fi
  done
fi
if ! command -v pm2 >/dev/null 2>&1; then
  echo "[restore] ERROR: pm2 not found on the server"
  exit 1
fi

mkdir -p "$PREV"
pm2 stop "${cfg.pm2App}" >/dev/null 2>&1 || true
trap 'pm2 restart "${cfg.pm2App}" >/dev/null 2>&1 || true' EXIT

# Страховка: текущие runtime-данные убираем в /tmp (не удаляем)
for d in data docs images; do
  if [ -d "${cfg.backendDir}/\$d" ]; then mv "${cfg.backendDir}/\$d" "$PREV/\$d"; fi
done
# Текущий .env сохраняем ВСЕГДА (до распаковки, т.к. tar может его перезаписать архивным)
if [ -f "${cfg.backendDir}/.env" ]; then mv "${cfg.backendDir}/.env" "$PREV/.env"; fi

# Распаковка архива в каталог бэкенда
mkdir -p "${cfg.backendDir}"
tar -xzf "${cfg.serverArchive}" -C "${cfg.backendDir}"

# server-config и MANIFEST — справочные (см. backup.mjs), не должны лежать в каталоге приложения
if [ -e "${cfg.backendDir}/server-config" ]; then mv "${cfg.backendDir}/server-config" "$PREV/server-config"; fi
if [ -e "${cfg.backendDir}/MANIFEST.txt" ]; then mv "${cfg.backendDir}/MANIFEST.txt" "$PREV/MANIFEST.txt"; fi
# Решение по .env:
#   обычный режим — .env из бэкапа остаётся в server/ (прежний — в PREV/.env);
#   --no-env       — .env из бэкапа убираем, возвращаем сохранённый рабочий.
if [ "${cfg.noEnv ? '1' : '0'}" = "1" ]; then
  if [ -e "${cfg.backendDir}/.env" ]; then mv "${cfg.backendDir}/.env" "$PREV/env-from-backup"; fi
  if [ -f "$PREV/.env" ]; then mv "$PREV/.env" "${cfg.backendDir}/.env"; fi
fi

pm2 restart "${cfg.pm2App}" >/dev/null 2>&1
pm2 save >/dev/null 2>&1 || true
trap - EXIT

echo "[restore] OK"
echo "[restore] PREV=\${PREV}"
`.trim();
}

/** Health-check напрямую через ssh (ожидание готовности до ~30 c, переносимый while). */
function healthCheck() {
  // tr -d '\r': .env может быть в CRLF (Windows) — без этого cut отдаст значение с \r и curl упадёт.
  const portLine = `grep -E '^PORT=' ${cfg.backendDir}/.env 2>/dev/null | tail -n1 | cut -d= -f2 | tr -d '\\r'`;
  const command = [
    `PORT="\$( ${portLine} )"`,
    'PORT="${PORT:-3000}"',
    'code=000',
    'i=0',
    'while [ "$i" -lt 30 ]; do',
    '  i=$((i+1))',
    '  code="$(curl -s -o /dev/null -w \'%{http_code}\' "http://127.0.0.1:${PORT}/api/health" 2>/dev/null || true)"',
    '  [ "$code" = "200" ] && break',
    '  sleep 1',
    'done',
    'echo "[restore] direct health (127.0.0.1:${PORT}) = ${code}"',
  ].join('\n');
  const output = execFileSync('ssh', [...sshBase, command], { encoding: 'utf8' }).trim();
  process.stdout.write(`${output}\n`);
  const m = output.match(/= (\d+)$/);
  const code = m ? m[1] : '???';
  if (code !== '200') {
    log(
      `ВНИМАНИЕ: health-check вернул ${code}. Проверьте: NODE_ENV=production, .env (PORT/CORS), nginx.`,
    );
  } else {
    log('Health-check пройден (200) ✔');
  }
}

function main() {
  if (cfg.printScript) {
    console.log(buildRestoreScript());
    return;
  }

  log('План восстановления:');
  log(`  целевой сервер : ${target}:${cfg.port}`);
  log(`  каталог бэкенда: ${cfg.backendDir}`);
  log(`  pm2 приложение : ${cfg.pm2App}`);
  if (cfg.localArchive) {
    log(`  архив          : ${cfg.localArchive} (локальный, будет загружен)`);
  } else {
    log(`  архив          : ${cfg.serverArchive} (на сервере)`);
  }
  log(
    `  .env           : ${cfg.noEnv ? 'НЕ восстанавливается (--no-env)' : 'восстанавливается из бэкапа'}`,
  );

  if (cfg.dryRun) {
    log('Сухой прогон (--dry-run): сетевых действий не выполняется.');
    return;
  }

  if (cfg.localArchive) {
    if (!existsSync(cfg.localArchive)) {
      console.error(`[restore] Локальный архив не найден: ${cfg.localArchive}`);
      process.exit(1);
    }
    log('Загрузка архива на сервер...');
    execFileSync('scp', [...scpBase, cfg.localArchive, `${target}:${cfg.serverArchive}`], {
      stdio: 'inherit',
    });
  }

  const staging = join(tmpdir(), `family-restore-${process.pid}.sh`);
  writeFileSync(staging, buildRestoreScript(), 'utf8');
  log('Загрузка remote-скрипта...');
  execFileSync('scp', [...scpBase, staging, `${target}:${REMOTE_SCRIPT_PATH}`], {
    stdio: 'inherit',
  });

  log('Восстановление на сервере (бэкенд будет остановлен на несколько секунд)...');
  let output;
  try {
    output = execFileSync('ssh', [...sshBase, `bash ${REMOTE_SCRIPT_PATH}`], {
      encoding: 'utf8',
    });
  } catch (err) {
    console.error(err.stdout || '');
    console.error('\n[restore] Сбой на сервере (бэкенд должен был перезапуститься автоматически).');
    process.exit(1);
  }
  process.stdout.write(output);

  if (!cfg.skipHealth) healthCheck();

  log('Восстановление данных завершено.');
  log('Далее:');
  log('  1. Проверьте server/.env на целевом хосте (PORT, CORS_ORIGIN, RENOVATION_* пути venv).');
  log(
    '  2. Опубликуйте код: npm run deploy (с DEPLOY_HOST/... на целевой хост) — код и node_modules.',
  );
  log(
    '  3. Провижининг нового VPS (nginx, letsencrypt, pm2, python-venv) — чек-лист в docs/server.md.',
  );
}

main();
