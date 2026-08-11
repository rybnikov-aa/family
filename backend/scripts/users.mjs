#!/usr/bin/env node
/**
 * Управление пользователями авторизации (без сборки, без новых зависимостей).
 *
 * Использует ту же БД авторизации и тот же формат хэша пароля, что и приложение
 * (`scrypt$N$r$p$<saltHex>$<hashHex>`), — см. `src/services/authService.ts`.
 *
 * Запуск (из папки backend/):
 *   node scripts/users.mjs add <username> <name> <role> [--password <пароль>]
 *   node scripts/users.mjs list
 *   node scripts/users.mjs set-role <username> <role>
 *   node scripts/users.mjs remove <username>
 *
 * Роли: admin | user. Путь к БД авторизации — `AUTH_DB_PATH` (по умолчанию
 * `data/auth.sqlite` рядом с backend/; это отдельная БД от `DB_PATH` — VPS).
 * Первого администратора можно создать и через env
 * `AUTH_BOOTSTRAP_PASSWORD` при первом старте бэкенда.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes, scryptSync } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import readline from 'node:readline';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

const dbPath = resolve(process.env.AUTH_DB_PATH ?? 'data/auth.sqlite');

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function openDb() {
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      name          TEXT    NOT NULL,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'user',
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

/** Скрытый ввод пароля (не эхонируется в терминал). */
function promptPassword(question) {
  return new Promise((resolvePromise) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    const write = rl._writeToOutput.bind(rl);
    rl._writeToOutput = (s) => {
      // Подавляем эхо символов, но оставляем вывод самой строки-подсказки и перевода строки.
      if (s.includes('\n') || s.includes('\r')) write(s);
    };
    rl.question(question, (answer) => {
      rl.close();
      resolvePromise(answer);
    });
  });
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0];
  const rest = args.slice(1);
  const passwordIndex = rest.indexOf('--password');
  let password;
  if (passwordIndex !== -1) {
    password = rest[passwordIndex + 1];
    rest.splice(passwordIndex, 2);
  }
  return { command, rest, password };
}

async function main() {
  const { command, rest, password } = parseArgs(process.argv);
  const db = openDb();

  if (command === 'add') {
    const [username, name, role = 'user'] = rest;
    if (!username || !name || !['admin', 'user'].includes(role)) {
      console.error(
        'Использование: node scripts/users.mjs add <username> <name> <admin|user> [--password <пароль>]',
      );
      process.exitCode = 1;
      return;
    }
    const finalPassword = password ?? (await promptPassword(`Пароль для «${username}»: `));
    if (!finalPassword) {
      console.error('Пароль не задан.');
      process.exitCode = 1;
      return;
    }
    try {
      db.prepare('INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)').run(
        username,
        name,
        hashPassword(finalPassword),
        role,
      );
      console.log(`Пользователь «${username}» (${name}, роль ${role}) создан.`);
    } catch (err) {
      if ((err?.errcode & 0xff) === 19) {
        console.error(`Пользователь «${username}» уже существует.`);
      } else {
        throw err;
      }
      process.exitCode = 1;
    }
    return;
  }

  if (command === 'list') {
    const rows = db
      .prepare('SELECT id, username, name, role, created_at FROM users ORDER BY username')
      .all();
    if (rows.length === 0) {
      console.log(
        'Пользователей нет. Создайте первого через `add` или env AUTH_BOOTSTRAP_PASSWORD.',
      );
      return;
    }
    for (const row of rows) {
      console.log(`${row.username}\t${row.name}\t${row.role}\t${row.created_at}`);
    }
    return;
  }

  if (command === 'set-role') {
    const [username, role] = rest;
    if (!username || !['admin', 'user'].includes(role)) {
      console.error('Использование: node scripts/users.mjs set-role <username> <admin|user>');
      process.exitCode = 1;
      return;
    }
    const result = db.prepare('UPDATE users SET role = ? WHERE username = ?').run(role, username);
    if (result.changes === 0) {
      console.error(`Пользователь «${username}» не найден.`);
      process.exitCode = 1;
    } else {
      console.log(`Роль «${username}» → ${role}.`);
    }
    return;
  }

  if (command === 'remove') {
    const [username] = rest;
    if (!username) {
      console.error('Использование: node scripts/users.mjs remove <username>');
      process.exitCode = 1;
      return;
    }
    const result = db.prepare('DELETE FROM users WHERE username = ?').run(username);
    if (result.changes === 0) {
      console.error(`Пользователь «${username}» не найден.`);
      process.exitCode = 1;
    } else {
      console.log(`Пользователь «${username}» удалён.`);
    }
    return;
  }

  console.error(`Неизвестная команда «${command ?? ''}». Доступно: add, list, set-role, remove.`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
