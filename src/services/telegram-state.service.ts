// Estado da conversa persistido no banco — necessário em Vercel serverless
// (instâncias são destruídas após cada resposta, memória não sobrevive).
//
// TTL de 5 minutos: se o usuário não responder, o estado expira
// e o bot volta ao modo normal automaticamente.

import { db } from "@/lib/db";

export const ConversationState = {
  IDLE: "IDLE",
  WAITING_AMOUNT: "WAITING_AMOUNT",       // Categoria escolhida, aguardando valor
  WAITING_EDIT_AMOUNT: "WAITING_EDIT_AMOUNT", // Transação selecionada, aguardando novo valor
} as const;

export type ConversationState = (typeof ConversationState)[keyof typeof ConversationState];

interface StateData {
  state: ConversationState;
  category?: string;
  transactionType?: "income" | "expense";
  txId?: string;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000;

export async function getState(userId: string): Promise<StateData | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { telegramState: true },
  });

  if (!user?.telegramState) return null;

  try {
    const data = JSON.parse(user.telegramState) as StateData;
    if (data.expiresAt < Date.now()) {
      await clearState(userId);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export async function setState(
  userId: string,
  state: ConversationState,
  extra?: Partial<Pick<StateData, "category" | "transactionType" | "txId">>
): Promise<void> {
  const data: StateData = { state, expiresAt: Date.now() + TTL_MS, ...extra };
  await db.user.update({
    where: { id: userId },
    data: { telegramState: JSON.stringify(data) },
  });
}

export async function clearState(userId: string): Promise<void> {
  await db.user.update({
    where: { id: userId },
    data: { telegramState: null },
  });
}
