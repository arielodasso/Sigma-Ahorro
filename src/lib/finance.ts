import { daysBetween, daysInMonth, endOfMonth, startOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, addMonths, type Frequency } from "./dates";

export interface BudgetLike {
  amountMinor: number;
  period: "weekly" | "monthly" | "yearly" | "custom";
  startDate: string;
  endDate?: string | null;
}

export interface BudgetWindow {
  from: string;
  to: string;
  totalDays: number;
}

export function budgetWindow(budget: BudgetLike, today: string): BudgetWindow {
  let from: string;
  let to: string;
  switch (budget.period) {
    case "weekly":
      from = startOfWeek(today);
      to = endOfWeek(today);
      break;
    case "yearly":
      from = startOfYear(today);
      to = endOfYear(today);
      break;
    case "custom":
      from = budget.startDate || startOfMonth(today);
      to = budget.endDate || endOfMonth(today);
      break;
    case "monthly":
    default:
      from = startOfMonth(today);
      to = endOfMonth(today);
      break;
  }
  if (to < from) to = from;
  return { from, to, totalDays: Math.max(1, daysBetween(from, to) + 1) };
}

export interface BudgetProgress {
  spentMinor: number;
  remainingMinor: number;
  percentage: number;
  projectedMinor: number;
  projectedPercentage: number;
  elapsedDays: number;
  totalDays: number;
  status: "ok" | "warning" | "danger" | "exceeded";
  crossedThreshold: number | null;
}

export function budgetProgress(
  amountMinor: number,
  spentMinor: number,
  window: BudgetWindow,
  today: string,
  thresholds: number[] = [50, 75, 90, 100],
): BudgetProgress {
  const total = Math.max(0, amountMinor);
  const spent = Math.max(0, spentMinor);
  const pct = total === 0 ? 0 : Math.round((spent / total) * 1000) / 10;
  const elapsed = Math.min(
    window.totalDays,
    Math.max(1, today < window.from ? 0 : Math.min(window.totalDays, daysBetween(window.from, today) + 1)),
  );
  const projected = elapsed === 0 ? 0 : Math.round((spent / elapsed) * window.totalDays);
  const projectedPct = total === 0 ? 0 : Math.round((projected / total) * 1000) / 10;

  let status: BudgetProgress["status"] = "ok";
  if (pct > 100) status = "exceeded";
  else if (pct >= 90) status = "danger";
  else if (pct >= 75) status = "warning";

  const sorted = [...thresholds].sort((a, b) => a - b);
  const crossed = sorted.filter((threshold) => pct >= threshold).pop() ?? null;

  return {
    spentMinor: spent,
    remainingMinor: Math.max(0, total - spent),
    percentage: pct,
    projectedMinor: projected,
    projectedPercentage: projectedPct,
    elapsedDays: elapsed,
    totalDays: window.totalDays,
    status,
    crossedThreshold: crossed,
  };
}

export function budgetDaysLeft(window: BudgetWindow, today: string): number {
  if (today >= window.to) return 0;
  return daysBetween(today, window.to);
}

export function budgetNextWindow(budget: BudgetLike, today: string): BudgetWindow {
  if (budget.period === "custom") return budgetWindow(budget, today);
  const nextRef = addMonths(today, 1);
  return budgetWindow(budget, nextRef);
}

export interface SplitInput {
  memberId: string;
  amountMinor?: number;
  percentage?: number;
  excluded?: boolean;
}

export function splitEqually(totalMinor: number, memberIds: string[]): Array<{ memberId: string; amountMinor: number }> {
  const ids = [...new Set(memberIds)].filter(Boolean);
  if (ids.length === 0) return [];
  const base = Math.trunc(totalMinor / ids.length);
  let remainder = totalMinor - base * ids.length;
  return ids.map((memberId) => {
    const extra = remainder > 0 ? 1 : remainder < 0 ? -1 : 0;
    remainder -= extra;
    return { memberId, amountMinor: base + extra };
  });
}

export function splitByPercentages(
  totalMinor: number,
  inputs: SplitInput[],
): Array<{ memberId: string; amountMinor: number; percentage: number }> {
  const active = inputs.filter((input) => !input.excluded && (input.percentage ?? 0) > 0);
  const totalPct = active.reduce((acc, input) => acc + (input.percentage ?? 0), 0);
  if (Math.abs(totalPct - 100) > 0.001) {
    throw new Error("Los porcentajes deben sumar 100%");
  }
  const raw = active.map((input) => ({
    memberId: input.memberId,
    percentage: input.percentage ?? 0,
    exact: (totalMinor * (input.percentage ?? 0)) / 100,
  }));
  const rounded = raw.map((item) => ({ ...item, amountMinor: Math.floor(item.exact) }));
  let remainder = totalMinor - rounded.reduce((acc, item) => acc + item.amountMinor, 0);
  const order = rounded
    .map((item, index) => ({ index, frac: item.exact - item.amountMinor }))
    .sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < order.length && remainder > 0; i += 1) {
    rounded[order[i].index].amountMinor += 1;
    remainder -= 1;
  }
  return rounded.map(({ memberId, amountMinor, percentage }) => ({ memberId, amountMinor, percentage }));
}

export function splitByAmounts(
  totalMinor: number,
  inputs: SplitInput[],
): Array<{ memberId: string; amountMinor: number }> {
  const active = inputs.filter((input) => !input.excluded);
  const sum = active.reduce((acc, input) => acc + (input.amountMinor ?? 0), 0);
  if (sum !== totalMinor) {
    throw new Error("Los importes individuales deben sumar el total del gasto");
  }
  return active.map((input) => ({ memberId: input.memberId, amountMinor: input.amountMinor ?? 0 }));
}

export function splitExcluding(totalMinor: number, memberIds: string[], excludedIds: string[]) {
  const excluded = new Set(excludedIds);
  return splitEqually(totalMinor, memberIds.filter((id) => !excluded.has(id)));
}

export interface BalanceExpense {
  paidByMemberId: string;
  amountMinor: number;
  splits: Array<{ memberId: string; amountMinor: number }>;
}

export interface BalanceSettlement {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
}

export interface MemberBalance {
  memberId: string;
  paidMinor: number;
  owedMinor: number;
  netMinor: number;
}

export function computeBalances(
  memberIds: string[],
  expenses: BalanceExpense[],
  settlements: BalanceSettlement[] = [],
): MemberBalance[] {
  const map = new Map<string, MemberBalance>();
  for (const id of memberIds) {
    map.set(id, { memberId: id, paidMinor: 0, owedMinor: 0, netMinor: 0 });
  }
  const ensure = (id: string) => {
    if (!map.has(id)) map.set(id, { memberId: id, paidMinor: 0, owedMinor: 0, netMinor: 0 });
    return map.get(id)!;
  };
  for (const expense of expenses) {
    ensure(expense.paidByMemberId).paidMinor += expense.amountMinor;
    for (const split of expense.splits) {
      ensure(split.memberId).owedMinor += split.amountMinor;
    }
  }
  for (const settlement of settlements) {
    ensure(settlement.fromMemberId).paidMinor += settlement.amountMinor;
    ensure(settlement.toMemberId).owedMinor += settlement.amountMinor;
  }
  for (const balance of map.values()) {
    balance.netMinor = balance.paidMinor - balance.owedMinor;
  }
  return [...map.values()].sort((a, b) => b.netMinor - a.netMinor);
}

export interface Transfer {
  fromMemberId: string;
  toMemberId: string;
  amountMinor: number;
}

export function minimizeTransfers(balances: MemberBalance[]): Transfer[] {
  const creditors = balances.filter((b) => b.netMinor > 0).map((b) => ({ ...b }));
  const debtors = balances.filter((b) => b.netMinor < 0).map((b) => ({ ...b, netMinor: -b.netMinor }));
  creditors.sort((a, b) => b.netMinor - a.netMinor);
  debtors.sort((a, b) => b.netMinor - a.netMinor);
  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  let guard = 0;
  while (ci < creditors.length && di < debtors.length && guard < 1000) {
    const amount = Math.min(creditors[ci].netMinor, debtors[di].netMinor);
    if (amount > 0) {
      transfers.push({ fromMemberId: debtors[di].memberId, toMemberId: creditors[ci].memberId, amountMinor: amount });
    }
    creditors[ci].netMinor -= amount;
    debtors[di].netMinor -= amount;
    if (creditors[ci].netMinor === 0) ci += 1;
    if (debtors[di].netMinor === 0) di += 1;
    guard += 1;
  }
  return transfers;
}

export function savingsProjection(
  targetMinor: number,
  savedMinor: number,
  targetDate: string | null,
  today: string,
): { remainingMinor: number; percentage: number; monthlyNeededMinor: number | null; onTrack: boolean | null } {
  const remaining = Math.max(0, targetMinor - savedMinor);
  const pct = targetMinor > 0 ? Math.round((savedMinor / targetMinor) * 1000) / 10 : 0;
  if (!targetDate || targetDate <= today) {
    return { remainingMinor: remaining, percentage: pct, monthlyNeededMinor: null, onTrack: null };
  }
  const days = Math.max(1, daysBetween(today, targetDate));
  const months = Math.max(1, Math.ceil(days / 30.4375));
  return {
    remainingMinor: remaining,
    percentage: pct,
    monthlyNeededMinor: Math.ceil(remaining / months),
    onTrack: null,
  };
}

export function debtBalance(amountMinor: number, payments: number[]): number {
  return Math.max(0, amountMinor - payments.reduce((acc, value) => acc + value, 0));
}

export function monthlyEquivalentMinor(amountMinor: number, frequency: Frequency): number {
  switch (frequency) {
    case "daily":
      return amountMinor * 30;
    case "weekly":
      return Math.round((amountMinor * 52) / 12);
    case "biweekly":
      return Math.round((amountMinor * 26) / 12);
    case "monthly":
      return amountMinor;
    case "bimonthly":
      return Math.round(amountMinor / 2);
    case "quarterly":
      return Math.round(amountMinor / 3);
    case "semiannual":
      return Math.round(amountMinor / 6);
    case "yearly":
      return Math.round(amountMinor / 12);
    case "custom_days":
      return Math.round((amountMinor * 365) / 12);
    case "custom_months":
      return amountMinor;
  }
}

export function monthProgress(monthDate: string): { day: number; total: number } {
  return { day: Number(monthDate.slice(8, 10)), total: daysInMonth(monthDate) };
}
