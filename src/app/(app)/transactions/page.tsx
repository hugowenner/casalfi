import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { listTransactions } from "@/services/transaction.service";
import { getCurrentMonth } from "@/lib/format";
import { TransactionsView } from "@/components/features/transactions/transactions-view";

export const metadata: Metadata = { title: "Lançamentos" };

export default async function TransactionsPage() {
  const session = await getSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { coupleId: true },
  });

  const categories = await db.category.findMany({
    where: { OR: [{ userId: session.userId }, { coupleId: user?.coupleId ?? undefined }] },
    orderBy: { name: "asc" },
  });

  const transactions = await listTransactions(
    session.userId,
    user?.coupleId ?? null,
    { month: getCurrentMonth(), type: "all" }
  );

  return (
    <TransactionsView
      initialTransactions={transactions}
      categories={categories}
      userId={session.userId}
    />
  );
}
