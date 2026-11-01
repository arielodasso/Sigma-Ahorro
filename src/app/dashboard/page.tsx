import { getCurrentUser } from "@/lib/auth/session";
import { listBudgetViews } from "@/services/budgets";
import { listGoalViews } from "@/services/goals";
import { listDebts } from "@/services/debts";
import { listTransactions } from "@/services/transactions";
import { listRecurring } from "@/services/recurring";
import { listScheduled } from "@/services/scheduled";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return <p className="text-center text-muted-foreground mt-16">Creá tu cuenta para ver el dashboard</p>;
  }

  const [budgets, goals, debts, transactions, recurring, scheduled] = await Promise.all([
    listBudgetViews(user.id),
    listGoalViews(user.id),
    listDebts(user.id),
    listTransactions(user.id, { from: "2024-01-01", to: "2025-12-31", limit: 10 }),
    listRecurring(user.id),
    listScheduled(user.id),
  ]);

  // Compute daysUntil for scheduled payments
  const today = new Date().toISOString().slice(0, 10);
  const scheduledWithDays = scheduled.map((s) => {
    const dueDate = new Date(s.due_date);
    const todayDate = new Date(today);
    const diffDays = Math.ceil((dueDate.getTime() - todayDate.getTime()) / 86400000);
    return { ...s, daysUntil: diffDays };
  });

  // Compute debt progress
  const debtsWithProgress = debts.map((d) => {
    const progress = d.amount_minor > 0 ? Math.round((d.paid_minor / d.amount_minor) * 1000) / 10 : 0;
    return { ...d, progress };
  });

  return (
    <section className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Budget Summary */}
          <div className="bg-white/90 rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Presupuestos</h3>
            <ul className="list-disc pl-5">
              {budgets.map((b) => (
                <li key={b.id} className="mb-2">
                  {b.name}: {b.spent_minor} / {b.amount_minor} ({Math.round((b.spent_minor / b.amount_minor) * 100)}%)
                </li>
              ))}
            </ul>
          </div>

          {/* Goals Summary */}
          <div className="bg-white/90 rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Metas</h3>
            <ul className="list-disc pl-5">
              {goals.map((g) => (
                <li key={g.id} className="mb-2">
                  {g.name}: {g.saved_minor} / {g.target_minor}
                </li>
              ))}
            </ul>
          </div>

          {/* Debts Summary */}
          <div className="bg-white/90 rounded-xl p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Deudas</h3>
            <ul className="list-disc pl-5">
              {debtsWithProgress.map((d) => (
                <li key={d.id} className="mb-2">
                  {d.counterparty}: ${(d.balance_minor / 1000000).toFixed(2)} ({d.progress}%)
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <div>
            <h3 className="font-semibold mb-4">Ultimas transacciones</h3>
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {transactions.map((t) => (
                <li key={t.id} className="flex items-center justify-between p-2 rounded bg-gray-50">
                  <span className="font-medium">{t.description}</span>
                  <span className="text-primary">
                    {t.type === "expense" ? "-" : "+"} {(t.base_amount_minor ?? 0) / 1000000}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Scheduled Payments */}
          <div>
            <h3 className="font-semibold mb-4">Pagos programados</h3>
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {scheduledWithDays.map((s) => (
                <li key={s.id} className="flex items-center justify-between p-2 rounded bg-primary/10">
                  <span>{s.name}</span>
                  <span>{s.daysUntil} días</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Recurring Transactions */}
        <div className="mt-8 p-6 bg-white/90 rounded-xl">
          <h3 className="font-semibold mb-4">Récurrencias activas</h3>
          <p className="text-gray-600">
            {recurring.length} récurrencias configuradas
          </p>
        </div>
      </div>
    </section>
  );
}