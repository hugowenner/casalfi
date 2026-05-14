import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDashboardData } from "@/services/transaction.service";
import { getCurrentMonth } from "@/lib/format";
import { DashboardView } from "@/components/features/dashboard/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, coupleId: true },
  });

  const month = getCurrentMonth();
  const data = await getDashboardData(session.userId, user?.coupleId ?? null, month);

  return <DashboardView data={data} userName={session.name} month={month} />;
}
