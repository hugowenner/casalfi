import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDashboardData, getCoupleDashboardData } from "@/services/transaction.service";
import { getCurrentMonth } from "@/lib/format";
import { DashboardView } from "@/components/features/dashboard/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, avatar: true, coupleId: true },
  });

  const month = getCurrentMonth();

  // Dados pessoais (só minhas transações)
  const personalData = await getDashboardData(session.userId, null, month);

  // Dados do casal (se casal ativo)
  let coupleData = null;
  let partnerName: string | null = null;

  if (user?.coupleId) {
    const couple = await db.couple.findUnique({
      where: { id: user.coupleId },
      include: {
        partner1: { select: { id: true, name: true, avatar: true } },
        partner2: { select: { id: true, name: true, avatar: true } },
      },
    });

    if (couple?.status === "active" && couple.partner2) {
      const partner =
        couple.partner1Id === session.userId ? couple.partner2 : couple.partner1;

      partnerName = partner.name;

      coupleData = await getCoupleDashboardData(
        session.userId,
        user.coupleId,
        month,
        { id: user.id, name: user.name ?? session.name, avatar: user.avatar ?? null },
        { id: partner.id, name: partner.name, avatar: partner.avatar ?? null }
      );
    }
  }

  return (
    <DashboardView
      personalData={personalData}
      coupleData={coupleData}
      userName={session.name}
      partnerName={partnerName}
      month={month}
    />
  );
}
