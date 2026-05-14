"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateInviteCode } from "@/lib/utils";
import type { ActionResult, CoupleWithPartners } from "@/types";

// ── Criar casal e gerar convite ───────────────────────────────────────────

export async function createCoupleAction(): Promise<
  ActionResult<{ inviteCode: string }>
> {
  const session = await requireAuth();

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (user?.coupleId) {
    return { success: false, error: "Você já está em um casal" };
  }

  const inviteCode = generateInviteCode();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dias

  const couple = await db.couple.create({
    data: {
      partner1Id: session.userId,
      inviteCode,
      status: "pending",
      invites: {
        create: {
          inviterId: session.userId,
          code: inviteCode,
          expiresAt,
        },
      },
    },
  });

  await db.user.update({
    where: { id: session.userId },
    data: { coupleId: couple.id },
  });

  revalidatePath("/couple");
  return { success: true, data: { inviteCode } };
}

// ── Aceitar convite ───────────────────────────────────────────────────────

export async function joinCoupleAction(
  code: string
): Promise<ActionResult<CoupleWithPartners>> {
  const session = await requireAuth();

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { couple: true },
  });

  // Bloquear apenas se já está em casal ATIVO
  if (user?.coupleId && user.couple?.status === "active") {
    return { success: false, error: "Você já está em um casal ativo" };
  }

  // Se tem casal pendente onde é o partner1 (criou e ninguém entrou), abandonar para entrar no do parceiro
  if (
    user?.coupleId &&
    user.couple?.status === "pending" &&
    user.couple.partner1Id === session.userId
  ) {
    await db.coupleInvite.deleteMany({ where: { coupleId: user.coupleId } });
    await db.couple.delete({ where: { id: user.coupleId } });
    await db.user.update({
      where: { id: session.userId },
      data: { coupleId: null },
    });
  }

  const invite = await db.coupleInvite.findUnique({ where: { code } });
  if (!invite) return { success: false, error: "Código inválido" };
  if (invite.status !== "pending") return { success: false, error: "Convite expirado ou já usado" };
  if (invite.expiresAt < new Date()) return { success: false, error: "Convite expirado" };
  if (invite.inviterId === session.userId) {
    return { success: false, error: "Você não pode aceitar seu próprio convite" };
  }

  const couple = await db.$transaction(async (tx) => {
    const updated = await tx.couple.update({
      where: { id: invite.coupleId },
      data: {
        partner2Id: session.userId,
        status: "active",
      },
      include: {
        partner1: { select: { id: true, name: true, email: true, avatar: true } },
        partner2: { select: { id: true, name: true, email: true, avatar: true } },
      },
    });

    await tx.coupleInvite.update({
      where: { id: invite.id },
      data: { status: "accepted", inviteeId: session.userId },
    });

    await tx.user.update({
      where: { id: session.userId },
      data: { coupleId: invite.coupleId },
    });

    return updated;
  });

  revalidatePath("/couple");
  revalidatePath("/dashboard");
  return { success: true, data: couple as CoupleWithPartners };
}

// ── Buscar dados do casal ─────────────────────────────────────────────────

export async function getCoupleAction(): Promise<
  ActionResult<CoupleWithPartners | null>
> {
  const session = await requireAuth();

  const user = await db.user.findUnique({ where: { id: session.userId } });
  if (!user?.coupleId) return { success: true, data: null };

  const couple = await db.couple.findUnique({
    where: { id: user.coupleId },
    include: {
      partner1: { select: { id: true, name: true, email: true, avatar: true } },
      partner2: { select: { id: true, name: true, email: true, avatar: true } },
    },
  });

  return { success: true, data: couple as CoupleWithPartners };
}
