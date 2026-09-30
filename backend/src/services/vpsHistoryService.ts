import { vpsEntries } from '../config/vps';
import { listVpsHistory } from '../db/vpsHistoryRepository';

export class VpsHistoryHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'VpsHistoryHttpError';
    this.status = status;
  }
}

export interface VpsHistoryPoint {
  checkedAt: string;
  online: boolean;
  latencyMs: number | null;
  error: string | null;
}

export interface VpsIncident {
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
}

export interface VpsHistory {
  name: string;
  points: VpsHistoryPoint[];
  incidents: VpsIncident[];
}

function durationMs(startedAt: string, endedAt: string): number {
  return Math.max(0, Date.parse(endedAt) - Date.parse(startedAt));
}

export function getVpsHistory(name: string, hours: number): VpsHistory {
  const normalizedName = name.trim();
  if (!normalizedName) throw new VpsHistoryHttpError(400, 'Не указано имя VPS');
  if (!vpsEntries.some((entry) => entry.name === normalizedName)) {
    throw new VpsHistoryHttpError(404, `VPS «${normalizedName}» не найдена`);
  }

  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const rows = listVpsHistory(normalizedName, since);
  const allPoints = rows.map((row) => ({
    checkedAt: row.checked_at,
    online: row.online === 1,
    latencyMs: row.latency_ms,
    error: row.error,
  }));
  const incidents: VpsIncident[] = [];
  let startedAt: string | null = null;
  for (const point of allPoints) {
    if (!point.online && startedAt === null) startedAt = point.checkedAt;
    if (point.online && startedAt !== null) {
      incidents.push({
        startedAt,
        endedAt: point.checkedAt,
        durationMs: durationMs(startedAt, point.checkedAt),
      });
      startedAt = null;
    }
  }
  if (startedAt !== null) incidents.push({ startedAt, endedAt: null, durationMs: null });
  const step = Math.ceil(allPoints.length / 240);
  const points = step > 1 ? allPoints.filter((_, index) => index % step === 0) : allPoints;
  return { name: normalizedName, points, incidents };
}
