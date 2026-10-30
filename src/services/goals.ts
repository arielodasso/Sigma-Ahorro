import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { savingsProjection } from "@/lib/finance";
import { todayISO } from "@/lib/dates";
import { logAudit } from "@/lib/audit";
import type { SavingsContribution, SavingsGoal, SavingsGoalWithProgress } from "@/types";

export interface GoalInputData {
  name: string;
  targetMinor: number;
  currency: string;
  targetDate?: string | null;
  notes?: string | null;
}

export interface GoalView extends SavingsGoalWithProgress {
  percentage: number;
  remainingMinor: number;
  monthlyNeededMinor: number | null;
  daysLeft: number | null;
  onTrack: boolean | null;
}

export async function listGoals(userId: string, includeArchived = false): Promise<SavingsGoal[]> {
  const db = await getDb();
  const where = includeArchived ? "" : " AND archived = 0";
  return db.all<SavingsGoal>(`SELECT * FROM savings_goals WHERE user_id = ?${where} ORDER BY created_at DESC`, [userId]);
}

export async function listGoalViews(userId: string, today = todayISO()): Promise<GoalView[]> {
  const db = await getDb();
  const goals = await listGoals(userId);
  const result: GoalView[] = [];
  for (const goal of goals) {
    const row = await db.get<{ saved: number | string | null; count: number | string }>(
      `SELECT SUM(CASE WHEN kind = 'contribution' THEN amount_minor ELSE -amount_minor END) AS saved,
       COUNT(*) AS count FROM savings_contributions WHERE goal_id = ? AND user_id = ?`,
      [goal.id, userId],
    );
    const saved = Math.max(0, Number(row?.saved ?? 0));
    const projection = savingsProjection(goal.target_minor, saved, goal.target_date, today);
    const daysLeft = goal.target_date
      ? Math.max(0, Math.ceil((Date.parse(goal.target_date) - Date.parse(today)) / 86_400_000))
      : null;
    result.push({
      ...goal,
      saved_minor: saved,
      contributions_count: Number(row?.count ?? 0),
      percentage: projection.percentage,
      remainingMinor: projection.remainingMinor,
      monthlyNeededMinor: projection.monthlyNeededMinor,
      daysLeft,
      onTrack: projection.onTrack,
    });
  }
  return result;
}

export async function getGoal(userId: string, goalId: string): Promise<SavingsGoal | null> {
  const db = await getDb();
  return (
    (await db.get<SavingsGoal>("SELECT * FROM savings_goals WHERE id = ? AND user_id = ?", [goalId, userId])) ?? null
  );
}

export async function createGoal(userId: string, input: GoalInputData): Promise<SavingsGoal> {
  const db = await getDb();
  const goal: SavingsGoal = {
    id: randomUUID(),
    user_id: userId,
    name: input.name.trim(),
    target_minor: Math.abs(input.targetMinor),
    currency: input.currency as SavingsGoal["currency"],
    target_date: input.targetDate ?? null,
    notes: input.notes?.trim() || null,
    archived: 0,
    created_at: new Date().toISOString(),
  };
  await db.run(
    "INSERT INTO savings_goals (id, user_id, name, target_minor, currency, target_date, notes, archived, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)",
    [goal.id, goal.user_id, goal.name, goal.target_minor, goal.currency, goal.target_date, goal.notes, goal.created_at],
  );
  await logAudit(userId, "create", "savings_goal", goal.id);
  return goal;
}

export async function updateGoal(
  userId: string,
  goalId: string,
  input: Partial<GoalInputData> & { archived?: boolean },
): Promise<void> {
  const db = await getDb();
  const current = await getGoal(userId, goalId);
  if (!current) throw new Error("Meta no encontrada");
  await db.run(
    "UPDATE savings_goals SET name = ?, target_minor = ?, currency = ?, target_date = ?, notes = ?, archived = ? WHERE id = ? AND user_id = ?",
    [
      input.name?.trim() || current.name,
      input.targetMinor !== undefined ? Math.abs(input.targetMinor) : current.target_minor,
      input.currency ?? current.currency,
      input.targetDate === undefined ? current.target_date : input.targetDate,
      input.notes === undefined ? current.notes : input.notes?.trim() || null,
      input.archived === undefined ? current.archived : input.archived ? 1 : 0,
      goalId,
      userId,
    ],
  );
  await logAudit(userId, "update", "savings_goal", goalId);
}

export async function deleteGoal(userId: string, goalId: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM savings_goals WHERE id = ? AND user_id = ?", [goalId, userId]);
  await logAudit(userId, "delete", "savings_goal", goalId);
}

export async function addContribution(
  userId: string,
  input: { goalId: string; amountMinor: number; kind: "contribution" | "withdrawal"; occurredAt: string; note?: string | null },
): Promise<SavingsContribution> {
  const db = await getDb();
  const goal = await getGoal(userId, input.goalId);
  if (!goal) throw new Error("Meta no encontrada");
  const contribution: SavingsContribution = {
    id: randomUUID(),
    goal_id: input.goalId,
    user_id: userId,
    amount_minor: Math.abs(input.amountMinor),
    kind: input.kind,
    occurred_at: input.occurredAt,
    note: input.note?.trim() || null,
    created_at: new Date().toISOString(),
  };
  await db.run(
    "INSERT INTO savings_contributions (id, goal_id, user_id, amount_minor, kind, occurred_at, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [
      contribution.id,
      contribution.goal_id,
      contribution.user_id,
      contribution.amount_minor,
      contribution.kind,
      contribution.occurred_at,
      contribution.note,
      contribution.created_at,
    ],
  );
  await logAudit(userId, "contribute", "savings_goal", input.goalId, { kind: input.kind });
  return contribution;
}

export async function listContributions(userId: string, goalId: string): Promise<SavingsContribution[]> {
  const db = await getDb();
  return db.all<SavingsContribution>(
    "SELECT * FROM savings_contributions WHERE goal_id = ? AND user_id = ? ORDER BY occurred_at DESC, created_at DESC",
    [goalId, userId],
  );
}

export async function deleteContribution(userId: string, contributionId: string): Promise<void> {
  const db = await getDb();
  await db.run("DELETE FROM savings_contributions WHERE id = ? AND user_id = ?", [contributionId, userId]);
}
