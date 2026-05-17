// Orquestrador da integração Telegram.
// Recebe um TelegramUpdate e decide o que fazer:
//   - /start, /ajuda → mensagem de boas-vindas
//   - /vincular CODIGO → vincula conta
//   - texto livre → parseia com IA e cria transação
// Nunca acessa o Prisma diretamente — delega para os services especializados.

import { db } from "@/lib/db";
import { sendTelegramMessage } from "@/services/telegram.service";
import { parseTransactionFromText } from "@/services/ai-transaction-parser.service";
import { createTransaction, deleteTransaction } from "@/services/transaction.service";
import { formatCurrency } from "@/lib/format";
import { format } from "date-fns";
import type { TelegramUpdate } from "@/types/telegram";
import type { TransactionInput } from "@/validators/transaction";

// ── handleTelegramUpdate ──────────────────────────────────────────────────

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  const msg = update.message;

  // Ignorar updates sem mensagem de texto (fotos, stickers, áudio etc.)
  if (!msg?.text || !msg.from) return;

  // Ignorar bots
  if (msg.from.is_bot) return;

  // Só atender chats privados (segurança: não expor dados em grupos)
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

  if (text.startsWith("/desfazer") || isDeleteIntent(text)) {
    await handleDesfazer(chatId, telegramUserId);
    return;
  }

  // ── Criar transação via IA ─────────────────────────────────────────────

  await handleTransactionMessage(chatId, telegramUserId, text);
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
    `/vincular CODIGO — vincula sua conta CASALFI\n` +
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

  // Busca o usuário pelo token
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

  // Verificar expiração de 10 minutos
  const TEN_MINUTES = 10 * 60 * 1000;
  const isExpired =
    !user.telegramLinkAt ||
    Date.now() - user.telegramLinkAt.getTime() > TEN_MINUTES;

  if (isExpired) {
    // Limpa o token expirado
    await db.user.update({
      where: { id: user.id },
      data: { telegramLinkToken: null, telegramLinkAt: null },
    });
    await sendTelegramMessage(
      chatId,
      `⏰ Código expirado. Gere um novo no app CASALFI.`
    );
    return;
  }

  // Verificar se este Telegram já está vinculado a outra conta
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

  // Vincula: grava telegramId e limpa o token de uso único
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
    `Ex: "gastei 80 no mercado"`
  );
}

async function handleTransactionMessage(
  chatId: number,
  telegramUserId: number,
  text: string
): Promise<void> {
  // 1. Encontrar o usuário pelo telegramId
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

  // 2. Parsear a mensagem com IA
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

  // 3. Resolver o categoryId pelo nome (categorias do casal ou globais)
  const categoryId = await resolveCategoryId(
    parsed.category,
    user.coupleId,
    parsed.type
  );

  // 4. Montar o input compatível com o TransactionInput existente
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

  try {
    // 5. Delega para o service existente com metadados de origem
    await createTransaction(user.id, user.coupleId, transactionInput, {
      source: "telegram",
      rawInput: text,
      aiCategory: parsed.category,
      aiConfidence: parsed.confidence,
    });
  } catch (err) {
    console.error("[Telegram] Erro ao criar transação:", err);
    await sendTelegramMessage(
      chatId,
      `❌ Erro ao registrar a transação. Tente novamente.`
    );
    return;
  }

  // 6. Confirmar no Telegram
  const emoji = parsed.type === "expense" ? "💸" : "💰";
  const typeLabel = parsed.type === "expense" ? "Despesa" : "Receita";
  const splitInfo = parsed.splitType === "equal" ? "\n_Dividido 50/50_" : "";
  const confidenceNote =
    parsed.confidence < 0.7
      ? "\n\n⚠️ _Confiança baixa — confira no app_"
      : "";

  await sendTelegramMessage(
    chatId,
    `${emoji} *${typeLabel} cadastrada!*\n\n` +
    `💵 ${formatCurrency(parsed.amount)}\n` +
    `🏷 ${parsed.category}\n` +
    `📝 ${parsed.description}` +
    splitInfo +
    confidenceNote
  );
}

// ── resolveCategoryId ─────────────────────────────────────────────────────
// Busca o ID da categoria pelo nome.
// Ordem: categorias do casal → categorias globais (sem coupleId/userId).

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
      { coupleId: null, userId: null }, // categorias padrão do sistema
    ],
  };

  const category = await db.category.findFirst({ where, select: { id: true } });
  return category?.id ?? null;
}

// ── isDeleteIntent ────────────────────────────────────────────────────────
// Detecta por palavras-chave se o usuário quer remover/desfazer algo.
// Evita chamar a IA desnecessariamente para esse caso simples.

function isDeleteIntent(text: string): boolean {
  const lower = text.toLowerCase();
  const keywords = ["remova", "remove", "apaga", "apague", "cancela", "cancele",
    "desfaz", "desfazer", "deletar", "delete", "excluir", "exclua"];
  return keywords.some((k) => lower.includes(k));
}

// ── handleDesfazer ────────────────────────────────────────────────────────
// Remove a transação mais recente do usuário criada via Telegram.

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

  try {
    await deleteTransaction(last.id, user.id);
    const emoji = last.type === "expense" ? "💸" : "💰";
    await sendTelegramMessage(
      chatId,
      `✅ *Transação removida!*\n\n${emoji} ${formatCurrency(last.amount)} — ${last.description}`
    );
  } catch {
    await sendTelegramMessage(chatId, `❌ Não foi possível remover a transação.`);
  }
}
