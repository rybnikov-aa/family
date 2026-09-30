import { useEffect, useState } from 'react';
import Modal from './Modal';
import { fetchVpsHistory, type VpsHistory } from '../api/client';

interface VpsHistoryModalProps {
  name: string;
  onClose: () => void;
}

function VpsHistoryModal({ name, onClose }: VpsHistoryModalProps) {
  const [hours, setHours] = useState(168);
  const [history, setHistory] = useState<VpsHistory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void fetchVpsHistory(name, hours)
      .then((result) => {
        if (active) setHistory(result);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : 'Не удалось загрузить историю');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [name, hours]);

  const onlinePoints = history?.points.filter((point) => point.online).length ?? 0;
  const availability =
    history && history.points.length > 0
      ? Math.round((onlinePoints / history.points.length) * 100)
      : null;
  const latencies = history?.points.flatMap((point) => point.latencyMs ?? []) ?? [];
  const averageLatency =
    latencies.length > 0
      ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length)
      : null;

  return (
    <Modal title={`История: ${name}`} onClose={onClose}>
      <div className="vps-history">
        <label className="field">
          <span className="field__label">Период</span>
          <select
            className="input"
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
          >
            <option value={24}>Последние 24 часа</option>
            <option value={168}>Последние 7 дней</option>
            <option value={720}>Последние 30 дней</option>
          </select>
        </label>
        {loading ? (
          <div className="news-empty">Загрузка истории…</div>
        ) : error ? (
          <div className="alert alert--error">{error}</div>
        ) : history && history.points.length > 0 ? (
          <>
            <div className="vps-history__summary">
              <strong>{availability}%</strong>
              <span>доступность</span>
              <strong>
                {averageLatency ?? '—'}
                {averageLatency !== null && ' мс'}
              </strong>
              <span>средняя задержка</span>
            </div>
            <div className="vps-history__chart" aria-label="История доступности">
              {history.points.map((point) => (
                <span
                  className={`vps-history__point vps-history__point--${point.online ? 'online' : 'offline'}`}
                  key={point.checkedAt}
                  title={`${new Date(point.checkedAt).toLocaleString('ru-RU')}: ${point.online ? `${point.latencyMs ?? '—'} мс` : 'недоступна'}`}
                />
              ))}
            </div>
            <p className="vps-history__legend">
              <span className="vps-history__swatch vps-history__swatch--online" />
              доступна <span className="vps-history__swatch vps-history__swatch--offline" />
              недоступна
            </p>
            {history.incidents.length > 0 ? (
              <div className="vps-history__incidents">
                <h4>Недоступность</h4>
                {history.incidents
                  .slice(-8)
                  .reverse()
                  .map((incident) => (
                    <div className="vps-history__incident" key={incident.startedAt}>
                      <span>{new Date(incident.startedAt).toLocaleString('ru-RU')}</span>
                      <strong>
                        {incident.durationMs === null
                          ? 'ещё продолжается'
                          : `${Math.round(incident.durationMs / 60000)} мин`}
                      </strong>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="vps-history__ok">За выбранный период аварий не зафиксировано.</p>
            )}
          </>
        ) : (
          <div className="news-empty">История ещё не накоплена.</div>
        )}
      </div>
    </Modal>
  );
}

export default VpsHistoryModal;
