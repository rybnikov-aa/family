import { useEffect, useMemo, useState } from 'react';
import {
  confirmRenovationAddendum,
  fetchRenovationAddendumProposal,
  fetchRenovationEstimateVersions,
  type RenovationAddendumDiff,
  type RenovationAddendumProposal,
  type RenovationEstimateVersion,
} from '../api/client';
import { formatDateIso, formatKopecks } from '../utils/money';
import Modal from './Modal';
import Button from './Button';
import { CheckIcon, RefreshIcon } from './icons';

interface AddendumModalProps {
  /** Закрыть модалку. */
  onClose: () => void;
  /** Вызывается после успешного применения (перезагрузить сводку). */
  onApplied: () => void;
}

const KIND_LABEL: Record<RenovationAddendumDiff['kind'], string> = {
  update: 'изменение',
  new: 'добавление',
  keep: 'без изменений',
  remove: 'удаление',
};

function diffMark(d: RenovationAddendumDiff): string {
  switch (d.kind) {
    case 'new':
      return 'новое';
    case 'update':
      return 'изменено';
    case 'remove':
      return 'удалено';
    default:
      return '';
  }
}

/**
 * Применение доп. соглашения к смете (этап 4, admin):
 * выбор доп. соглашения → дифф (было/стало, добавление/удаление) → подтверждение.
 * Старая `current` замораживается как `history`, создаётся новая `current` с
 * пересчитанными итогами (Итого по всем разделам + накладные 5% = Итого).
 */
function AddendumModal({ onClose, onApplied }: AddendumModalProps) {
  const [addenda, setAddenda] = useState<RenovationEstimateVersion[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [proposal, setProposal] = useState<RenovationAddendumProposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  /** Ключи позиций «keep», помеченных на удаление. */
  const [removeKeys, setRemoveKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    fetchRenovationEstimateVersions()
      .then(({ versions: v }) => {
        if (!active) return;
        const adds = v.filter((x) => x.kind === 'addendum');
        setAddenda(adds);
        if (adds.length === 1) setSelectedId(adds[0].id);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Ошибка загрузки'));
    return () => {
      active = false;
    };
  }, []);

  const loadProposal = async (addendumId: number) => {
    setLoading(true);
    setError(null);
    setProposal(null);
    setRemoveKeys(new Set());
    try {
      const { proposal: p } = await fetchRenovationAddendumProposal(addendumId);
      setProposal(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка формирования предложения');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (id: number) => {
    setSelectedId(id);
    void loadProposal(id);
  };

  const toggleRemove = (key: string) => {
    setRemoveKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selectedId == null) return;
    setConfirming(true);
    setError(null);
    try {
      const res = await confirmRenovationAddendum(selectedId, [...removeKeys]);
      setDone(
        `Смета обновлена: ${res.itemsCount} поз., итого ${formatKopecks(res.total, true)}` +
          (res.currentId ? ` (версия #${res.currentId})` : ''),
      );
      onApplied();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка применения');
      setConfirming(false);
    }
  };

  const counts = useMemo(() => {
    if (!proposal) return null;
    const c: Record<string, number> = { update: 0, new: 0, keep: 0, remove: 0 };
    for (const d of proposal.diffs) c[d.kind] += 1;
    c.remove = removeKeys.size;
    return c;
  }, [proposal, removeKeys]);

  const selected = addenda.find((a) => a.id === selectedId) ?? null;

  return (
    <Modal title="Применить доп. соглашение" onClose={onClose} wide>
      <div className="addendum">
        {done ? (
          <div className="addendum__done">
            <span className="addendum__done-icon">
              <CheckIcon width="2rem" height="2rem" />
            </span>
            <div>{done}</div>
            <div className="addendum__actions">
              <Button variant="primary" onClick={onClose}>
                Закрыть
              </Button>
            </div>
          </div>
        ) : (
          <>
            <label className="addendum__select">
              <span>Доп. соглашение:</span>
              <select
                value={selectedId ?? ''}
                onChange={(e) => handleSelect(Number(e.target.value))}
                disabled={loading || confirming}
              >
                <option value="">— выберите —</option>
                {addenda.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                    {a.date ? ` (${formatDateIso(a.date)})` : ''} — {formatKopecks(a.total, true)}
                  </option>
                ))}
              </select>
            </label>

            {error && <div className="addendum__error">{error}</div>}
            {loading && <div className="addendum__hint">Считаем дифф…</div>}

            {proposal && (
              <div className="addendum__proposal">
                <div className="addendum__summary">
                  <span>
                    Актуальная смета: <strong>{formatKopecks(proposal.current.total, true)}</strong>
                  </span>
                  <span>
                    После применения: <strong>{formatKopecks(proposal.newTotal, true)}</strong>
                  </span>
                  {counts && (
                    <span className="addendum__counts">
                      +{counts.new} новых · {counts.update} изменений ·
                      {counts.remove > 0 ? ` −${counts.remove} удал.` : ''}
                    </span>
                  )}
                </div>

                {proposal.needsReview && (
                  <div className="addendum__warn">
                    ⚠ Требуется проверка:{' '}
                    {proposal.warnings.length > 0 ? (
                      <ul>
                        {proposal.warnings.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    ) : (
                      'проверьте строки диффа'
                    )}
                  </div>
                )}

                <div className="addendum__table-wrap">
                  <table className="addendum__table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Позиция</th>
                        <th>Было</th>
                        <th>Стало</th>
                        <th>Метка</th>
                        {counts && counts.keep > 0 && <th>Удалить</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {proposal.diffs.map((d, i) => {
                        const removable = d.kind === 'keep';
                        const checked = removable && removeKeys.has(d.key);
                        return (
                          <tr key={i} className={`addendum__row addendum__row--${d.kind}`}>
                            <td className="addendum__td-num">{d.section}</td>
                            <td className="addendum__td-name">{d.name}</td>
                            <td className="addendum__td-old">
                              {d.kind === 'update'
                                ? `${formatKopecks(d.oldSum, true)}`
                                : d.kind === 'keep'
                                  ? formatKopecks(d.sum, true)
                                  : '—'}
                            </td>
                            <td className="addendum__td-new">
                              {d.kind === 'update' || d.kind === 'new'
                                ? formatKopecks(d.sum, true)
                                : d.kind === 'remove'
                                  ? '—'
                                  : formatKopecks(d.sum, true)}
                            </td>
                            <td>
                              <span className={`addendum__badge addendum__badge--${d.kind}`}>
                                {KIND_LABEL[d.kind]}
                              </span>
                            </td>
                            {counts && counts.keep > 0 && (
                              <td className="addendum__td-check">
                                {removable ? (
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleRemove(d.key)}
                                    aria-label={`Удалить: ${d.name}`}
                                  />
                                ) : (
                                  <span className="addendum__muted">{diffMark(d)}</span>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="addendum__totals">
                  <div className="addendum__totals-row">
                    <span>Итого по всем разделам</span>
                    <span>{formatKopecks(proposal.newTotalNoOverhead, true)}</span>
                  </div>
                  <div className="addendum__totals-row">
                    <span>Накладные 5%</span>
                    <span>{formatKopecks(proposal.newOverhead, true)}</span>
                  </div>
                  <div className="addendum__totals-row addendum__totals-row--final">
                    <span>Итого</span>
                    <span>{formatKopecks(proposal.newTotal, true)}</span>
                  </div>
                </div>
              </div>
            )}

            {proposal && selected && (
              <div className="addendum__actions">
                <Button
                  variant="primary"
                  icon={<RefreshIcon />}
                  onClick={handleConfirm}
                  disabled={confirming}
                >
                  {confirming ? 'Применяем…' : 'Применить доп. соглашение'}
                </Button>
                <Button onClick={onClose}>Отмена</Button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

export default AddendumModal;
