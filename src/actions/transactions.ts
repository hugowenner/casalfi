"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  createTransaction,
  deleteTransaction,
} from "@/services/transaction.service";
import { transactionSchema } from "@/validators/transaction";
import type { ActionResult, TransactionWithRelations } from "@/types";

async function getUserCoupleId(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { coupleId: true },
  });
  return user?.coupleId ?? null;
}

// ── Criar transação ───────────────────────────────────────────────────────

export async function createTransactionAction(
  data: unknown
): Promise<ActionResult<TransactionWithRelations>> {
  const session = await requireAuth();

  const parsed = transactionSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message };
  }

  try {
    const coupleId = await getUserCoupleId(session.userId);
    const transaction = await createTransaction(
      session.userId,
      coupleId,
      parsed.data
    );

    revalidatePath("/dashboard");
    revalidatePath("/transactions");

    return { success: true, data: transaction };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao criar transação",
    };
  }
}

// ── Deletar transação ─────────────────────────────────────────────────────

export async function deleteTransactionAction(
  id: string
): Promise<ActionResult> {
  const session = await requireAuth();

  try {
    await deleteTransaction(id, session.userId);
    revalidatePath("/dashboard");
    revalidatePath("/transactions");
    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erro ao deletar",
    };
  }
}
