#!/usr/bin/env node
/**
 * Полный бэкап основного сервера (my.rybnikov.su) — runtime-данные приложения
 * + справочные конфиги сервера (nginx/letsencrypt), не восстанавливаемые автоматически.
 *
 * Flow (по умолчанию):
 *   1. На сервере: остановка бэкенда (pm2 stop) для согласованного снапшота SQLite (WAL).
 *   2. Сборка tar.gz на сервере (в <BACKUP_SERVER_DIR>):
 *        - data/                — 5 SQLite-БД (+ -wal/-shm)
 *        - docs/renovation/     — загруженные PDF «Ремонта»
 *        - images/              — фото событий «Дневника»
 *        - .env                 — рантайм-конфиг бэкенда
 *        - server-config/       — nginx-vhost'ы + letsencrypt (справочно, НЕ восстанавливаются)
 *        - MANIFEST.txt         — метаданные и список содержимого
 *   3. Перезапуск бэкенда (pm2 restart) — гарантирован даже при сбое (trap).
 *   4. Ротация на сервере: сохраняются последние <BACKUP_KEEP> архивов.
 *   5. (Кроме --remote-only) скачивание архива в локальную папку + проверка sha256.
 *
 * Usage:
 *   npm run backup                       # архив на сервере + скачивание в backups/
 *   npm run backup -- --local <dir>      # скачивание в конкретную локальную папку
 *   npm run backup -- --remote-only      # оставить архив только на сервере
 *   npm run backup -- --install-cron     # установить ежедневный cron-бэкап на сервере
 *   npm run backup -- --print-script     # показать генерируемый remote-скрипт
 *   npm run backup -- --print-config     # показать итоговую конфигурацию
 *
 * Конфигурация — env / корневой .env (шаблон — .env.example):
 *   DEPLOY_HOST / DEPLOY_USER / DEPLOY_PORT / DEPLOY_BACKEND_DIR /
 *   DEPLOY_PM2_APP / DEPLOY_PM2_HOME
 *   BACKUP_SERVER_DIR (по умолчанию /var/backups/family)
 *   BACKUP_LOCAL_DIR  (по умолчанию backups/ в корне репозитория)
 *   BACKUP_KEEP       (по умолчанию 7)
 *   BACKUP_CRON_TIME  (по умолчанию '0 3 * * *' — время сервера)
 *
 * Требуется OpenSSH (ssh/scp) в PATH. Останавливает бэкенд на несколько секунд.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

/** Парсит флаги вида `--key value` и возвращает значение (или null). */
function flagValue(names) {
  for (let i = 0; i < process.argv.length - 1; i += 1) {
    if (names.includes(process.argv[i])) return process.argv[i + 1];
  }
  return null;
}

const cfg = {
  host: process.env.DEPLOY_HOST ?? 'my.rybnikov.su',
  user: process.env.DEPLOY_USER ?? 'rybnikov',
  port: process.env.DEPLOY_PORT ?? '22',
  backendDir:
    process.env.DEPLOY_BACKEND_DIR ??
    `/var/www/${process.env.DEPLOY_HOST ?? 'my.rybnikov.su'}/server`,
  pm2App: process.env.DEPLOY_PM2_APP ?? 'family-backend',
  pm2Home: process.env.DEPLOY_PM2_HOME ?? '/home/rybnikov/.pm2',
  serverDir: process.env.BACKUP_SERVER_DIR ?? '/var/backups/family',
  localDir: resolve(
    flagValue(['--local']) ?? process.env.BACKUP_LOCAL_DIR ?? join(ROOT, 'backups'),
  ),
  keep: Number(process.env.BACKUP_KEEP ?? 7),
  cronTime: process.env.BACKUP_CRON_TIME ?? '0 3 * * *',
  download: !process.argv.includes('--remote-only'),
  installCron: process.argv.includes('--install-cron'),
  printScript: process.argv.includes('--print-script'),
  printConfig: process.argv.includes('--print-config'),
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

const REMOTE_SCRIPT_PATH = '/tmp/family-backup.sh';
const REMOTE_CRON_PATH = '/home/rybnikov/.family-backup-cron.sh';

function log(msg) {
  console.log(`\n[backup] ${msg}`);
}

/**
 * Общая часть remote-скрипта: остановка → снапшот → перезапуск → ротация.
 * Используется и для разового запуска, и (с shebang) для cron-скрипта на сервере.
 * ВАЖНО: все значения конфига подставляются на этапе генерации — на сервере bash
 * переменные не нужны (кроме runtime: $USER, $STAMP, $((KEEP+1)) и т.п.).
 */
function buildBackupScript({ forCron = false } = {}) {
  const body = `
set -e
STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE="/tmp/family-backup-\${STAMP}"
ARCHIVE="${cfg.serverDir}/family-backup-${cfg.host}-\${STAMP}.tar.gz"
export PM2_HOME="${cfg.pm2Home}"

# --- Обеспечить доступность node/npm/pm2 (минимальный PATH в неинтерактивных сессиях) ---
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
  echo "[backup] ERROR: pm2 not found on the server"
  exit 1
fi

# --- Каталог бэкапов (passwordless sudo); $USER в неинтерактивной ssh пуст — берём из id ---
sudo install -d -o "$(id -un)" -g "$(id -gn)" "${cfg.serverDir}" 2>/dev/null || mkdir -p "${cfg.serverDir}"
mkdir -p "$STAGE"

# --- Согласованный снапшот SQLite: остановить бэкенд, гарантировать перезапуск ---
pm2 stop "${cfg.pm2App}" >/dev/null 2>&1 || true
# При любом выходе: перезапустить бэкенд; если архив не завершён (DONE!=1) — убрать частичный.
trap 'pm2 restart "${cfg.pm2App}" >/dev/null 2>&1 || true; if [ "$DONE" != "1" ]; then rm -f "$ARCHIVE" "\${ARCHIVE}.sha256"; fi' EXIT

# --- Runtime-данные приложения ---
[ -d "${cfg.backendDir}/data" ] && cp -a "${cfg.backendDir}/data" "$STAGE/data"
[ -d "${cfg.backendDir}/docs" ] && cp -a "${cfg.backendDir}/docs" "$STAGE/docs"
[ -d "${cfg.backendDir}/images" ] && cp -a "${cfg.backendDir}/images" "$STAGE/images"
[ -f "${cfg.backendDir}/.env" ] && cp -a "${cfg.backendDir}/.env" "$STAGE/.env"

# --- Справочные конфиги сервера (nginx + letsencrypt) — НЕ восстанавливаются автоматически ---
mkdir -p "$STAGE/server-config/nginx"
for f in "${cfg.host}" redirect-rybnikov; do
  if [ -f "/etc/nginx/sites-available/\$f" ]; then
    cp -a "/etc/nginx/sites-available/\$f" "$STAGE/server-config/nginx/"
  fi
done
# letsencrypt доступен только root — читаем через passwordless sudo (-n: без интерактива)
if sudo -n test -d "/etc/letsencrypt/live/${cfg.host}" 2>/dev/null; then
  sudo -n cp -aL "/etc/letsencrypt/live/${cfg.host}" "$STAGE/server-config/letsencrypt-${cfg.host}"
  # скопировано от root (cp -a сохраняет владельца) — отдать пользователю, чтобы tar прочитал
  sudo -n chown -R "$(id -un):$(id -gn)" "$STAGE/server-config/letsencrypt-${cfg.host}"
fi

# --- Манифест ---
{
  echo "family backup manifest"
  echo "created: $(date -Is 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "host: ${cfg.host}"
  echo "pm2_app: ${cfg.pm2App}"
  echo "backend_dir: ${cfg.backendDir}"
  echo "---"
  echo "contents:"
  (cd "$STAGE" && find . -type f | sort)
} > "$STAGE/MANIFEST.txt"

# --- Архив + контрольная сумма ---
tar -czf "$ARCHIVE" -C "$STAGE" .
sha256sum "$ARCHIVE" | awk '{print $1}' > "\${ARCHIVE}.sha256"
# Архив завершён полностью — при выходе trap не должен его удалять
DONE=1

# --- Перезапуск бэкенда и снятие trap ---
pm2 restart "${cfg.pm2App}" >/dev/null 2>&1
pm2 save >/dev/null 2>&1 || true
trap - EXIT

# --- Ротация: оставить последние ${cfg.keep} архивов ---
ls -1t "${cfg.serverDir}"/family-backup-* 2>/dev/null | tail -n +${cfg.keep + 1} | xargs -r rm -f

rm -rf "$STAGE"
echo "[backup] ARCHIVE=\${ARCHIVE}"
`.trim();
  return forCron ? `#!/usr/bin/env bash\n${body}\n` : body;
}

/** Локальная установка ежедневного cron-бэкапа на сервере (идемпотентно). */
function installCron() {
  log(`Установка cron-бэкапа на ${target} (${cfg.cronTime})...`);
  const cronScript = buildBackupScript({ forCron: true });
  const staging = join(tmpdir(), `family-backup-cron-${process.pid}.sh`);
  writeFileSync(staging, cronScript, 'utf8');
  execFileSync('scp', [...scpBase, staging, `${target}:${REMOTE_CRON_PATH}`], {
    stdio: 'inherit',
  });
  const command = [
    `sudo install -d -o ${cfg.user} -g ${cfg.user} ${cfg.serverDir} 2>/dev/null || true`,
    `chmod +x ${REMOTE_CRON_PATH}`,
    `( crontab -l 2>/dev/null | grep -v 'family-backup-cron.sh' ; echo '${cfg.cronTime} /bin/bash ${REMOTE_CRON_PATH} >> ${cfg.serverDir}/cron.log 2>&1' ) | crontab -`,
    `echo "[backup] cron installed:"`,
    `crontab -l | grep 'family-backup-cron.sh' || true`,
  ].join(' && ');
  execFileSync('ssh', [...sshBase, command], { stdio: 'inherit' });
  log('Cron-бэкап установлен.');
  log(`Скрипт: ${REMOTE_CRON_PATH}; расписание: '${cfg.cronTime}'; каталог: ${cfg.serverDir}`);
}

function main() {
  if (cfg.printConfig) {
    console.log(
      JSON.stringify(
        {
          host: cfg.host,
          user: cfg.user,
          port: cfg.port,
          backendDir: cfg.backendDir,
          pm2App: cfg.pm2App,
          pm2Home: cfg.pm2Home,
          serverDir: cfg.serverDir,
          localDir: cfg.localDir,
          keep: cfg.keep,
          cronTime: cfg.cronTime,
          download: cfg.download,
        },
        null,
        2,
      ),
    );
    return;
  }

  if (cfg.installCron) {
    installCron();
    return;
  }

  const remoteScript = buildBackupScript();
  if (cfg.printScript) {
    console.log(remoteScript);
    return;
  }

  log(`Конфигурация: ${target}:${cfg.port} | backend: ${cfg.backendDir}`);
  log(`Серверный каталог бэкапов: ${cfg.serverDir} (ротация: последние ${cfg.keep})`);

  // 1) Загружаем remote-скрипт и выполняем на сервере
  const staging = join(tmpdir(), `family-backup-${process.pid}.sh`);
  writeFileSync(staging, remoteScript, 'utf8');
  log('Загрузка remote-скрипта...');
  execFileSync('scp', [...scpBase, staging, `${target}:${REMOTE_SCRIPT_PATH}`], {
    stdio: 'inherit',
  });

  log('Создание бэкапа на сервере (бэкенд будет остановлен на несколько секунд)...');
  let output;
  try {
    output = execFileSync('ssh', [...sshBase, `bash ${REMOTE_SCRIPT_PATH}`], {
      encoding: 'utf8',
    });
  } catch (err) {
    console.error(err.stdout || '');
    console.error('\n[backup] Сбой на сервере (бэкенд должен был перезапуститься автоматически).');
    process.exitCode = 1;
    return;
  }
  process.stdout.write(output);

  const match = output.match(/\[backup\] ARCHIVE=(.+)/);
  if (!match) {
    console.error('[backup] Не удалось определить путь к архиву на сервере.');
    process.exitCode = 1;
    return;
  }
  const serverArchive = match[1].trim();

  if (!cfg.download) {
    log(`Архив оставлен на сервере: ${serverArchive} (--remote-only)`);
    log(`Контрольная сумма: ${serverArchive}.sha256`);
    return;
  }

  // 2) Скачивание архива + контрольной суммы, проверка sha256
  mkdirSync(cfg.localDir, { recursive: true });
  const localArchive = join(cfg.localDir, basename(serverArchive));
  log(`Скачивание архива в ${cfg.localDir}...`);
  execFileSync('scp', [...scpBase, `${target}:${serverArchive}`, localArchive], {
    stdio: 'inherit',
  });
  execFileSync('scp', [...scpBase, `${target}:${serverArchive}.sha256`, `${localArchive}.sha256`], {
    stdio: 'inherit',
  });

  const remoteSha = readFileSync(`${localArchive}.sha256`, 'utf8').trim();
  const localSha = createHash('sha256').update(readFileSync(localArchive)).digest('hex');
  log(`Бэкап сохранён: ${localArchive}`);
  log(`sha256: ${localSha}`);
  if (remoteSha === localSha) {
    log('Контрольная сумма совпадает с серверной ✔');
  } else {
    log(`ВНИМАНИЕ: контрольная сумма НЕ совпадает (сервер: ${remoteSha})`);
    process.exitCode = 1;
  }
}

main();
