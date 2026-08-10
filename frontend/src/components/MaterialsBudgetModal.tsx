import { useState, type FormEvent } from 'react';
import Modal from './Modal';
import Button from './Button';
import { updateMaterialsBudget, type MaterialsBudget } from '../api/client';
import { useEscapeClose } from '../hooks/useEscapeClose';

interface MaterialsBudgetModalProps {
  /** Текущая настройка бюджета — начальные значения формы. */
  budget: MaterialsBudget | null;
  /** Закрыть форму без сохранения. */
  onClose: () => void;
  /** Вызывается после успешного сохранения (перезагрузить сводку). */
  onSaved: () => void;
}

type Mode = 'percent' | 'amount';

/**
 * Форма настройки бюджета на материалы (admin) — «Материалы».
 * Бюджет задаётся либо процентом от сметы на работы (по умолчанию 100%,
 * пересчитывается при изменении сметы), либо явной суммой.
 */
function MaterialsBudgetModal({ budget, onClose, onSaved }: MaterialsBudgetModalProps) {
  const [mode, setMode] = useState<Mode>(budget?.mode ?? 'percent');
  const [percent, setPercent] = useState(
    String(budget?.mode === 'percent' && budget.percent != null ? budget.percent : 100),
  );
  const [amount, setAmount] = useState(
    budget?.mode === 'amount' && budget.amount != null ? String(budget.amount / 100) : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEscapeClose(onClose);

  const save = async (payload: { mode: Mode; percent?: number | null; amount?: number | null }) => {
    setSaving(true);
    setError(null);
    try {
      await updateMaterialsBudget(payload);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить бюджет');
      setSaving(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (mode === 'percent') {
      const p = Number(percent);
      if (!Number.isFinite(p) || p < 0) {
        setError('Введите процент от 0');
        return;
      }
      void save({ mode, percent: p, amount: null });
      return;
    }
    const rub = Number(amount);
    if (!Number.isFinite(rub) || rub < 0) {
      setError('Введите сумму в рублях');
      return;
    }
    void save({ mode, percent: null, amount: Math.round(rub * 100) });
  };

  return (
    <Modal title="Бюджет на материалы" onClose={onClose}>
      <form className="vps-form" onSubmit={handleSubmit}>
        <p className="vps-form__note">
          Бюджет используется в прогресс-баре «Материалы» — сумма по заказам из бюджета.
        </p>

        <div className="field">
          <span className="field__label">Способ задания бюджета</span>
          <label className="field__radio">
            <input
              type="radio"
              name="budget-mode"
              checked={mode === 'percent'}
              onChange={() => setMode('percent')}
            />
            Процент от сметы на работы
          </label>
          <label className="field__radio">
            <input
              type="radio"
              name="budget-mode"
              checked={mode === 'amount'}
              onChange={() => setMode('amount')}
            />
            Явная сумма
          </label>
        </div>

        {mode === 'percent' ? (
          <label className="field">
            <span className="field__label">Процент от сметы</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.1"
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
              placeholder="100"
              required
            />
            <span className="field__hint">
              По умолчанию 100%. При изменении сметы бюджет пересчитается автоматически.
            </span>
          </label>
        ) : (
          <label className="field">
            <span className="field__label">Сумма, ₽</span>
            <input
              className="input"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="напр. 500000"
              required
            />
          </label>
        )}

        {error && (
          <div className="alert alert--error" role="alert">
            {error}
          </div>
        )}

        <div className="vps-form__actions">
          <Button onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default MaterialsBudgetModal;
