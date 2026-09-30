import { getDb } from './database';
import type { VpsStatus } from '../config/vps';

export interface VpsHistoryRow {
  vps_name: string;
  checked_at: string;
  online: number;
  latency_ms: number | null;
  error: string | null;
}

export function recordVpsHistory(statuses: VpsStatus[]): void {
  const db = getDb();
  const insert = db.prepare(
    `INSERT INTO vps_history (vps_name, checked_at, online, latency_ms, error)
     VALUES (?, ?, ?, ?, ?)`,
  );
  for (const status of statuses) {
    insert.run(
      status.name,
      status.checkedAt,
      status.online ? 1 : 0,
      status.latencyMs,
      status.error,
    );
  }
  db.prepare("DELETE FROM vps_history WHERE checked_at < datetime('now', '-90 days')").run();
}

export function listVpsHistory(name: string, sinceIso: string): VpsHistoryRow[] {
  const rows = getDb()
    .prepare(
      `SELECT vps_name, checked_at, online, latency_ms, error
       FROM vps_history
       WHERE vps_name = ? AND checked_at >= ?
       ORDER BY checked_at ASC`,
    )
    .all(name, sinceIso);
  return rows as unknown as VpsHistoryRow[];
}
