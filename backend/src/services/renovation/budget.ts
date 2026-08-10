import {
  getCurrentEstimateVersion,
  getRenovationSetting,
  setRenovationSetting,
} from '../../db/renovationRepository';
import type { MaterialsBudget, MaterialsBudgetMode, MaterialsBudgetSetting } from './domain/types';

/**
 * Бюджет на материалы для «Блока 2. Материалы» (прогресс-бар освоения).
 * Задаётся либо процентом от сметы на работы (по умолчанию 100%), либо явной
 * суммой. В режиме «% от сметы» действующий бюджет вычисляется на лету из
 * актуальной версии сметы (`current`) — поэтому при изменении сметы бюджет
 * пересчитывается автоматически. Настройка хранится в `renovation_settings`.
 */

const BUDGET_KEY = 'materials_budget';

const DEFAULT_BUDGET: MaterialsBudgetSetting = { mode: 'percent', percent: 100, amount: null };

/** Сохранённая настройка бюджета (с валидацией; по умолчанию — 100% сметы). */
export function getMaterialsBudgetSetting(): MaterialsBudgetSetting {
  const raw = getRenovationSetting(BUDGET_KEY);
  if (!raw) return DEFAULT_BUDGET;
  try {
    const parsed = JSON.parse(raw) as Partial<MaterialsBudgetSetting>;
    const mode: MaterialsBudgetMode = parsed.mode === 'amount' ? 'amount' : 'percent';
    const percent =
      typeof parsed.percent === 'number' && Number.isFinite(parsed.percent) ? parsed.percent : null;
    const amount =
      typeof parsed.amount === 'number' && Number.isFinite(parsed.amount) ? parsed.amount : null;
    return { mode, percent, amount };
  } catch {
    return DEFAULT_BUDGET;
  }
}

/** Действующий бюджет на материалы, копейки (или null, если не вычислим). */
export function getMaterialsBudget(): MaterialsBudget {
  const setting = getMaterialsBudgetSetting();
  const estimate = getCurrentEstimateVersion();
  let value: number | null = null;
  if (setting.mode === 'amount') {
    value = setting.amount;
  } else if (estimate?.total != null && setting.percent != null) {
    value = Math.round((estimate.total * setting.percent) / 100);
  }
  return { ...setting, value };
}

/** Сохранить настройку бюджета и вернуть действующий бюджет. */
export function updateMaterialsBudget(input: MaterialsBudgetSetting): MaterialsBudget {
  const mode: MaterialsBudgetMode = input.mode === 'amount' ? 'amount' : 'percent';
  const percent = mode === 'percent' ? Math.max(0, Math.round(input.percent ?? 100)) : null;
  const amount = mode === 'amount' ? Math.max(0, Math.round(input.amount ?? 0)) : null;
  setRenovationSetting(BUDGET_KEY, JSON.stringify({ mode, percent, amount }));
  return getMaterialsBudget();
}
