import { getClientBudget } from '../db/repositories/budgets.repo';
import { getSummaryForCampaigns } from '../db/repositories/metrics.repo';
import { getMetaSummaryRawForCampaigns } from '../db/repositories/meta-metrics.repo';
import { deriveTotals } from '../db/utils';
import type { BudgetPacingDTO, ConversionGoalDTO } from '../../lib/types';

/**
 * Computed budget pacing for a client's current calendar month — real spend
 * from their campaigns (Google Ads + Meta Ads combined) vs the monthly budget
 * amount staff set. Pure arithmetic, no AI tokens. Falls back to the manual
 * pct_used gauge when no amount is set.
 */
export async function getClientBudgetPacing(
  clientId: number,
  campaignIds: number[],
  metaCampaignIds: number[] = [],
): Promise<BudgetPacingDTO | null> {
  const budget = await getClientBudget(clientId);
  if (!budget) return null;

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const dayOfMonth = now.getUTCDate();
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().slice(0, 10);

  const manualFallback: BudgetPacingDTO = {
    mode: 'manual',
    monthlyBudget: null,
    spentThisMonth: 0,
    pctUsed: budget.pctUsed,
    dailyRunRate: 0,
    projectedSpend: 0,
    daysElapsed: dayOfMonth,
    daysRemaining: daysInMonth - dayOfMonth,
    status: 'no_budget',
    conversionGoal: null,
    updatedAt: budget.updatedAt,
  };

  const hasBudgetAmount = budget.monthlyBudget != null && budget.monthlyBudget > 0;
  const hasGoal = budget.monthlyConversionGoal != null && budget.monthlyConversionGoal > 0;
  if ((!hasBudgetAmount && !hasGoal) || (campaignIds.length === 0 && metaCampaignIds.length === 0)) {
    return manualFallback;
  }

  const [gTotals, mTotalsRaw] = await Promise.all([
    getSummaryForCampaigns(monthStart, today, campaignIds),
    getMetaSummaryRawForCampaigns(monthStart, today, metaCampaignIds),
  ]);
  const mTotals = deriveTotals(mTotalsRaw);
  const monthTotals = deriveTotals({
    spend: gTotals.spend + mTotals.spend,
    impressions: gTotals.impressions + mTotals.impressions,
    clicks: gTotals.clicks + mTotals.clicks,
    conversions: gTotals.conversions + mTotals.conversions,
    conversions_value: gTotals.conversionsValue + mTotals.conversionsValue,
  });

  // Conversion goal progress — computed whenever a goal is set, independent of budget.
  let conversionGoal: ConversionGoalDTO | null = null;
  if (hasGoal) {
    const goal = budget.monthlyConversionGoal as number;
    const achieved = monthTotals.conversions;
    const projectedTotal = dayOfMonth > 0 ? (achieved / dayOfMonth) * daysInMonth : 0;
    conversionGoal = {
      goal,
      achievedThisMonth: Math.round(achieved * 100) / 100,
      pctAchieved: Math.min(999, Math.round((achieved / goal) * 100)),
      projectedTotal: Math.round(projectedTotal * 10) / 10,
      status: achieved >= goal ? 'achieved' : projectedTotal >= goal * 0.9 ? 'on_track' : 'behind',
    };
  }

  if (!hasBudgetAmount) return { ...manualFallback, conversionGoal };

  const monthlyBudget = budget.monthlyBudget as number;
  const spent = monthTotals.spend;
  const dailyRunRate = dayOfMonth > 0 ? spent / dayOfMonth : 0;
  const projectedSpend = dailyRunRate * daysInMonth;
  const pctUsed = Math.min(999, Math.round((spent / monthlyBudget) * 100));

  // On track when the projection lands within ±10% of the budget.
  const ratio = projectedSpend / monthlyBudget;
  const status: BudgetPacingDTO['status'] =
    ratio > 1.1 ? 'over' : ratio < 0.9 ? 'under' : 'on_track';

  return {
    mode: 'computed',
    monthlyBudget,
    spentThisMonth: Math.round(spent * 100) / 100,
    pctUsed,
    dailyRunRate: Math.round(dailyRunRate * 100) / 100,
    projectedSpend: Math.round(projectedSpend * 100) / 100,
    daysElapsed: dayOfMonth,
    daysRemaining: daysInMonth - dayOfMonth,
    status,
    conversionGoal,
    updatedAt: budget.updatedAt,
  };
}
