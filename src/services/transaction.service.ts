import { db } from "@/lib/db";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from "date-fns";
import type { TransactionInput } from "@/validators/transaction";
import type {
  TransactionWithRelations,
  DashboardData,
  CoupleDashboardData,
  CategoryStat,
  DailySpending,
  TransactionFilters,
} from "@/types";

// ── CRUD ──────────────────────────────────────────────────────────────────

interface TransactionMeta {
  source?: string;
  rawInput?: string;
  aiCategory?: string;
  aiConfidence?: number;
}

export async function createTransaction(
  userId: string,
  coupleId: string | null,
  input: TransactionInput,
  meta?: TransactionMeta
): Promise<TransactionWithRelations> {
  // Interpretar a data como horário local (meio-dia) para evitar deslocamento de fuso
  const [y, mo, d] = input.date.split("-").map(Number);
  const date = new Date(y, mo - 1, d, 12, 0, 0);
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
        source: meta?.source ?? "manual",
        rawInput: meta?.rawInput,
        aiCategory: meta?.aiCategory,
        aiConfidence: meta?.aiConfidence,
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

export async function updateTransactionAmount(
  id: string,
  userId: string,
  newAmount: number
): Promise<void> {
  const transaction = await db.transaction.findFirst({
    where: { id, userId },
  });
  if (!transaction) throw new Error("Transação não encontrada");

  const diff = newAmount - transaction.amount;

  await db.$transaction(async (tx) => {
    await tx.transaction.update({ where: { id }, data: { amount: newAmount } });

    if (transaction.accountId && diff !== 0) {
      const delta = transaction.type === "income" ? diff : -diff;
      await tx.account.update({
        where: { id: transaction.accountId },
        data: { balance: { increment: delta } },
      });
    }

    if (transaction.cardId && transaction.type === "expense" && diff !== 0) {
      await tx.card.update({
        where: { id: transaction.cardId },
        data: { availableLimit: { increment: -diff } },
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

// ── DASHBOARD DO CASAL ────────────────────────────────────────────────────

export async function getCoupleDashboardData(
  myId: string,
  coupleId: string,
  month: string,
  myInfo: { id: string; name: string; avatar: string | null },
  partnerInfo: { id: string; name: string; avatar: string | null }
): Promise<CoupleDashboardData> {
  const start = startOfMonth(parseISO(`${month}-01`));
  const end = endOfMonth(parseISO(`${month}-01`));

  // Todas as transações do casal no mês
  const transactions = await db.transaction.findMany({
    where: { coupleId, date: { gte: start, lte: end } },
    include: {
      category: true,
      account: true,
      card: true,
      user: { select: { id: true, name: true, avatar: true } },
    },
    orderBy: { date: "desc" },
  });

  // Saldo das contas de ambos
  const [myAccounts, partnerAccounts] = await Promise.all([
    db.account.findMany({ where: { userId: myId } }),
    db.account.findMany({ where: { userId: partnerInfo.id } }),
  ]);

  const myBalance = myAccounts.reduce((s, a) => s + a.balance, 0);
  const partnerBalance = partnerAccounts.reduce((s, a) => s + a.balance, 0);
  const combinedBalance = myBalance + partnerBalance;

  // Stats por pessoa
  let totalIncome = 0;
  let totalExpense = 0;
  let myIncome = 0;
  let myExpense = 0;
  let partnerIncome = 0;
  let partnerExpense = 0;

  for (const t of transactions) {
    if (t.type === "income") {
      totalIncome += t.amount;
      if (t.userId === myId) myIncome += t.amount;
      else partnerIncome += t.amount;
    }
    if (t.type === "expense") {
      totalExpense += t.amount;
      if (t.userId === myId) myExpense += t.amount;
      else partnerExpense += t.amount;
    }
  }

  const savingsRate =
    totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

  // Split: cada um deveria pagar metade do total
  const halfExpense = totalExpense / 2;
  const diff = myExpense - halfExpense; // positivo = parceiro me deve; negativo = eu devo
  const owedAmount = Math.abs(diff);
  const balanced = owedAmount < 0.01;

  // Categorias (casal inteiro)
  const categoryMap = new Map<string, CategoryStat>();
  const expenseTotal = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

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
    const dayTxs = transactions.filter(
      (t) => format(t.date, "yyyy-MM-dd") === dayStr
    );
    return {
      day: format(day, "dd"),
      date: dayStr,
      income: dayTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
      expense: dayTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
    };
  });

  return {
    combinedBalance,
    totalIncome,
    totalExpense,
    savingsRate,
    me: {
      userId: myId,
      name: myInfo.name,
      avatar: myInfo.avatar,
      totalIncome: myIncome,
      totalExpense: myExpense,
      accountsBalance: myBalance,
    },
    partner: {
      userId: partnerInfo.id,
      name: partnerInfo.name,
      avatar: partnerInfo.avatar,
      totalIncome: partnerIncome,
      totalExpense: partnerExpense,
      accountsBalance: partnerBalance,
    },
    splitSummary: {
      totalExpense,
      myExpense,
      partnerExpense,
      owedAmount,
      iOwe: diff < 0,
      balanced,
      myName: myInfo.name.split(" ")[0],
      partnerName: partnerInfo.name.split(" ")[0],
    },
    categoryStats,
    dailyChart,
    recentTransactions: (transactions as TransactionWithRelations[]).slice(0, 10),
  };
}
