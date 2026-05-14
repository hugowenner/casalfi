import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { CoupleView } from "@/components/features/couple/couple-view";

export const metadata: Metadata = { title: "Casal" };

export default async function CouplePage() {
  const session = await getSession();
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { coupleId: true },
  });

  let couple = null;
  if (user?.coupleId) {
    couple = await db.couple.findUnique({
      where: { id: user.coupleId },
      include: {
        partner1: { select: { id: true, name: true, email: true, avatar: true } },
        partner2: { select: { id: true, name: true, email: true, avatar: true } },
        invites: {
          where: { status: "pending" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });
  }

  return (
    <CoupleView couple={couple as never} userId={session.userId} />
  );
}
