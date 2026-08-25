import { Fragment, useEffect, useMemo, useState } from 'react';
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
import ModalDone from './ModalDone';
import { RefreshIcon } from './icons';

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

  const showRemove = counts != null && counts.keep > 0;
  const colCount = showRemove ? 5 : 4;

  /** Дифф, сгруппированный по разделам (порядок появления), с подитогом «Стало». */
  const sectionGroups = useMemo(() => {
    if (!proposal) return [];
    const bySection = new Map<string, RenovationAddendumDiff[]>();
    for (const d of proposal.diffs) {
      const title = d.section || 'Прочее';
      const rows = bySection.get(title);
      if (rows) rows.push(d);
      else bySection.set(title, [d]);
    }
    return [...bySection.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'ru', { numeric: true }))
      .map(([title, rows]) => {
        const changed = rows.filter((r) => r.kind === 'update' || r.kind === 'new').length;
        const subtotal = rows.reduce((s, r) => s + (r.sum ?? 0), 0);
        return { title, rows, changed, subtotal };
      });
  }, [proposal]);

  const selected = addenda.find((a) => a.id === selectedId) ?? null;

  return (
    <Modal title="Применить доп. соглашение" onClose={onClose} className="modal--addendum">
      <div className="addendum">
        {done ? (
          <ModalDone message={done} onClose={onClose} />
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

                <div className="renov-rp__table-wrap">
                  <table className="renov-rp__table renov-rp__table--fixed renov-rp__table--addendum">
                    <colgroup>
                      <col className="renov-rp__col-name" />
                      <col className="renov-rp__col-sum" />
                      <col className="renov-rp__col-sum" />
                      <col className="renov-rp__col-badge" />
                      {showRemove && <col className="renov-rp__col-check" />}
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="renov-rp__th-left">Позиция</th>
                        <th className="renov-rp__th-num">Было</th>
                        <th className="renov-rp__th-num">Стало</th>
                        <th>Метка</th>
                        {showRemove && <th>Удалить</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sectionGroups.map((sec) => (
                        <Fragment key={sec.title}>
                          <tr className="renov-rp__section">
                            <td colSpan={colCount} className="renov-rp__section-title">
                              <span className="renov-rp__section-title-text">{sec.title}</span>
                              <span className="renov-pill renov-pill--sm" title="Изменено строк">
                                {sec.changed} / {sec.rows.length}
                              </span>
                            </td>
                          </tr>
                          {sec.rows.map((d, i) => (
                            <tr
                              key={`${sec.title}-${i}`}
                              className={`renov-rp__row addendum__row--${d.kind}`}
                            >
                              <td className="renov-rp__left">
                                <span className="renov-rp__name">
                                  <span className="renov-rp__name-text">{d.name}</span>
                                  {d.unit && <span className="renov-rp__unit">{d.unit}</span>}
                                </span>
                              </td>
                              <td className="renov-rp__num">
                                <span
                                  className={`addendum__old${d.kind === 'update' ? ' addendum__old--changed' : ''}`}
                                >
                                  {d.kind === 'new'
                                    ? '—'
                                    : formatKopecks(d.kind === 'update' ? d.oldSum : d.sum, true)}
                                </span>
                              </td>
                              <td className="renov-rp__num">
                                {d.kind === 'remove' ? '—' : formatKopecks(d.sum, true)}
                              </td>
                              <td className="renov-rp__badge-cell">
                                <span className={`addendum__badge addendum__badge--${d.kind}`}>
                                  {KIND_LABEL[d.kind]}
                                </span>
                              </td>
                              {showRemove && (
                                <td className="renov-rp__check-cell">
                                  {d.kind === 'keep' ? (
                                    <input
                                      type="checkbox"
                                      checked={removeKeys.has(d.key)}
                                      onChange={() => toggleRemove(d.key)}
                                      aria-label={`Удалить: ${d.name}`}
                                    />
                                  ) : (
                                    <span className="addendum__muted">{diffMark(d)}</span>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                          <tr className="renov-rp__subtotal">
                            <td colSpan={2} className="renov-rp__subtotal-label">
                              Итого по разделу
                            </td>
                            <td className="renov-rp__num">{formatKopecks(sec.subtotal, true)}</td>
                            <td />
                            {showRemove && <td />}
                          </tr>
                        </Fragment>
                      ))}
                      <tr className="renov-rp__total">
                        <td colSpan={2} className="renov-rp__total-label">
                          Итого по всем разделам
                        </td>
                        <td className="renov-rp__num">
                          {formatKopecks(proposal.newTotalNoOverhead, true)}
                        </td>
                        <td />
                        {showRemove && <td />}
                      </tr>
                      <tr className="renov-rp__total">
                        <td colSpan={2} className="renov-rp__total-label">
                          Накладные 5%
                        </td>
                        <td className="renov-rp__num">
                          {formatKopecks(proposal.newOverhead, true)}
                        </td>
                        <td />
                        {showRemove && <td />}
                      </tr>
                      <tr className="renov-rp__total renov-rp__total--final">
                        <td colSpan={2} className="renov-rp__total-label">
                          Итого
                        </td>
                        <td className="renov-rp__num">{formatKopecks(proposal.newTotal, true)}</td>
                        <td />
                        {showRemove && <td />}
                      </tr>
                    </tbody>
                  </table>
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
