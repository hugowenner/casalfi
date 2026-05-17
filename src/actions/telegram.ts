"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ActionResult } from "@/types";

// ── generateTelegramLinkToken ─────────────────────────────────────────────
// Gera um código de 6 chars maiúsculos para vincular o Telegram.
// Token válido por 10 minutos. Reemite se chamado novamente.

export async function generateTelegramLinkTokenAction(): Promise<
  ActionResult<{ token: string; botName: string }>
> {
  const session = await requireAuth();

  // Gera 6 chars alfanuméricos maiúsculos (base-36, remove ambíguos 0/O/I/L)
  const token = Array.from({ length: 6 }, () =>
    "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 31)]
  ).join("");

  await db.user.update({
    where: { id: session.userId },
    data: {
      telegramLinkToken: token,
      telegramLinkAt: new Date(),
    },
  });

  revalidatePath("/settings");

  const botName = process.env.TELEGRAM_BOT_NAME ?? "casalfi_bot";
  return { success: true, data: { token, botName } };
}

// ── unlinkTelegramAction ──────────────────────────────────────────────────
// Remove a vinculação Telegram do usuário.

export async function unlinkTelegramAction(): Promise<ActionResult> {
  const session = await requireAuth();

  await db.user.update({
    where: { id: session.userId },
    data: {
      telegramId: null,
      telegramLinkToken: null,
      telegramLinkAt: null,
    },
  });

  revalidatePath("/settings");
  return { success: true, data: undefined };
}
