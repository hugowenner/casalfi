import { db } from "@/lib/db";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import type { TransactionInput } from "@/validators/transaction";
import type {
  TransactionWithRelations,
  DashboardData,
  CategoryStat,
  DailySpending,
  TransactionFilters,
} from "@/types";

// ── CRUD ──────────────────────────────────────────────────────────────────

export async function createTransaction(
  userId: string,
  coupleId: string | null,
  input: TransactionInput
): Promise<TransactionWithRelations> {
  const date = parseISO(input.date);
  const paidByUserId = input.paidByUserId ?? userId;

  const tx = await db.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        userId,
        coupleId,
        description: input.description,
        amount: input.amount,
        type: input.type,
        date,
        categoryId: input.categoryId,
        accountId: input.accountId,
        cardId: input.cardId,
        splitType: input.splitType,
        paidByUserId,
        notes: input.notes,
        isRecurring: input.isRecurring,
        recurringPeriod: input.recurringPeriod,
        installmentTotal: input.installmentTotal,
        installmentNum: input.installmentTotal ? 1 : undefined,
      },
      include: {
        category: true,
        account: true,
        card: true,
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    // Atualizar saldo da conta
    if (input.accountId) {
      const delta =
        input.type === "income" ? input.amount : -input.amount;
      await tx.account.update({
        where: { id: input.accountId },
        data: { balance: { increment: delta } },
      });
    }

    // Atualizar limite do cartão
    if (input.cardId && input.type === "expense") {
      await tx.card.update({
        where: { id: input.cardId },
        data: { availableLimit: { decrement: input.amount } },
      });
    }

    return transaction;
  });

  return tx as TransactionWithRelations;
}

export async function deleteTransaction(
  id: string,
  userId: string
): Promise<void> {
  const transaction = await db.transaction.findFirst({
    where: { id, userId },
  });
  if (!transaction) throw new Error("Transação não encontrada");

  await db.$transaction(async (tx) => {
    await tx.transaction.delete({ where: { id } });

    // Reverter saldo da conta
    if (transaction.accountId) {
      const delta =
        transaction.type === "income"
          ? -transaction.amount
          : transaction.amount;
      await tx.account.update({
        where: { id: transaction.accountId },
        data: { balance: { increment: delta } },
      });
    }

    // Reverter limite do cartão
    if (transaction.cardId && transaction.type === "expense") {
      await tx.card.update({
        where: { id: transaction.cardId },
        data: { availableLimit: { increment: transaction.amount } },
      });
    }
  });
}

// ── LISTAGEM ──────────────────────────────────────────────────────────────

export async function listTransactions(
  userId: string,
  coupleId: string | null,
  filters: TransactionFilters
): Promise<TransactionWithRelations[]> {
  const { month, type, categoryId, search } = filters;

  const where: Record<string, unknown> = {
    OR: [
      { userId },
      ...(coupleId ? [{ coupleId }] : []),
    ],
  };

  if (month) {
    const start = startOfMonth(parseISO(`${month}-01`));
    const end = endOfMonth(parseISO(`${month}-01`));
    where.date = { gte: start, lte: end };
  }

  if (type && type !== "all") where.type = type;
  if (categoryId) where.categoryId = categoryId;
  if (search) where.description = { contains: search, mode: "insensitive" };

  const transactions = await db.transaction.findMany({
    where,
    include: {
      category: true,
      account: true,
      card: true,
      user: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { date: "desc" },
    take: 200,
  });

  return transactions as TransactionWithRelations[];
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────

export async function getDashboardData(
  userId: string,
  coupleId: string | null,
  month: string
): Promise<DashboardData> {
  const start = startOfMonth(parseISO(`${month}-01`));
  const end = endOfMonth(parseISO(`${month}-01`));

  const where = {
    OR: [{ userId }, ...(coupleId ? [{ coupleId }] : [])],
    date: { gte: start, lte: end },
  };

  // Buscar todas as transações do mês
  const transactions = await db.transaction.findMany({
    where,
    include: {
      category: true,
      account: true,
      card: true,
      user: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { date: "desc" },
  });

  // Calcular stats
  let monthIncome = 0;
  let monthExpense = 0;

  for (const t of transactions) {
    if (t.type === "income") monthIncome += t.amount;
    if (t.type === "expense") monthExpense += t.amount;
  }

  // Saldo total das contas
  const accounts = await db.account.findMany({ where: { userId } });
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  const savingsRate =
    monthIncome > 0
      ? ((monthIncome - monthExpense) / monthIncome) * 100
      : 0;

  // Stats por categoria
  const categoryMap = new Map<string, CategoryStat>();
  const expenseTotal = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  for (const t of transactions) {
    if (t.type !== "expense" || !t.category) continue;
    const key = t.categoryId ?? "sem-categoria";
    if (!categoryMap.has(key)) {
      categoryMap.set(key, {
        categoryId: key,
        name: t.category.name,
        icon: t.category.icon,
        color: t.category.color,
        total: 0,
        percentage: 0,
        count: 0,
      });
    }
    const stat = categoryMap.get(key)!;
    stat.total += t.amount;
    stat.count += 1;
  }

  const categoryStats = Array.from(categoryMap.values())
    .map((s) => ({
      ...s,
      percentage: expenseTotal > 0 ? (s.total / expenseTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 6);

  // Gráfico diário
  const days = eachDayOfInterval({ start, end });
  const dailyChart: DailySpending[] = days.map((day) => {
    const dayStr = format(day, "yyyy-MM-dd");
    const dayTransactions = transactions.filter(
      (t) => format(t.date, "yyyy-MM-dd") === dayStr
    );
    return {
      day: format(day, "dd"),
      date: dayStr,
      income: dayTransactions
        .filter((t) => t.type === "income")
        .reduce((s, t) => s + t.amount, 0),
      expense: dayTransactions
        .filter((t) => t.type === "expense")
        .reduce((s, t) => s + t.amount, 0),
    };
  });

  return {
    stats: { totalBalance, monthIncome, monthExpense, savingsRate },
    categoryStats,
    dailyChart,
    recentTransactions: (transactions as TransactionWithRelations[]).slice(0, 10),
  };
}
