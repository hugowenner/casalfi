// Orquestrador da integração Telegram.
// Recebe um TelegramUpdate e decide o que fazer:
//   - /start, /ajuda → mensagem de boas-vindas
//   - /vincular CODIGO → vincula conta
//   - /resumo → resumo do mês atual
//   - /ultimas → últimas 5 transações
//   - /desfazer → confirmação de exclusão (via teclado inline)
//   - callback_query → ações dos botões inline
//   - texto livre → parseia com IA e cria transação
// Nunca acessa o Prisma diretamente — delega para os services especializados.

import { db } from "@/lib/db";
import {
  sendTelegramMessage,
  sendWithKeyboard,
  editMessageText,
  answerCallbackQuery,
} from "@/services/telegram.service";
import { parseTransactionFromText } from "@/services/ai-transaction-parser.service";
import { createTransaction, deleteTransaction } from "@/services/transaction.service";
import { afterTransactionKeyboard, confirmDeleteKeyboard, emptyKeyboard } from "@/services/telegram-keyboards";
import { formatCurrency } from "@/lib/format";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TelegramUpdate } from "@/types/telegram";
import type { TransactionInput } from "@/validators/transaction";

// ── handleTelegramUpdate ──────────────────────────────────────────────────

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  // ── Callback query (clique em botão inline) ────────────────────────────
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query);
    return;
  }

  const msg = update.message;

  if (!msg?.text || !msg.from) return;
  if (msg.from.is_bot) return;

  if (msg.chat.type !== "private") {
    await sendTelegramMessage(
      msg.chat.id,
      "⚠️ Por segurança, só respondo em conversas privadas."
    );
    return;
  }

  const chatId = msg.chat.id;
  const telegramUserId = msg.from.id;
  const text = msg.text.trim();

  // ── Roteamento de comandos ─────────────────────────────────────────────

  if (text.startsWith("/start")) {
    await handleStart(chatId);
    return;
  }

  if (text.startsWith("/ajuda") || text.startsWith("/help")) {
    await handleHelp(chatId);
    return;
  }

  if (text.startsWith("/vincular")) {
    const parts = text.split(" ");
    const token = parts[1]?.toUpperCase();
    await handleVincular(chatId, telegramUserId, token);
    return;
  }

  if (text.startsWith("/resumo")) {
    await handleResumo(chatId, telegramUserId);
    return;
  }

  if (text.startsWith("/ultimas")) {
    await handleUltimas(chatId, telegramUserId);
    return;
  }

  if (text.startsWith("/desfazer") || isDeleteIntent(text)) {
    await handleDesfazer(chatId, telegramUserId);
    return;
  }

  // ── Criar transação via IA ─────────────────────────────────────────────

  await handleTransactionMessage(chatId, telegramUserId, text);
}

// ── handleCallbackQuery ───────────────────────────────────────────────────

async function handleCallbackQuery(
  cq: NonNullable<TelegramUpdate["callback_query"]>
): Promise<void> {
  const data = cq.data ?? "";
  const chatId = cq.message?.chat.id;
  const messageId = cq.message?.message_id;
  const telegramUserId = cq.from.id;

  // Sempre responde ao callback para remover o "loading" no botão
  await answerCallbackQuery(cq.id);

  if (!chatId) return;

  // ── undo_confirm:txId — usuário clicou em "↩️ Desfazer" após transação ─

  if (data.startsWith("undo_confirm:")) {
    const txId = data.split(":")[1];
    await handleUndoConfirm(chatId, messageId, telegramUserId, txId);
    return;
  }

  // ── do_delete:txId — usuário confirmou a exclusão ─────────────────────

  if (data.startsWith("do_delete:")) {
    const txId = data.split(":")[1];
    await handleDoDelete(chatId, messageId, telegramUserId, txId);
    return;
  }

  // ── cancel_delete — usuário cancelou ──────────────────────────────────

  if (data === "cancel_delete") {
    if (messageId) {
      await editMessageText(
        chatId,
        messageId,
        `✋ *Operação cancelada.*\n\nA transação foi mantida.`,
        emptyKeyboard
      );
    }
    return;
  }

  // ── show_summary — atalho para o resumo mensal ─────────────────────────

  if (data === "show_summary") {
    await handleResumo(chatId, telegramUserId);
    return;
  }
}

// ── handleUndoConfirm ─────────────────────────────────────────────────────
// Usuário clicou "↩️ Desfazer" na mensagem de confirmação de transação.
// Edita a mensagem para mostrar o diálogo de confirmação de exclusão.

async function handleUndoConfirm(
  chatId: number,
  messageId: number | undefined,
  telegramUserId: number,
  txId: string
): Promise<void> {
  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true },
  });
  if (!user) return;

  const tx = await db.transaction.findFirst({
    where: { id: txId, userId: user.id },
    select: { id: true, description: true, amount: true, type: true },
  });

  if (!tx) {
    await sendTelegramMessage(chatId, `❌ Transação não encontrada ou já removida.`);
    return;
  }

  const emoji = tx.type === "expense" ? "💸" : "💰";
  const confirmText =
    `⚠️ *Deseja remover esta transação?*\n\n` +
    `${emoji} ${formatCurrency(tx.amount)} — ${tx.description}`;

  if (messageId) {
    await editMessageText(chatId, messageId, confirmText, confirmDeleteKeyboard(tx.id));
  } else {
    await sendWithKeyboard(chatId, confirmText, confirmDeleteKeyboard(tx.id));
  }
}

// ── handleDoDelete ────────────────────────────────────────────────────────
// Usuário confirmou "✅ Confirmar" no diálogo de exclusão.

async function handleDoDelete(
  chatId: number,
  messageId: number | undefined,
  telegramUserId: number,
  txId: string
): Promise<void> {
  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true },
  });
  if (!user) return;

  const tx = await db.transaction.findFirst({
    where: { id: txId, userId: user.id },
    select: { id: true, description: true, amount: true, type: true },
  });

  if (!tx) {
    const notFound = `❌ Transação não encontrada ou já removida.`;
    if (messageId) {
      await editMessageText(chatId, messageId, notFound, emptyKeyboard);
    } else {
      await sendTelegramMessage(chatId, notFound);
    }
    return;
  }

  try {
    await deleteTransaction(tx.id, user.id);
    const emoji = tx.type === "expense" ? "💸" : "💰";
    const doneText =
      `✅ *Transação removida!*\n\n` +
      `${emoji} ${formatCurrency(tx.amount)} — ${tx.description}`;

    if (messageId) {
      await editMessageText(chatId, messageId, doneText, emptyKeyboard);
    } else {
      await sendTelegramMessage(chatId, doneText);
    }
  } catch {
    const errText = `❌ Não foi possível remover a transação.`;
    if (messageId) {
      await editMessageText(chatId, messageId, errText, emptyKeyboard);
    } else {
      await sendTelegramMessage(chatId, errText);
    }
  }
}

// ── Handlers individuais ──────────────────────────────────────────────────

async function handleStart(chatId: number): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `👋 *Bem-vindo ao CASALFI!*\n\n` +
    `Eu registro seus gastos e receitas automaticamente.\n\n` +
    `*Para começar:*\n` +
    `1. Abra o app CASALFI → Configurações\n` +
    `2. Clique em "Gerar código Telegram"\n` +
    `3. Envie aqui: \`/vincular SEU_CODIGO\`\n\n` +
    `Depois é só mandar mensagens como:\n` +
    `• "gastei 80 no mercado"\n` +
    `• "uber 25"\n` +
    `• "recebi 3000 salário"\n\n` +
    `Use /ajuda para ver todos os comandos.`
  );
}

async function handleHelp(chatId: number): Promise<void> {
  await sendTelegramMessage(
    chatId,
    `*Comandos disponíveis:*\n\n` +
    `/vincular CODIGO — vincula sua conta\n` +
    `/resumo — resumo de gastos do mês\n` +
    `/ultimas — últimas 5 transações\n` +
    `/desfazer — remove a última transação\n` +
    `/ajuda — exibe esta mensagem\n\n` +
    `*Exemplos de gastos:*\n` +
    `• gastei 80 no mercado\n` +
    `• uber 25 reais\n` +
    `• almoço 35\n` +
    `• pizza 70 dividido (divide 50/50)\n\n` +
    `*Exemplos de receitas:*\n` +
    `• recebi 3000 de salário\n` +
    `• freela 500`
  );
}

async function handleVincular(
  chatId: number,
  telegramUserId: number,
  token: string | undefined
): Promise<void> {
  if (!token) {
    await sendTelegramMessage(
      chatId,
      `❌ Informe o código gerado no app.\n\nEx: \`/vincular ABC123\``
    );
    return;
  }

  const user = await db.user.findUnique({
    where: { telegramLinkToken: token },
    select: { id: true, name: true, telegramLinkAt: true, telegramId: true },
  });

  if (!user) {
    await sendTelegramMessage(
      chatId,
      `❌ Código inválido ou expirado.\n\nGere um novo código no app CASALFI.`
    );
    return;
  }

  const TEN_MINUTES = 10 * 60 * 1000;
  const isExpired =
    !user.telegramLinkAt ||
    Date.now() - user.telegramLinkAt.getTime() > TEN_MINUTES;

  if (isExpired) {
    await db.user.update({
      where: { id: user.id },
      data: { telegramLinkToken: null, telegramLinkAt: null },
    });
    await sendTelegramMessage(chatId, `⏰ Código expirado. Gere um novo no app CASALFI.`);
    return;
  }

  const existingLink = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true },
  });

  if (existingLink && existingLink.id !== user.id) {
    await sendTelegramMessage(
      chatId,
      `⚠️ Este Telegram já está vinculado a outra conta CASALFI.`
    );
    return;
  }

  await db.user.update({
    where: { id: user.id },
    data: {
      telegramId: String(telegramUserId),
      telegramLinkToken: null,
      telegramLinkAt: null,
    },
  });

  const firstName = user.name.split(" ")[0];
  await sendTelegramMessage(
    chatId,
    `✅ *Conta vinculada com sucesso, ${firstName}!*\n\n` +
    `Agora é só mandar seus gastos e receitas aqui.\n\n` +
    `Ex: "gastei 80 no mercado"\n\n` +
    `Use /ajuda para ver todos os comandos.`
  );
}

// ── handleResumo ──────────────────────────────────────────────────────────

async function handleResumo(chatId: number, telegramUserId: number): Promise<void> {
  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true, coupleId: true },
  });

  if (!user) {
    await sendTelegramMessage(chatId, `🔗 Você ainda não vinculou sua conta.`);
    return;
  }

  const now = new Date();
  const month = format(now, "yyyy-MM");
  const start = startOfMonth(parseISO(`${month}-01`));
  const end = endOfMonth(parseISO(`${month}-01`));

  const transactions = await db.transaction.findMany({
    where: {
      OR: [
        { userId: user.id },
        ...(user.coupleId ? [{ coupleId: user.coupleId }] : []),
      ],
      date: { gte: start, lte: end },
    },
    select: {
      type: true,
      amount: true,
      category: { select: { name: true } },
    },
  });

  let totalIncome = 0;
  let totalExpense = 0;
  const catMap = new Map<string, number>();

  for (const t of transactions) {
    if (t.type === "income") totalIncome += t.amount;
    if (t.type === "expense") {
      totalExpense += t.amount;
      const cat = t.category?.name ?? "Outros";
      catMap.set(cat, (catMap.get(cat) ?? 0) + t.amount);
    }
  }

  const balance = totalIncome - totalExpense;
  const monthLabel = format(now, "MMMM 'de' yyyy", { locale: ptBR });
  const balanceSign = balance >= 0 ? "+" : "";

  const topCats = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, val]) => `  • ${name}: ${formatCurrency(val)}`)
    .join("\n");

  await sendTelegramMessage(
    chatId,
    `📊 *Resumo — ${monthLabel}*\n\n` +
    `💰 Receitas: *${formatCurrency(totalIncome)}*\n` +
    `💸 Despesas: *${formatCurrency(totalExpense)}*\n` +
    `📈 Saldo: *${balanceSign}${formatCurrency(balance)}*\n\n` +
    (topCats ? `*Top categorias:*\n${topCats}\n\n` : "") +
    `_Acesse o app para ver o gráfico completo._`
  );
}

// ── handleUltimas ─────────────────────────────────────────────────────────

async function handleUltimas(chatId: number, telegramUserId: number): Promise<void> {
  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true, coupleId: true },
  });

  if (!user) {
    await sendTelegramMessage(chatId, `🔗 Você ainda não vinculou sua conta.`);
    return;
  }

  const transactions = await db.transaction.findMany({
    where: {
      OR: [
        { userId: user.id },
        ...(user.coupleId ? [{ coupleId: user.coupleId }] : []),
      ],
    },
    orderBy: { date: "desc" },
    take: 5,
    select: {
      description: true,
      amount: true,
      type: true,
      date: true,
      category: { select: { name: true } },
    },
  });

  if (transactions.length === 0) {
    await sendTelegramMessage(chatId, `📭 Nenhuma transação encontrada.`);
    return;
  }

  const lines = transactions.map((t) => {
    const emoji = t.type === "expense" ? "💸" : "💰";
    const dateStr = format(t.date, "dd/MM");
    return `${emoji} ${dateStr} *${formatCurrency(t.amount)}* — ${t.description}`;
  });

  await sendTelegramMessage(
    chatId,
    `📋 *Últimas transações:*\n\n${lines.join("\n")}`
  );
}

// ── handleTransactionMessage ──────────────────────────────────────────────

async function handleTransactionMessage(
  chatId: number,
  telegramUserId: number,
  text: string
): Promise<void> {
  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true, name: true, coupleId: true },
  });

  if (!user) {
    await sendTelegramMessage(
      chatId,
      `🔗 Você ainda não vinculou sua conta.\n\n` +
      `1. Abra o CASALFI → Configurações\n` +
      `2. Gere um código Telegram\n` +
      `3. Envie: \`/vincular SEU_CODIGO\``
    );
    return;
  }

  const parsed = await parseTransactionFromText(text);

  if (!parsed) {
    await sendTelegramMessage(
      chatId,
      `🤔 Não entendi o valor da transação.\n\n` +
      `Tente ser mais específico:\n` +
      `• "gastei *80* no mercado"\n` +
      `• "uber *25* reais"`
    );
    return;
  }

  const categoryId = await resolveCategoryId(parsed.category, user.coupleId, parsed.type);

  const today = format(new Date(), "yyyy-MM-dd");

  const transactionInput: TransactionInput = {
    description: parsed.description,
    amount: parsed.amount,
    type: parsed.type,
    date: today,
    categoryId: categoryId ?? undefined,
    splitType: parsed.splitType ?? "individual",
    paidByUserId: user.id,
    isRecurring: false,
  };

  let createdId: string | undefined;

  try {
    const tx = await createTransaction(user.id, user.coupleId, transactionInput, {
      source: "telegram",
      rawInput: text,
      aiCategory: parsed.category,
      aiConfidence: parsed.confidence,
    });
    createdId = tx.id;
  } catch (err) {
    console.error("[Telegram] Erro ao criar transação:", err);
    await sendTelegramMessage(chatId, `❌ Erro ao registrar a transação. Tente novamente.`);
    return;
  }

  const emoji = parsed.type === "expense" ? "💸" : "💰";
  const typeLabel = parsed.type === "expense" ? "Despesa" : "Receita";
  const splitInfo = parsed.splitType === "equal" ? "\n_Dividido 50/50_" : "";
  const confidenceNote =
    parsed.confidence < 0.7 ? "\n\n⚠️ _Confiança baixa — confira no app_" : "";

  const successText =
    `${emoji} *${typeLabel} cadastrada!*\n\n` +
    `💵 ${formatCurrency(parsed.amount)}\n` +
    `🏷 ${parsed.category}\n` +
    `📝 ${parsed.description}` +
    splitInfo +
    confidenceNote;

  if (createdId) {
    await sendWithKeyboard(chatId, successText, afterTransactionKeyboard(createdId));
  } else {
    await sendTelegramMessage(chatId, successText);
  }
}

// ── resolveCategoryId ─────────────────────────────────────────────────────

async function resolveCategoryId(
  categoryName: string,
  coupleId: string | null,
  type: "income" | "expense"
): Promise<string | null> {
  const where = {
    name: { equals: categoryName },
    type: { in: [type, "both"] },
    OR: [
      ...(coupleId ? [{ coupleId }] : []),
      { coupleId: null, userId: null },
    ],
  };

  const category = await db.category.findFirst({ where, select: { id: true } });
  return category?.id ?? null;
}

// ── isDeleteIntent ────────────────────────────────────────────────────────

function isDeleteIntent(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = ["remova", "remove", "apaga", "apague", "cancela", "cancele",
    "desfaz", "desfazer", "deletar", "delete", "excluir", "exclua"];
  return keywords.some((k) => lower.includes(k));
}

// ── handleDesfazer ────────────────────────────────────────────────────────
// Mostra diálogo de confirmação em vez de deletar imediatamente.

async function handleDesfazer(chatId: number, telegramUserId: number): Promise<void> {
  const user = await db.user.findUnique({
    where: { telegramId: String(telegramUserId) },
    select: { id: true },
  });

  if (!user) {
    await sendTelegramMessage(chatId, `🔗 Você ainda não vinculou sua conta.`);
    return;
  }

  const last = await db.transaction.findFirst({
    where: { userId: user.id, source: "telegram" },
    orderBy: { createdAt: "desc" },
    select: { id: true, description: true, amount: true, type: true },
  });

  if (!last) {
    await sendTelegramMessage(chatId, `❌ Nenhuma transação recente para desfazer.`);
    return;
  }

  const emoji = last.type === "expense" ? "💸" : "💰";
  const confirmText =
    `⚠️ *Deseja remover esta transação?*\n\n` +
    `${emoji} ${formatCurrency(last.amount)} — ${last.description}`;

  await sendWithKeyboard(chatId, confirmText, confirmDeleteKeyboard(last.id));
}
