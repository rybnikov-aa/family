#!/usr/bin/env node
/**
 * Просмотр SQLite-БД VPS: список VPS и их сервисов.
 *
 * Использование (из корня репозитория):
 *   node .github/skills/vps/scripts/list-vps.mjs                 # все VPS
 *   node .github/skills/vps/scripts/list-vps.mjs --name myserver # один VPS по имени
 *   node .github/skills/vps/scripts/list-vps.mjs --json          # JSON-вывод (для grep/jq)
 *   node .github/skills/vps/scripts/list-vps.mjs --db path/to/x.sqlite
 *
 * Путь к БД: флаг --db > env DB_PATH > по умолчанию backend/data/vps.sqlite (от корня репо).
 * Скрипт read-only: БД открывается только на чтение, схема не трогается.
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

function parseArgs(argv) {
  const args = { name: null, json: false, db: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') args.json = true;
    else if (a === '--name') args.name = argv[i + 1];
    else if (a === '--db') args.db = argv[i + 1];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const dbPath = resolve(args.db ?? process.env.DB_PATH ?? 'backend/data/vps.sqlite');

if (!existsSync(dbPath)) {
  console.error(`❌ БД не найдена: ${dbPath}`);
  process.exit(1);
}

const db = new DatabaseSync(dbPath, { readOnly: true });

/** Читает VPS и сервисы (как loadVpsEntries в vpsRepository.ts). */
function loadEntries() {
  const vpsRows = db.prepare('SELECT id, country, name, ip, panel FROM vps ORDER BY id').all();
  const serviceRows = db
    .prepare('SELECT vps_id, name, type, address FROM vps_services ORDER BY id')
    .all();

  const servicesByVps = new Map();
  for (const row of serviceRows) {
    const list = servicesByVps.get(row.vps_id) ?? [];
    list.push({ name: row.name, type: row.type, address: row.address });
    servicesByVps.set(row.vps_id, list);
  }

  return vpsRows.map((row) => ({
    id: row.id,
    country: row.country,
    name: row.name,
    ip: row.ip.trim(),
    panel: row.panel,
    services: servicesByVps.get(row.id) ?? [],
  }));
}

const entries = loadEntries();
const filtered = args.name ? entries.filter((e) => e.name === args.name) : entries;

if (args.json) {
  console.log(JSON.stringify(filtered, null, 2));
  db.close();
  process.exit(0);
}

if (filtered.length === 0) {
  console.error(args.name ? `❌ VPS «${args.name}» не найден` : 'ℹ️ VPS в БД нет');
  db.close();
  process.exit(args.name ? 1 : 0);
}

for (const e of filtered) {
  console.log(`■ ${e.name}  (${e.country})  ${e.ip}`);
  if (e.panel) console.log(`  Панель: ${e.panel}`);
  if (e.services.length === 0) {
    console.log('  Сервисы: —');
  } else {
    console.log('  Сервисы:');
    for (const s of e.services) {
      console.log(`    • ${s.name}  [${s.type}]  ${s.address}`);
    }
  }
}
db.close();
