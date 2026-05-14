import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccountsView } from "@/components/features/accounts/accounts-view";

export const metadata: Metadata = { title: "Contas" };

export default async function AccountsPage() {
  const session = await getSession();
  if (!session) return null;

  const [accounts, cards] = await Promise.all([
    db.account.findMany({
      where: { userId: session.userId },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    db.card.findMany({
      where: { userId: session.userId },
      orderBy: { name: "asc" },
    }),
  ]);

  return <AccountsView accounts={accounts} cards={cards} />;
}
