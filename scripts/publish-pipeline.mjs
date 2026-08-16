#!/usr/bin/env node

import { closeSync, existsSync, openSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = {
  host: process.env.PIPELINE_SOURCE_HOST ?? 'my.rybnikov.su',
  user: process.env.PIPELINE_SOURCE_USER ?? process.env.DEPLOY_USER ?? 'rybnikov',
  port: process.env.PIPELINE_SOURCE_PORT ?? process.env.DEPLOY_PORT ?? '22',
  backendDir: process.env.PIPELINE_SOURCE_BACKEND_DIR ?? '/var/www/my.rybnikov.su/server',
};
const target = {
  host: process.env.PIPELINE_TARGET_HOST ?? 'test.rybnikov.su',
  user: process.env.PIPELINE_TARGET_USER ?? process.env.DEPLOY_USER ?? 'rybnikov',
  port: process.env.PIPELINE_TARGET_PORT ?? process.env.DEPLOY_PORT ?? '22',
  frontendDir: process.env.PIPELINE_TARGET_FRONTEND_DIR ?? '/var/www/test.rybnikov.su/public_html',
  backendDir: process.env.PIPELINE_TARGET_BACKEND_DIR ?? '/var/www/test.rybnikov.su/server',
  pm2App: process.env.PIPELINE_TARGET_PM2_APP ?? 'family-backend-test',
  pm2Home: process.env.PIPELINE_TARGET_PM2_HOME ?? '/home/rybnikov/.pm2',
};
const mainDeploy = {
  host: process.env.PIPELINE_MAIN_HOST ?? 'my.rybnikov.su',
  user: process.env.PIPELINE_MAIN_USER ?? process.env.DEPLOY_USER ?? 'rybnikov',
  port: process.env.PIPELINE_MAIN_PORT ?? process.env.DEPLOY_PORT ?? '22',
  frontendDir: process.env.PIPELINE_MAIN_FRONTEND_DIR ?? '/var/www/my.rybnikov.su/public_html',
  backendDir: process.env.PIPELINE_MAIN_BACKEND_DIR ?? '/var/www/my.rybnikov.su/server',
  pm2App: process.env.PIPELINE_MAIN_PM2_APP ?? 'family-backend',
  pm2Home: process.env.PIPELINE_MAIN_PM2_HOME ?? '/home/rybnikov/.pm2',
};
const syncFiles = process.env.PIPELINE_SYNC_FILES === '1';
const archivePath = join(tmpdir(), `family-pipeline-${process.pid}.tar.gz`);
const sanityUsers = [
  {
    username:
      process.env.PIPELINE_TEST_ADMIN_USERNAME ?? process.env.PIPELINE_TEST_USERNAME ?? 'test',
    password:
      process.env.PIPELINE_TEST_ADMIN_PASSWORD ??
      process.env.PIPELINE_TEST_PASSWORD ??
      'test123456',
    name: 'Pipeline test admin',
    role: 'admin',
  },
  {
    username: process.env.PIPELINE_TEST_USER_USERNAME ?? 'user',
    password: process.env.PIPELINE_TEST_USER_PASSWORD ?? 'user123456',
    name: 'Pipeline test user',
    role: 'user',
  },
];

function shellQuote(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`;
}

function sshArgs(server) {
  return [
    '-p',
    server.port,
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-o',
    'ConnectTimeout=20',
    `${server.user}@${server.host}`,
  ];
}

function run(command, args, env = process.env) {
  console.log(`\n[pipeline] $ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', env });
  if (result.status !== 0) throw new Error(`${command} завершился с кодом ${result.status}`);
}

function remote(server, command) {
  run('ssh', [...sshArgs(server), command]);
}

function createDataArchive() {
  const directories = syncFiles ? 'data docs images' : 'data';
  const command = `tar -czf - -C ${shellQuote(source.backendDir)} ${directories}`;
  console.log(
    `[pipeline] Копирование ${syncFiles ? 'data, docs, images' : 'data'} с основного сервера`,
  );
  const fd = openSync(archivePath, 'w');
  const result = spawnSync('ssh', [...sshArgs(source), command], {
    stdio: ['ignore', fd, 'inherit'],
  });
  closeSync(fd);
  if (result.status !== 0) throw new Error(`Архив данных не создан (код ${result.status})`);
}

function installDataArchive() {
  const remoteArchive = '/tmp/family-pipeline-data.tar.gz';
  run('scp', [
    '-P',
    target.port,
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-o',
    'ConnectTimeout=20',
    archivePath,
    `${target.user}@${target.host}:${remoteArchive}`,
  ]);
  const directories = syncFiles ? 'data docs images' : 'data';
  const cleanup = directories
    .split(' ')
    .map((dir) => `rm -rf ${shellQuote(join(target.backendDir, dir))}`)
    .join('; ');
  const command = [
    `export PM2_HOME=${shellQuote(target.pm2Home)}`,
    `pm2 stop ${shellQuote(target.pm2App)} || true`,
    cleanup,
    `mkdir -p ${shellQuote(target.backendDir)}`,
    `tar -xzf ${shellQuote(remoteArchive)} -C ${shellQuote(target.backendDir)}`,
    `rm -f ${shellQuote(remoteArchive)}`,
    `pm2 restart ${shellQuote(target.pm2App)}`,
  ].join(' && ');
  remote(target, command);
}

function manageSanityUsers(command) {
  const usersScript = join(target.backendDir, 'scripts', 'users.mjs');
  const node = '$(command -v node || printf /usr/bin/node)';
  const commands = sanityUsers.map(({ username, password, name, role }) => {
    const args = `${shellQuote(username)} ${shellQuote(name)} ${shellQuote(role)}`;
    if (command === 'add') {
      return (
        `"${node}" ${shellQuote(usersScript)} remove ${shellQuote(username)} || true && ` +
        `"${node}" ${shellQuote(usersScript)} add ${args} --password ${shellQuote(password)}`
      );
    }
    return `"${node}" ${shellQuote(usersScript)} remove ${shellQuote(username)} || true`;
  });
  remote(target, `cd ${shellQuote(target.backendDir)} && ${commands.join(' && ')}`);
}

function deployTo(server, noBuild) {
  const env = {
    ...process.env,
    DEPLOY_HOST: server.host,
    DEPLOY_USER: server.user,
    DEPLOY_PORT: server.port,
    DEPLOY_FRONTEND_DIR: server.frontendDir,
    DEPLOY_BACKEND_DIR: server.backendDir,
    DEPLOY_PM2_APP: server.pm2App,
    DEPLOY_PM2_HOME: server.pm2Home,
  };
  const args = ['scripts/deploy.mjs', '--no-pdf-setup'];
  if (noBuild) args.push('--no-build');
  run(process.execPath, args, env);
}

function runSanity(user) {
  run(process.execPath, ['scripts/sanity-test.mjs'], {
    ...process.env,
    SANITY_BASE_URL: process.env.PIPELINE_TEST_URL ?? 'https://test.rybnikov.su',
    SANITY_USERNAME: user.username,
    SANITY_PASSWORD: user.password,
  });
}

function printConfig() {
  console.log(JSON.stringify({ source, target, mainDeploy, syncFiles }, null, 2));
}

async function main() {
  if (process.argv.includes('--print-config')) {
    printConfig();
    return;
  }
  if (target.host === mainDeploy.host || target.backendDir === mainDeploy.backendDir) {
    throw new Error('Тестовый и основной сервер совпадают; публикация остановлена');
  }
  if (!existsSync(join(root, 'frontend', 'dist')) || !existsSync(join(root, 'backend', 'dist'))) {
    console.log('[pipeline] dist отсутствует, сборка будет выполнена первым деплоем');
  }

  console.log('[pipeline] Этап 1/4: публикация на тестовый сервер');
  deployTo(target, false);
  console.log('[pipeline] Этап 2/4: инициализация данных тестового сервера');
  createDataArchive();
  installDataArchive();
  console.log('[pipeline] Создание временных пользователей test и user');
  manageSanityUsers('add');
  console.log('[pipeline] Этап 3/4: sanity-тесты на тестовом сервере');
  try {
    for (const user of sanityUsers) {
      console.log(`[pipeline] Sanity под ${user.username} (${user.role})`);
      runSanity(user);
    }
  } finally {
    console.log('[pipeline] Удаление временных пользователей');
    manageSanityUsers('remove');
  }
  console.log('[pipeline] Этап 4/4: публикация на основной сервер');
  deployTo(mainDeploy, true);
  console.log('[pipeline] Публикация завершена');
}

try {
  await main();
} catch (error) {
  console.error(`[pipeline] ОШИБКА: ${error.message ?? error}`);
  process.exitCode = 1;
} finally {
  rmSync(archivePath, { force: true });
}
